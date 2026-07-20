function computePuloLevel(score){ return 1 + Math.floor(score/40); }

// teto de recompensa por sessão (ver endPulo) — a pontuação aqui cresce direto com o
// TEMPO sobrevivido (não com quantas pedras foram puladas), e como a velocidade tem um
// teto (PULO_MAX_SPEED), uma corrida longa e tranquila rendia energia sem limite
const PULO_MAX_STAT_GAIN = 25;
const PULO_MAX_COIN_GAIN = 20;

function startPulo(){
  hideAllScreens();
  document.getElementById('screen-pulo').classList.add('active');

  puloCanvas = document.getElementById('puloCanvas');
  const stage = document.getElementById('puloStage');
  puloCanvas.width = stage.clientWidth;
  // altura limitada (não esticada até o fim da tela) pra o jogo ficar centralizado verticalmente no stage
  puloCanvas.height = Math.max(220, Math.min(stage.clientHeight, 420));
  puloCtx = puloCanvas.getContext('2d');

  document.querySelectorAll('#puloObstacleLayer .pulo-obstacle').forEach(el => el.remove());
  puloObstacles = [];
  puloGroundY = puloCanvas.height - 34;
  puloPlayerX = Math.round(puloCanvas.width * 0.16);
  puloPlayerY = puloGroundY;
  puloVelY = 0;
  puloJumping = false;
  puloScore = 0;
  puloLevel = 1;
  puloSpeed = PULO_BASE_SPEED;
  puloDistSinceSpawn = 0;
  puloNextSpawnDist = 320 + Math.random()*140; // distância até a primeira pedra
  puloGroundScrollX = 0;
  puloActive = true;
  puloLastTime = 0;

  // o canvas fica centralizado dentro do stage (via CSS), então lê a posição real
  // dele já depois de posicionado, pra os elementos por cima (player/pedras) baterem certinho
  // com o que é desenhado no canvas, não importa a altura da tela do usuário
  puloCanvasTopOffset = puloCanvas.offsetTop;

  document.getElementById('puloScoreLbl').textContent = '0';
  document.getElementById('puloLevelLbl').textContent = '1';
  document.getElementById('puloBestLbl').textContent = Math.floor(state.puloBest || 0);
  document.getElementById('puloPetSvg').innerHTML = blobSvg(state.element, { evolved:state.evolved, wobble:false });

  const petEl = document.getElementById('puloPetSvg');
  petEl.style.left = puloPlayerX + 'px';
  petEl.style.top = (puloPlayerY + puloCanvasTopOffset) + 'px';

  puloCanvas.onpointerdown = handlePuloTap;
  requestAnimationFrame(puloLoop);
}

function handlePuloTap(){
  if(!puloActive) return;
  if(!puloJumping){
    puloVelY = PULO_JUMP_VELOCITY;
    puloJumping = true;
  }
}

function spawnPuloObstacle(w, offsetX){
  const scale = 0.75 + Math.random()*0.35;
  const width = Math.round(46*scale), height = Math.round(62*scale);
  const el = document.createElement('div');
  el.className = 'pulo-obstacle';
  el.style.width = width + 'px';
  el.style.height = height + 'px';
  el.innerHTML = worldRockSvg();
  document.getElementById('puloObstacleLayer').appendChild(el);
  puloObstacles.push({ el, x: w + 40 + offsetX, w: width, h: height });
}

function puloLoop(ts){
  if(!puloActive) return;
  if(!puloLastTime) puloLastTime = ts;
  const dt = Math.min(0.033, (ts - puloLastTime)/1000);
  puloLastTime = ts;

  const w = puloCanvas.width, h = puloCanvas.height;

  // física do pulo: gravidade constante, um único pulo (sem pulo duplo)
  puloVelY += PULO_GRAVITY*dt;
  puloPlayerY += puloVelY*dt;
  if(puloPlayerY >= puloGroundY){
    puloPlayerY = puloGroundY;
    puloVelY = 0;
    puloJumping = false;
  }

  // velocidade cresce direto com a distância percorrida, sem teto de propósito — a
  // própria velocidade vira o limite natural da corrida (fica impossível reagir a
  // tempo em algum momento), em vez de travar e deixar sessões longas e tranquilas
  // renderem energia sem fim
  puloSpeed = PULO_BASE_SPEED + puloScore*0.5;
  puloScore += dt * (puloSpeed/9);
  puloGroundScrollX += puloSpeed*dt;
  document.getElementById('puloScoreLbl').textContent = Math.floor(puloScore);
  if(puloScore > (state.puloBest||0)) document.getElementById('puloBestLbl').textContent = Math.floor(puloScore);

  const newLevel = computePuloLevel(Math.floor(puloScore));
  if(newLevel > puloLevel){
    puloLevel = newLevel;
    document.getElementById('puloLevelLbl').textContent = puloLevel;
    spawnMiraLevelUpPop(puloLevel, 'screen-pulo');
  }

  // nasce uma pedra nova de vez em quando, com espaçamento baseado na distância percorrida
  puloDistSinceSpawn += puloSpeed*dt;
  if(puloDistSinceSpawn >= puloNextSpawnDist){
    puloDistSinceSpawn = 0;
    puloNextSpawnDist = 620 + Math.random()*220; // distância maior entre uma pedra e a próxima
    spawnPuloObstacle(w, 0);
    // às vezes nasce uma segunda pedra bem colada, formando um "aglomerado" como no dino game
    if(Math.random() < 0.25){
      spawnPuloObstacle(w, 56 + Math.random()*20);
    }
  }

  // move os obstáculos e checa colisão contra a caixa do player
  const playerBox = { left: puloPlayerX - 18, right: puloPlayerX + 18, top: puloPlayerY - 66, bottom: puloPlayerY - 14 };
  let gameOver = false;
  puloObstacles.forEach(o => {
    o.x -= puloSpeed*dt;
    o.el.style.left = o.x + 'px';
    o.el.style.top = (puloGroundY + PULO_OBSTACLE_GROUND_NUDGE + puloCanvasTopOffset) + 'px';
    // a caixa de colisão da pedra é um pouco menor que o desenho, pra ficar mais justo com o player
    const hitW = o.w * 0.6, hitH = o.h * 0.85;
    const obLeft = o.x - hitW/2, obRight = o.x + hitW/2;
    const obTop = puloGroundY - hitH, obBottom = puloGroundY;
    if(obRight > playerBox.left && obLeft < playerBox.right && obBottom > playerBox.top && obTop < playerBox.bottom){
      gameOver = true;
    }
  });
  puloObstacles = puloObstacles.filter(o => {
    if(o.x < -60){ o.el.remove(); return false; }
    return true;
  });

  const petEl = document.getElementById('puloPetSvg');
  petEl.style.top = (puloPlayerY + puloCanvasTopOffset) + 'px';

  drawPuloScene(w, h);

  if(gameOver){ endPulo(); return; }
  puloRaf = requestAnimationFrame(puloLoop);
}

