/* =========================================================
   MINIGAME: REFLEXO ELEMENTAL (antes "Combo Elemental")
   — Treina a stat "Precisão" (id valPrecisao/barPrecisao), que já
     existia na ficha do bichinho separada de "Especial" mas ainda
     não era alimentada por nenhum minigame.
   — 4 pistas fixas (Fogo/Água/Ar/Terra, mesma ordem/símbolos do
     minigame Sequência de Poderes — ver SIMON_KEYS/SIMON_SYMBOL em
     18-minigame-simon.js). IMPORTANTE: este arquivo precisa ser
     carregado DEPOIS de 18-minigame-simon.js no index.html.
   — Símbolos nascem em pistas aleatórias e caem até uma zona de
     acerto marcada perto da base; o jogador aperta o botão da
     pista certa enquanto o símbolo estiver dentro da zona.
   — É reação em tempo real, não memória (por isso não se chama
     mais "combo" — não tem sequência pra decorar).
   — Errar (botão errado/vazio ou deixar passar sem apertar) tira
     1 vida (3 vidas, igual defesa/arremesso).
   — Mesmo jogo pra todos os elementos por enquanto; o plano é
     trocar só o visual (cores/ícones/fundo) por elemento depois.
   — SEM teto de dificuldade de propósito: velocidade de queda e
     frequência de spawn sobem pra sempre com o nível; o teto de
     recompensa abaixo continua como rede de segurança.
========================================================= */
let reflexoCtx, reflexoCanvas, reflexoActive = false;
let reflexoRaf = null, reflexoLastTime = 0;
let reflexoSymbols = []; // { lane, t, hit } — t: 0 (topo) → ~1.1 (saiu embaixo sem ser pego)
let reflexoScore = 0, reflexoVidas = 3, reflexoLevel = 1;
let reflexoLastSpawn = 0, reflexoEnding = false;
let reflexoBaseFallSpeedT = 0, reflexoBaseSpawnInterval = 0;

const REFLEXO_LANES = 4; // igual a SIMON_KEYS.length — fogo, agua, ar, terra
const REFLEXO_ZONE_T_START = 0.76; // início da zona de acerto (progresso 0→1 da queda)
const REFLEXO_ZONE_T_END = 0.94;   // fim da zona de acerto
const REFLEXO_MISS_T = 1.08;       // passou disso sem ser pego = falha, some da tela
const REFLEXO_FALL_SPEED_STEP = 0.045;   // quanto a queda acelera por nível
const REFLEXO_SPAWN_STEP = 0.05;         // quanto o intervalo de spawn encolhe por nível
const REFLEXO_MIN_SPAWN_INTERVAL = 0.32; // piso de segurança (não empilhar símbolo em cima de símbolo)

const REFLEXO_MAX_STAT_GAIN = 25;
const REFLEXO_MAX_COIN_GAIN = 20;

function startReflexo(){
  hideAllScreens();
  document.getElementById('screen-reflexo').classList.add('active');

  reflexoCanvas = document.getElementById('reflexoCanvas');
  const wrap = reflexoCanvas.parentElement;

  // monta os botões ANTES de medir — sem isso a fileira ainda não tem
  // altura renderizada e a conta de espaço sobrando dá errada
  buildReflexoButtons();

  // mede a altura real de tudo que divide espaço com o canvas dentro do
  // wrap (HUD, botão voltar, fileira de botões, instruções), pra sobrar
  // só o espaço certo pro canvas — sem isso a fileira de botões ficava
  // empurrada pra baixo da área visível, exigindo rolar a tela
  const btnRow = document.getElementById('reflexoButtonRow');
  const hud = wrap.querySelector('.mira-hud');
  const instr = wrap.querySelector('.mira-instructions');
  const backBtn = wrap.querySelector('.minigame-back-btn');
  // frase tutorial curta, reaproveitando o mesmo elemento de instrução
  // usado pelo minigame de mira — setamos o texto toda vez que o jogo
  // inicia (a medição de altura logo abaixo já considera esse texto)
  if(instr) instr.textContent = 'Aperte o símbolo certo quando ele entrar na faixa clara!';
  const reserved = (hud ? hud.offsetHeight : 0)
                  + (instr ? instr.offsetHeight : 0)
                  + (backBtn ? backBtn.offsetHeight : 0)
                  + (btnRow ? btnRow.offsetHeight : 0)
                  + 28; // respiro entre os elementos (gaps/margens)

  reflexoCanvas.width = wrap.clientWidth;
  reflexoCanvas.height = Math.max(160, wrap.clientHeight - reserved);
  reflexoCtx = reflexoCanvas.getContext('2d');

  const el = ELEMENTS[state.element];
  reflexoCanvas.style.background = `linear-gradient(180deg, ${el.dark}, #241A33 60%, #150E20)`;

  reflexoSymbols = [];
  reflexoScore = 0;
  reflexoVidas = 3;
  reflexoLevel = 1;
  // nível 1 sempre começa do mesmo jeito, independente do nível do bichinho
  reflexoBaseFallSpeedT = 0.42;
  reflexoBaseSpawnInterval = 0.95; // curto o bastante pra já ter 2+ símbolos caindo desde o nível 1
  reflexoActive = true;
  reflexoEnding = false;
  reflexoLastSpawn = 0;
  reflexoLastTime = 0;

  document.getElementById('reflexoScore').textContent = reflexoScore;
  document.getElementById('reflexoVidas').textContent = reflexoVidas;
  document.getElementById('reflexoLevelLbl').textContent = reflexoLevel;

  requestAnimationFrame(reflexoLoop);
}

