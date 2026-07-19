/* =========================================================
   MINIGAME: ESQUIVA (Treina Velocidade)
   - Tymba centralizado, bolinhas vêm das 4 bordas mirando ele
   - Player arrasta o dedo em qualquer lugar do cenário, o Tymba segue
   - 10 hits = game over
========================================================= */

let esquivaCanvas, esquivaCtx;
let esquivaStageW = 600;
let esquivaStageH = 400;
let esquivaBalls = [];
let esquivaTymba = { x: 0, y: 0, targetX: 0, targetY: 0, r: 32, hitFlash: 0 };
let esquivaHits = 0;
let esquivaDodged = 0;
let esquivaActive = false;
let esquivaGameOverShown = false;
let esquivaRaf = null;
let esquivaLastT = 0;
let esquivaLastSpawn = 0;
let esquivaStartTime = 0;
let esquivaEndedAt = 0;     // timestamp em que o jogo terminou (pra "travar" e mostrar overlay)
let esquivaScore = 0;       // score = tempo sobrevivido (s) + dodges*5
let esquivaHitShake = 0;    // shake intensity da tela após hit

// dificuldade
const ESQUIVA_MAX_HITS = 10;
const ESQUIVA_BASE_SPAWN_MS = 900;   // intervalo inicial entre spawns
const ESQUIVA_MIN_SPAWN_MS = 280;    // intervalo mínimo (jogo difícil)
const ESQUIVA_BASE_SPEED = 95;       // velocidade inicial das bolinhas (px/s)
const ESQUIVA_MAX_SPEED = 320;       // velocidade máxima
const ESQUIVA_BALL_R_MIN = 7;
const ESQUIVA_BALL_R_MAX = 13;
const ESQUIVA_TYMBA_R = 32;          // raio de colisão (px) — coincide com a sprite
const ESQUIVA_GAME_OVER_DELAY = 700; // ms entre o hit fatal e o overlay

// cores das bolinhas: azul, branco e marrom (sorteio aleatório independente do elemento do bichinho)
const ESQUIVA_BALL_COLORS = ['#3B82F6', '#FFFFFF', '#8B5A2B'];

