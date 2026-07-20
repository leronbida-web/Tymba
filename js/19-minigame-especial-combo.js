/* =========================================================
   MINIGAME: COMBO ELEMENTAL (ritmo — treina Especial)
   — 4 pistas fixas (Fogo/Água/Ar/Terra, mesma ordem/símbolos do
     minigame Sequência de Poderes — ver SIMON_KEYS/SIMON_SYMBOL em
     18-minigame-simon.js). IMPORTANTE: este arquivo precisa ser
     carregado DEPOIS de 18-minigame-simon.js no index.html.
   — Símbolos nascem em pistas aleatórias e caem até uma zona de
     acerto marcada perto da base; o jogador aperta o botão da
     pista certa enquanto o símbolo estiver dentro da zona.
   — Sem sequência pra decorar (diferente do Simon): é reação em
     tempo real, não memória.
   — Errar (botão errado/vazio ou deixar passar sem apertar) tira
     1 vida (3 vidas, igual defesa/arremesso).
   — Mesmo jogo pra todos os elementos por enquanto; o plano é
     trocar só o visual (cores/ícones/fundo) por elemento depois,
     mantendo esta mesma lógica.
   — SEM teto de dificuldade de propósito: velocidade de queda e
     frequência de spawn sobem pra sempre com o nível; o teto de
     recompensa abaixo continua como rede de segurança.
========================================================= */
let comboCtx, comboCanvas, comboActive = false;
let comboRaf = null, comboLastTime = 0;
let comboSymbols = []; // { lane, t, hit } — t: 0 (topo) → ~1.1 (saiu embaixo sem ser pego)
let comboScore = 0, comboVidas = 3, comboLevel = 1;
let comboLastSpawn = 0, comboEnding = false;
let comboBaseFallSpeedT = 0, comboBaseSpawnInterval = 0;

const COMBO_LANES = 4; // igual a SIMON_KEYS.length — fogo, agua, ar, terra
const COMBO_ZONE_T_START = 0.76; // início da zona de acerto (progresso 0→1 da queda)
const COMBO_ZONE_T_END = 0.94;   // fim da zona de acerto
const COMBO_MISS_T = 1.08;       // passou disso sem ser pego = falha, some da tela
const COMBO_FALL_SPEED_STEP = 0.045;   // quanto a queda acelera por nível
const COMBO_SPAWN_STEP = 0.05;         // quanto o intervalo de spawn encolhe por nível
const COMBO_MIN_SPAWN_INTERVAL = 0.32; // piso de segurança (não empilhar símbolo em cima de símbolo)

const COMBO_MAX_STAT_GAIN = 25;
const COMBO_MAX_COIN_GAIN = 20;

function startCombo(){
  hideAllScreens();
  document.getElementById('screen-combo').classList.add('active');

  comboCanvas = document.getElementById('comboCanvas');
  const wrap = comboCanvas.parentElement;
  comboCanvas.width = wrap.clientWidth;
  comboCanvas.height = wrap.clientHeight - 50;
  comboCtx = comboCanvas.getContext('2d');

  const el = ELEMENTS[state.element];
  comboCanvas.style.background = `linear-gradient(180deg, ${el.dark}, #241A33 60%, #150E20)`;

  comboSymbols = [];
  comboScore = 0;
  comboVidas = 3;
  comboLevel = 1;
  // nível 1 sempre começa do mesmo jeito, independente do nível do bichinho
  comboBaseFallSpeedT = 0.42;
  comboBaseSpawnInterval = 0.95; // curto o bastante pra já ter 2+ símbolos caindo desde o nível 1
  comboActive = true;
  comboEnding = false;
  comboLastSpawn = 0;
  comboLastTime = 0;

  document.getElementById('comboScore').textContent = comboScore;
  document.getElementById('comboVidas').textContent = comboVidas;
  document.getElementById('comboLevelLbl').textContent = comboLevel;

  buildComboButtons();
  requestAnimationFrame(comboLoop);
}

// monta os 4 botões de pista uma vez só (reaproveita se já existir, mesmo
// padrão do buildSimonPad) — cada botão fica alinhado embaixo da pista
// correspondente no canvas
function buildComboButtons(){
  const row = document.getElementById('comboButtonRow');
  if(!row || row.childElementCount === COMBO_LANES) return;
  row.innerHTML = '';
  SIMON_KEYS.forEach((key, idx) => {
    const btn = document.createElement('button');
    btn.className = 'combo-btn combo-' + key;
    btn.dataset.lane = idx;
    btn.textContent = SIMON_SYMBOL[key];
    btn.onpointerdown = (e) => { e.preventDefault(); handleComboPress(idx); };
    row.appendChild(btn);
  });
}

function flashComboButton(lane, cls){
  const btn = document.querySelector(`#comboButtonRow [data-lane="${lane}"]`);
  if(!btn) return;
  btn.classList.add(cls);
  setTimeout(() => btn.classList.remove(cls), 180);
}

function computeComboLevel(score){ return 1 + Math.floor(score/6); }