// monta os 4 botões de pista uma vez só (reaproveita se já existir, mesmo
// padrão do buildSimonPad) — cada botão fica alinhado embaixo da pista
// correspondente no canvas
function buildReflexoButtons(){
  const row = document.getElementById('reflexoButtonRow');
  if(!row || row.childElementCount === REFLEXO_LANES) return;
  row.innerHTML = '';
  SIMON_KEYS.forEach((key, idx) => {
    const btn = document.createElement('button');
    btn.className = 'reflexo-btn reflexo-' + key;
    btn.dataset.lane = idx;
    btn.textContent = SIMON_SYMBOL[key];
    btn.onpointerdown = (e) => { e.preventDefault(); handleReflexoPress(idx); };
    row.appendChild(btn);
  });
}

function flashReflexoButton(lane, cls){
  const btn = document.querySelector(`#reflexoButtonRow [data-lane="${lane}"]`);
  if(!btn) return;
  btn.classList.add(cls);
  setTimeout(() => btn.classList.remove(cls), 180);
}

function computeReflexoLevel(score){ return 1 + Math.floor(score/6); }

function computeReflexoLevelParams(level){
  const fallSpeedT = reflexoBaseFallSpeedT + (level-1)*REFLEXO_FALL_SPEED_STEP;
  const spawnInterval = Math.max(REFLEXO_MIN_SPAWN_INTERVAL, reflexoBaseSpawnInterval - (level-1)*REFLEXO_SPAWN_STEP);
  return { fallSpeedT, spawnInterval };
}

// pega o símbolo mais próximo (e ainda não pego) que está dentro da zona de
// acerto, na pista escolhida — se não achar nenhum, é um toque errado/vazio
function findReflexoHitInLane(lane){
  let best = null;
  reflexoSymbols.forEach(s => {
    if(s.lane !== lane || s.hit) return;
    if(s.t >= REFLEXO_ZONE_T_START && s.t <= REFLEXO_ZONE_T_END){
      if(!best || Math.abs(s.t - 0.85) < Math.abs(best.t - 0.85)) best = s;
    }
  });
  return best;
}

function handleReflexoPress(lane){
  if(!reflexoActive) return;
  const hitSymbol = findReflexoHitInLane(lane);
  if(hitSymbol){
    hitSymbol.hit = true;
    reflexoScore++;
    document.getElementById('reflexoScore').textContent = reflexoScore;
    flashReflexoButton(lane, 'ok');

    const newLevel = computeReflexoLevel(reflexoScore);
    if(newLevel > reflexoLevel){
      reflexoLevel = newLevel;
      document.getElementById('reflexoLevelLbl').textContent = reflexoLevel;
      spawnMiraLevelUpPop(reflexoLevel, 'screen-reflexo');
    }
  } else {
    // toque errado ou vazio (sem símbolo na zona dessa pista agora)
    registerReflexoMiss(lane);
  }
}

function registerReflexoMiss(lane){
  reflexoVidas--;
  document.getElementById('reflexoVidas').textContent = reflexoVidas;
  flashReflexoButton(lane, 'miss');
  if(reflexoVidas <= 0){ endReflexo(); }
}