function startEsquiva(){
  hideAllScreens();
  document.getElementById('screen-esquiva').classList.add('active');

  // mede o tamanho do cenário
  const stage = document.getElementById('esquivaStage');
  esquivaStageW = Math.max(320, stage.clientWidth);
  esquivaStageH = Math.max(240, stage.clientHeight);

  // canvas
  esquivaCanvas = document.getElementById('esquivaCanvas');
  esquivaCanvas.width = esquivaStageW;
  esquivaCanvas.height = esquivaStageH;
  esquivaCtx = esquivaCanvas.getContext('2d');

  // bichinho centralizado (com o sprite já injetado)
  const tymbaSvg = document.getElementById('esquivaTymbaSvg');
  tymbaSvg.innerHTML = `<g class="blob-wobble">${blobSvg(state.element, { evolved: state.evolved, wobble: false })}</g>`;
  tymbaSvg.style.width = (ESQUIVA_TYMBA_R * 2) + 'px';
  tymbaSvg.style.height = (ESQUIVA_TYMBA_R * 2) + 'px';
  esquivaTymba.x = esquivaStageW / 2;
  esquivaTymba.y = esquivaStageH / 2;
  esquivaTymba.targetX = esquivaTymba.x;
  esquivaTymba.targetY = esquivaTymba.y;
  esquivaTymba.hitFlash = 0;

  // estado
  esquivaBalls = [];
  esquivaHits = 0;
  esquivaDodged = 0;
  esquivaScore = 0;
  esquivaGameOverShown = false;
  esquivaActive = true;
  esquivaEndedAt = 0;
  esquivaHitShake = 0;
  esquivaStartTime = performance.now();
  esquivaLastT = esquivaStartTime;
  esquivaLastSpawn = esquivaStartTime;

  // listeners
  esquivaAttachTouch();
  window.addEventListener('keydown', esquivaHandleKey);

  // tira listeners ao sair da tela
  const observer = new MutationObserver(()=>{
    if(!document.getElementById('screen-esquiva').classList.contains('active')){
      window.removeEventListener('keydown', esquivaHandleKey);
      esquivaDetachTouch();
      esquivaActive = false;
      if(esquivaRaf){ cancelAnimationFrame(esquivaRaf); esquivaRaf = null; }
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('screen-esquiva'), { attributes:true, attributeFilter:['class'] });

  // gameover overlay escondido
  const go = document.getElementById('esquivaGameover');
  if(go) go.style.display = 'none';

  // inicia loop
  if(esquivaRaf) cancelAnimationFrame(esquivaRaf);
  esquivaRaf = requestAnimationFrame(esquivaTick);

  esquivaUpdateHud();
  esquivaUpdatePetPosition();
}

function esquivaHandleKey(e){
  if(!document.getElementById('screen-esquiva').classList.contains('active')) return;
  const step = 36;
  let dx = 0, dy = 0;
  if(e.code === 'ArrowLeft' || e.code === 'KeyA'){ dx -= step; }
  if(e.code === 'ArrowRight' || e.code === 'KeyD'){ dx += step; }
  if(e.code === 'ArrowUp' || e.code === 'KeyW'){ dy -= step; }
  if(e.code === 'ArrowDown' || e.code === 'KeyS'){ dy += step; }
  if(dx || dy){
    e.preventDefault();
    esquivaTymba.targetX += dx;
    esquivaTymba.targetY += dy;
    esquivaClampTarget();
  }
}

function esquivaAttachTouch(){
  const stage = document.getElementById('esquivaStage');
  // pointermove antes do pointerdown garante responsividade quando o dedo já tá na tela
  stage.addEventListener('pointerdown', esquivaOnPointer);
  stage.addEventListener('pointermove', esquivaOnPointer);
}

function esquivaDetachTouch(){
  const stage = document.getElementById('esquivaStage');
  if(!stage) return;
  stage.removeEventListener('pointerdown', esquivaOnPointer);
  stage.removeEventListener('pointermove', esquivaOnPointer);
}

function esquivaOnPointer(e){
  e.preventDefault();
  if(!esquivaActive) return;
  const stage = document.getElementById('esquivaStage');
  const r = stage.getBoundingClientRect();
  esquivaTymba.targetX = e.clientX - r.left;
  esquivaTymba.targetY = e.clientY - r.top;
  esquivaClampTarget();
}

function esquivaClampTarget(){
  const m = ESQUIVA_TYMBA_R + 4;
  esquivaTymba.targetX = Math.max(m, Math.min(esquivaStageW - m, esquivaTymba.targetX));
  esquivaTymba.targetY = Math.max(m, Math.min(esquivaStageH - m, esquivaTymba.targetY));
}

function esquivaTick(now){
  if(!esquivaActive) return;
  const dt = Math.min(0.05, (now - esquivaLastT) / 1000);
  esquivaLastT = now;

  // suaviza o movimento do Tymba (lerp)
  const lerp = 0.22;
  esquivaTymba.x += (esquivaTymba.targetX - esquivaTymba.x) * lerp;
  esquivaTymba.y += (esquivaTymba.targetY - esquivaTymba.y) * lerp;

  // hit flash decai
  if(esquivaTymba.hitFlash > 0) esquivaTymba.hitFlash = Math.max(0, esquivaTymba.hitFlash - dt * 2.5);
  if(esquivaHitShake > 0) esquivaHitShake = Math.max(0, esquivaHitShake - dt * 6);

  // dificuldade escala com o tempo de partida
  const tElapsed = (now - esquivaStartTime) / 1000;
  const speedScale = 1 + Math.min(2.2, tElapsed * 0.035);
  const spawnScale = 1 - Math.min(0.7, tElapsed * 0.012);
  const curSpeed = Math.min(ESQUIVA_MAX_SPEED, ESQUIVA_BASE_SPEED * speedScale);
  const curSpawn = Math.max(ESQUIVA_MIN_SPAWN_MS, ESQUIVA_BASE_SPAWN_MS * spawnScale);

  // spawn de bolinhas
  if(now - esquivaLastSpawn > curSpawn){
    esquivaSpawn(curSpeed);
    esquivaLastSpawn = now;
  }

  // atualiza bolinhas e checa colisão
  const hitR = ESQUIVA_TYMBA_R;
  for(let i = esquivaBalls.length - 1; i >= 0; i--){
    const b = esquivaBalls[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life += dt;

    // colisão com Tymba (círculo-círculo)
    const dx = b.x - esquivaTymba.x;
    const dy = b.y - esquivaTymba.y;
    const rr = (hitR + b.r);
    if(dx*dx + dy*dy < rr*rr){
      esquivaHits += 1;
      esquivaTymba.hitFlash = 1;
      esquivaHitShake = 1;
      esquivaBalls.splice(i, 1);
      if(esquivaHits >= ESQUIVA_MAX_HITS){
        // fim de jogo: congela, espera um pouco pra mostrar o hit, depois mostra overlay
        esquivaActive = false;
        esquivaEndedAt = performance.now();
        setTimeout(esquivaShowGameOver, ESQUIVA_GAME_OVER_DELAY);
      }
      continue;
    }

    // saiu da tela → conta como desvio
    if(b.x < -30 || b.x > esquivaStageW + 30 || b.y < -30 || b.y > esquivaStageH + 30){
      esquivaDodged += 1;
      esquivaBalls.splice(i, 1);
    }
  }

  // score = tempo em segundos + dodges * 5
  esquivaScore = Math.floor(tElapsed) + esquivaDodged * 5;

  esquivaUpdatePetPosition();
  esquivaRender();
  esquivaUpdateHud();

  if(esquivaActive) esquivaRaf = requestAnimationFrame(esquivaTick);
}

// spawna uma bolinha de uma das 4 bordas mirando a posição ATUAL do Tymba
function esquivaSpawn(curSpeed){
  const side = Math.floor(Math.random() * 4);
  const margin = 20;
  const r = ESQUIVA_BALL_R_MIN + Math.random() * (ESQUIVA_BALL_R_MAX - ESQUIVA_BALL_R_MIN);
  let x, y;
  if(side === 0){ // topo
    x = margin + Math.random() * (esquivaStageW - 2*margin);
    y = -margin;
  } else if(side === 1){ // direita
    x = esquivaStageW + margin;
    y = margin + Math.random() * (esquivaStageH - 2*margin);
  } else if(side === 2){ // baixo
    x = margin + Math.random() * (esquivaStageW - 2*margin);
    y = esquivaStageH + margin;
  } else { // esquerda
    x = -margin;
    y = margin + Math.random() * (esquivaStageH - 2*margin);
  }

  // mira com pequeno ruído na posição ATUAL do Tymba (não onde ele vai estar)
  const aimX = esquivaTymba.x + (Math.random() - 0.5) * 90;
  const aimY = esquivaTymba.y + (Math.random() - 0.5) * 90;
  const dx = aimX - x;
  const dy = aimY - y;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const speed = curSpeed * (0.85 + Math.random() * 0.4);
  const vx = dx / len * speed;
  const vy = dy / len * speed;

  // cor sorteada da paleta fixa (azul / branco / marrom)
  const color = ESQUIVA_BALL_COLORS[Math.floor(Math.random() * ESQUIVA_BALL_COLORS.length)];

  esquivaBalls.push({ x, y, vx, vy, r, color, life: 0 });
}

function esquivaShowGameOver(){
  if(esquivaGameOverShown) return;
  esquivaGameOverShown = true;

  // persiste melhor pontuação
  if(esquivaScore > (state.esquivaBest || 0)){
    state.esquivaBest = esquivaScore;
    saveState();
  }

  // mostra overlay
  const go = document.getElementById('esquivaGameover');
  document.getElementById('esquivaFinalDodged').textContent = esquivaDodged;
  document.getElementById('esquivaFinalTime').textContent = Math.floor((performance.now() - esquivaStartTime) / 1000) + 's';
  document.getElementById('esquivaFinalScore').textContent = esquivaScore;
  if(go) go.style.display = 'flex';
}

function esquivaUpdateHud(){
  document.getElementById('esquivaStatValue').textContent = Math.round(state.stats.velocidade);
  document.getElementById('esquivaDodgedValue').textContent = esquivaDodged;
  document.getElementById('esquivaHitsValue').textContent = esquivaHits;
  document.getElementById('esquivaTimeValue').textContent = Math.floor((performance.now() - esquivaStartTime) / 1000) + 's';
}

function esquivaUpdatePetPosition(){
  const svg = document.getElementById('esquivaTymbaSvg');
  if(!svg) return;
  const size = ESQUIVA_TYMBA_R * 2;
  svg.style.transform = `translate3d(${esquivaTymba.x - size/2}px, ${esquivaTymba.y - size/2}px, 0)`;
  // flash branco quando toma hit
  if(esquivaTymba.hitFlash > 0.01){
    svg.style.filter = `drop-shadow(0 0 14px rgba(255,80,80,${0.7 * esquivaTymba.hitFlash})) brightness(${1 + esquivaTymba.hitFlash * 0.5})`;
  } else {
    svg.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))';
  }
}

function esquivaRender(){
  const ctx = esquivaCtx;
  if(!ctx) return;

  // shake da tela
  ctx.save();
  if(esquivaHitShake > 0.01){
    const s = esquivaHitShake;
    ctx.translate((Math.random() - 0.5) * 12 * s, (Math.random() - 0.5) * 12 * s);
  }
  ctx.clearRect(-20, -20, esquivaStageW + 40, esquivaStageH + 40);

  // bolinhas (com glow)
  for(const b of esquivaBalls){
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 14;
    ctx.fill();
    // núcleo brilhante
    ctx.beginPath();
    ctx.arc(b.x - b.r*0.25, b.y - b.r*0.25, b.r*0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 0;
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.restore();
}

// botão "Voltar" (no canto superior esquerdo) — entrega recompensa proporcional e vai pra home
// distribui o ganho entre velocidade, precisão e energia (33,33% cada, com o resto indo 1 pra cada)
function voltarDoEsquiva(){
  if(esquivaRaf){ cancelAnimationFrame(esquivaRaf); esquivaRaf = null; }
  esquivaActive = false;

  const tElapsed = (performance.now() - esquivaStartTime) / 1000;
  // ganho total (mesma fórmula do game over, pra ser consistente)
  const totalStat = Math.max(1, Math.floor(tElapsed / 5) + Math.floor(esquivaDodged / 8));
  const coinGain = Math.max(1, Math.floor(esquivaDodged / 3) + Math.floor(tElapsed / 12));

  // divide em 3 partes (33,33% cada). Ex: total=10 → 3+3+3, depois distribui o resto (1) na velocidade
  const base = Math.floor(totalStat / 3);
  let vel = base, pre = base, ene = base;
  const rem = totalStat - base * 3;
  if(rem >= 1) vel += 1;
  if(rem >= 2) pre += 1;
  if(rem >= 3) ene += 1;

  // XP baseado no total (não multiplica por 3), seguindo o padrão do projeto (statGain * 2)
  const xpGain = totalStat * 2;

  // aplica nos 3 stats
  state.stats.velocidade += vel;
  state.stats.precisao += pre;
  state.stats.energia += ene;
  state.xp += xpGain;
  state.coins += coinGain;
  state.lastTrained.velocidade = Date.now();
  state.lastTrained.precisao = Date.now();
  state.lastTrained.energia = Date.now();
  saveState();

  // persiste best
  if(esquivaScore > (state.esquivaBest || 0)){
    state.esquivaBest = esquivaScore;
    saveState();
  }

  // título
  const title = esquivaDodged >= 60 ? 'Esquiva LENDÁRIA! ⚡'
              : (esquivaDodged >= 25 ? 'Bons reflexos! 💨'
              : (esquivaHits >= ESQUIVA_MAX_HITS ? 'Game Over — mas foi boa!' : 'Voltou cedo!'));
  const sub = `Bolinhas desviadas: ${esquivaDodged}. Tempo: ${Math.floor(tElapsed)}s. +${vel} Vel, +${pre} Prec, +${ene} Ene, +${xpGain} XP.`;

  // mostra o modal padrão mas no formato de 3 stats (esconde o single, mostra o multi)
  document.getElementById('screen-esquiva').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  renderHome();

  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultSub').textContent = sub;
  document.getElementById('rewardMultiVel').textContent = '+' + vel;
  document.getElementById('rewardMultiPrec').textContent = '+' + pre;
  document.getElementById('rewardMultiEne').textContent = '+' + ene;
  document.getElementById('rewardCoins').textContent = '+' + coinGain;
  // toggle: esconde a caixinha de 1 stat, mostra a de 3 stats
  document.getElementById('rewardStatSingle').style.display = 'none';
  document.getElementById('rewardStatMulti').style.display = 'flex';
  document.getElementById('resultModal').classList.add('active');

  // checa evolução (mesma regra do finishTraining)
  const newLevel = levelFromXp(state.xp);
  if(newLevel >= 5 && !state.evolved){
    state.evolved = true;
    saveState();
    pendingEvolution = true;
  }
}