function drawPuloScene(w, h){
  puloCtx.clearRect(0, 0, w, h);
  // céu
  const sky = puloCtx.createLinearGradient(0, 0, 0, puloGroundY);
  sky.addColorStop(0, '#BEE7FF');
  sky.addColorStop(1, '#E7F8FF');
  puloCtx.fillStyle = sky;
  puloCtx.fillRect(0, 0, w, h);
  // chão: só um risco (linha) verde, igual ao dino game — sem grama preenchida
  puloCtx.strokeStyle = '#4FAE41';
  puloCtx.lineWidth = 3;
  puloCtx.beginPath();
  puloCtx.moveTo(0, puloGroundY);
  puloCtx.lineTo(w, puloGroundY);
  puloCtx.stroke();
  // tracinhos soltos rolando embaixo do risco, dá sensação de corrida (igual aos tracinhos do dino game)
  puloCtx.strokeStyle = '#6FCB5B';
  puloCtx.lineWidth = 3;
  const dashW = 18, gap = 46, period = dashW + gap;
  const offset = puloGroundScrollX % period;
  for(let x = -period + (period - offset); x < w + period; x += period){
    puloCtx.beginPath();
    puloCtx.moveTo(x, puloGroundY + 9);
    puloCtx.lineTo(x + dashW, puloGroundY + 9);
    puloCtx.stroke();
  }
}

function endPulo(){
  puloActive = false;
  cancelAnimationFrame(puloRaf);
  puloCanvas.onpointerdown = null;
  document.querySelectorAll('#puloObstacleLayer .pulo-obstacle').forEach(el => el.remove());
  puloObstacles = [];

  const finalScore = Math.floor(puloScore);
  if(finalScore > (state.puloBest || 0)) state.puloBest = finalScore;

  const statGain = Math.min(PULO_MAX_STAT_GAIN, Math.max(1, Math.round(finalScore/12)));
  const coinGain = Math.min(PULO_MAX_COIN_GAIN, Math.max(1, Math.round(finalScore/20)));
  finishTraining('screen-pulo', 'energia', statGain, coinGain,
    finalScore >= 80 ? 'Correu que só!' : 'Treino concluído!',
    `Você fugiu por ${finalScore}m antes de esbarrar numa pedra, no nível ${puloLevel}.`);
}

/* =========================================================
   MINIGAME: CORES (2048 de verdade, só com cores em vez de números)
   — Grid 4x4, swipe em 4 direções
   — Peças: 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048
   — Cada valor tem sua cor (paleta do bichinho, gradiente)
   — Pontuação: soma dos valores fundidos (clássico 2048)
   — Treina INTELIGÊNCIA
========================================================= */
const CORES_GRID = 4;
const CORES_MAX_LEVEL = 11;            // 2..2048 = 11 níveis (lv=1 → 2, lv=11 → 2048)
const CORES_TILE_VALUE = (lv) => Math.pow(2, lv);
let coresBoard = [];                   // matriz 4x4 com valores 0 (vazio) ou 1..11
let coresScore = 0;
let coresBest = 0;
let coresMaxTile = 0;                  // maior lv alcançado (1..11)
let coresReached2048 = false;          // se já chegou em 2048 nesta partida
let coresGameOver = false;
let coresBusy = false;                 // bloqueia input enquanto animação rola
let coresWonShown = false;             // se já mostrou o overlay de parabéns