function reflexoLoop(ts){
  if(!reflexoActive) return;
  if(!reflexoLastTime) reflexoLastTime = ts;
  const dt = Math.min(0.05, (ts - reflexoLastTime)/1000);
  reflexoLastTime = ts;

  const w = reflexoCanvas.width, h = reflexoCanvas.height;
  const { fallSpeedT, spawnInterval } = computeReflexoLevelParams(reflexoLevel);

  reflexoLastSpawn += dt;
  if(reflexoLastSpawn > spawnInterval){
    reflexoLastSpawn = 0;
    reflexoSymbols.push({ lane: Math.floor(Math.random()*REFLEXO_LANES), t: 0, hit: false });
  }

  reflexoSymbols.forEach(s => { if(!s.hit) s.t += fallSpeedT*dt; });

  // símbolo passou da zona sem ser pego = falha
  reflexoSymbols.forEach(s => {
    if(!s.hit && s.t >= REFLEXO_MISS_T){
      s.hit = true; // marca como "resolvido" pra não contar de novo
      registerReflexoMiss(s.lane);
    }
  });

  // remove os que já saíram da tela (pegos ou perdidos)
  reflexoSymbols = reflexoSymbols.filter(s => s.t < REFLEXO_MISS_T + 0.05);

  if(!reflexoActive) return; // endReflexo() pode ter sido chamado no registerReflexoMiss acima

  drawReflexoScene(w, h);
  reflexoRaf = requestAnimationFrame(reflexoLoop);
}

function drawReflexoScene(w, h){
  const ctx = reflexoCtx;
  ctx.clearRect(0, 0, w, h);

  const laneW = w / REFLEXO_LANES;
  const topMargin = 10, bottomMargin = 30;
  const zoneTopY = topMargin + REFLEXO_ZONE_T_START*(h-topMargin-bottomMargin);
  const zoneBotY = topMargin + REFLEXO_ZONE_T_END*(h-topMargin-bottomMargin);

  // divisórias de pista
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  for(let i=1;i<REFLEXO_LANES;i++){
    ctx.beginPath();
    ctx.moveTo(laneW*i, 0);
    ctx.lineTo(laneW*i, h);
    ctx.stroke();
  }

  // zona de acerto (faixa clara)
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(0, zoneTopY, w, zoneBotY - zoneTopY);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, zoneTopY, w, zoneBotY - zoneTopY);

  // símbolos caindo — fillStyle e sombra próprios, sem herdar a
  // transparência usada pra pintar a faixa da zona de acerto acima
  // (era isso que deixava os símbolos quase invisíveis)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(laneW*0.42)}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6;
  reflexoSymbols.forEach(s => {
    if(s.hit) return; // já foi resolvido (pego ou perdido), não desenha mais
    const cx = laneW*s.lane + laneW/2;
    const cy = topMargin + s.t*(h-topMargin-bottomMargin);
    const key = SIMON_KEYS[s.lane];
    ctx.fillText(SIMON_SYMBOL[key], cx, cy);
  });
  ctx.shadowBlur = 0; // reseta pra não vazar sombra pra outros desenhos do próximo frame
}

function endReflexo(){
  reflexoActive = false;
  reflexoEnding = true;
  cancelAnimationFrame(reflexoRaf);

  const statGain = Math.min(REFLEXO_MAX_STAT_GAIN, Math.max(1, Math.round(reflexoScore*0.6 + 1)));
  const coinGain = Math.min(REFLEXO_MAX_COIN_GAIN, Math.max(1, Math.round(reflexoScore/2)));
  const title = reflexoScore >= 20 ? 'Reflexos afiados!' : 'Treino concluído!';
  // usa a stat "precisao" que já existe na ficha do bichinho (valPrecisao/
  // barPrecisao), separada de "especial" — antes nenhum minigame alimentava ela
  finishTraining('screen-reflexo', 'precisao', statGain, coinGain, title,
    `Você acertou ${reflexoScore} símbolos no reflexo, chegando no nível ${reflexoLevel}.`);
}

// botão Voltar: sai a qualquer momento levando o XP/precisão/moedas já
// conquistados até aqui (mesmo padrão do coresBack/arremessoBack/simonBack)
function reflexoBack(){
  if(!reflexoActive || reflexoEnding) return;
  endReflexo();
}