function computeComboLevelParams(level){
  const fallSpeedT = comboBaseFallSpeedT + (level-1)*COMBO_FALL_SPEED_STEP;
  const spawnInterval = Math.max(COMBO_MIN_SPAWN_INTERVAL, comboBaseSpawnInterval - (level-1)*COMBO_SPAWN_STEP);
  return { fallSpeedT, spawnInterval };
}

// pega o símbolo mais próximo (e ainda não pego) que está dentro da zona de
// acerto, na pista escolhida — se não achar nenhum, é um toque errado/vazio
function findComboHitInLane(lane){
  let best = null;
  comboSymbols.forEach(s => {
    if(s.lane !== lane || s.hit) return;
    if(s.t >= COMBO_ZONE_T_START && s.t <= COMBO_ZONE_T_END){
      if(!best || Math.abs(s.t - 0.85) < Math.abs(best.t - 0.85)) best = s;
    }
  });
  return best;
}

function handleComboPress(lane){
  if(!comboActive) return;
  const hitSymbol = findComboHitInLane(lane);
  if(hitSymbol){
    hitSymbol.hit = true;
    comboScore++;
    document.getElementById('comboScore').textContent = comboScore;
    flashComboButton(lane, 'ok');

    const newLevel = computeComboLevel(comboScore);
    if(newLevel > comboLevel){
      comboLevel = newLevel;
      document.getElementById('comboLevelLbl').textContent = comboLevel;
      spawnMiraLevelUpPop(comboLevel, 'screen-combo');
    }
  } else {
    // toque errado ou vazio (sem símbolo na zona dessa pista agora)
    registerComboMiss(lane);
  }
}

function registerComboMiss(lane){
  comboVidas--;
  document.getElementById('comboVidas').textContent = comboVidas;
  flashComboButton(lane, 'miss');
  if(comboVidas <= 0){ endCombo(); }
}

function comboLoop(ts){
  if(!comboActive) return;
  if(!comboLastTime) comboLastTime = ts;
  const dt = Math.min(0.05, (ts - comboLastTime)/1000);
  comboLastTime = ts;

  const w = comboCanvas.width, h = comboCanvas.height;
  const { fallSpeedT, spawnInterval } = computeComboLevelParams(comboLevel);

  comboLastSpawn += dt;
  if(comboLastSpawn > spawnInterval){
    comboLastSpawn = 0;
    comboSymbols.push({ lane: Math.floor(Math.random()*COMBO_LANES), t: 0, hit: false });
  }

  comboSymbols.forEach(s => { if(!s.hit) s.t += fallSpeedT*dt; });

  // símbolo passou da zona sem ser pego = falha
  comboSymbols.forEach(s => {
    if(!s.hit && s.t >= COMBO_MISS_T){
      s.hit = true; // marca como "resolvido" pra não contar de novo
      registerComboMiss(s.lane);
    }
  });

  // remove os que já saíram da tela (pegos ou perdidos)
  comboSymbols = comboSymbols.filter(s => s.t < COMBO_MISS_T + 0.05);

  if(!comboActive) return; // endCombo() pode ter sido chamado no registerComboMiss acima

  drawComboScene(w, h);
  comboRaf = requestAnimationFrame(comboLoop);
}

function drawComboScene(w, h){
  const ctx = comboCtx;
  ctx.clearRect(0, 0, w, h);

  const laneW = w / COMBO_LANES;
  const topMargin = 10, bottomMargin = 30;
  const zoneTopY = topMargin + COMBO_ZONE_T_START*(h-topMargin-bottomMargin);
  const zoneBotY = topMargin + COMBO_ZONE_T_END*(h-topMargin-bottomMargin);

  // divisórias de pista
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  for(let i=1;i<COMBO_LANES;i++){
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

  // símbolos caindo
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(laneW*0.42)}px sans-serif`;
  comboSymbols.forEach(s => {
    if(s.hit) return; // já foi resolvido (pego ou perdido), não desenha mais
    const cx = laneW*s.lane + laneW/2;
    const cy = topMargin + s.t*(h-topMargin-bottomMargin);
    const key = SIMON_KEYS[s.lane];
    ctx.fillText(SIMON_SYMBOL[key], cx, cy);
  });
}

function endCombo(){
  comboActive = false;
  comboEnding = true;
  cancelAnimationFrame(comboRaf);

  const statGain = Math.min(COMBO_MAX_STAT_GAIN, Math.max(1, Math.round(comboScore*0.6 + 1)));
  const coinGain = Math.min(COMBO_MAX_COIN_GAIN, Math.max(1, Math.round(comboScore/2)));
  const title = comboScore >= 20 ? 'Combo perfeito!' : 'Treino concluído!';
  finishTraining('screen-combo', 'especial', statGain, coinGain, title,
    `Você acertou ${comboScore} símbolos no ritmo, chegando no nível ${comboLevel}.`);
}

// botão Voltar: sai a qualquer momento levando o XP/especial/moedas já
// conquistados até aqui (mesmo padrão do coresBack/arremessoBack/simonBack)
function comboBack(){
  if(!comboActive || comboEnding) return;
  endCombo();
}
