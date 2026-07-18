function computeCorridaLevel(score){ return 1 + Math.floor(score/5); }

function startCorrida(){
  hideAllScreens();
  document.getElementById('screen-corrida').classList.add('active');

  corridaCanvas = document.getElementById('corridaCanvas');
  const wrap = corridaCanvas.parentElement;
  corridaCanvas.width = wrap.clientWidth;
  corridaCanvas.height = wrap.clientHeight - 50;

  // Pista com cor própria (amarela), diferente da paleta de qualquer bichinho
  corridaCanvas.style.background = `linear-gradient(180deg, #FFD65C, #F3B93B)`;

  corridaCtx = corridaCanvas.getContext('2d');
  corridaLane = 1;
  corridaObstacles = [];
  corridaScore = 0;
  corridaVidas = 3;
  corridaLevel = 1;
  // nível 1 sempre começa igual, independente do nível do bichinho
  corridaBaseSpeed = 220;
  corridaBaseSpawn = 1.0;
  corridaSpeed = corridaBaseSpeed;
  corridaActive = true;
  corridaLastSpawn = 0;
  corridaLastTime = 0;
  document.getElementById('corridaScore').textContent = corridaScore;
  document.getElementById('corridaVidas').textContent = corridaVidas;
  document.getElementById('corridaLevelLbl').textContent = corridaLevel;

  document.getElementById('corridaPetSvg').innerHTML = blobSvg(state.element, { evolved:state.evolved, wobble:true });

  corridaCanvas.onpointerdown = handleCorridaTap;
  requestAnimationFrame(corridaLoop);
}

function handleCorridaTap(e){
  if(!corridaActive) return;
  const rect = corridaCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if(x < corridaCanvas.width/2) corridaLane = Math.max(0, corridaLane-1);
  else corridaLane = Math.min(2, corridaLane+1);
}

function corridaLoop(ts){
  if(!corridaActive) return;
  if(!corridaLastTime) corridaLastTime = ts;
  const dt = Math.min(0.05, (ts - corridaLastTime)/1000);
  corridaLastTime = ts;

  const w = corridaCanvas.width, h = corridaCanvas.height;
  const laneW = w/3, playerY = h - 70;

  const newLevel = computeCorridaLevel(corridaScore);
  if(newLevel > corridaLevel){
    corridaLevel = newLevel;
    document.getElementById('corridaLevelLbl').textContent = corridaLevel;
    spawnMiraLevelUpPop(corridaLevel, 'screen-corrida');
  }
  corridaSpeed = corridaBaseSpeed + (corridaLevel-1) * 40;
  const spawnRate = Math.max(0.32, corridaBaseSpawn - (corridaLevel-1) * 0.05);

  corridaLastSpawn += dt;
  if(corridaLastSpawn > spawnRate){
    corridaLastSpawn = 0;
    corridaObstacles.push({ lane: Math.floor(Math.random()*3), y:-40, passed:false });
  }

  corridaObstacles.forEach(o=> o.y += corridaSpeed*dt);
  corridaObstacles.forEach(o=>{
    if(!o.passed && o.y > playerY){
      o.passed = true;
      if(o.lane === corridaLane){
        corridaVidas--;
        document.getElementById('corridaVidas').textContent = corridaVidas;
      } else {
        corridaScore++;
        document.getElementById('corridaScore').textContent = corridaScore;
      }
    }
  });
  corridaObstacles = corridaObstacles.filter(o => o.y < h+60);

  corridaCtx.clearRect(0,0,w,h);
  corridaCtx.strokeStyle = 'rgba(255,255,255,0.55)';
  corridaCtx.lineWidth = 3;
  corridaCtx.setLineDash([16,12]);
  for(let i=1;i<3;i++){
    corridaCtx.beginPath();
    corridaCtx.moveTo(laneW*i,0);
    corridaCtx.lineTo(laneW*i,h);
    corridaCtx.stroke();
  }
  corridaCtx.setLineDash([]);
  corridaObstacles.forEach(o=>{
    const cx = laneW*o.lane + laneW/2;
    corridaCtx.beginPath();
    corridaCtx.arc(cx, o.y, 22, 0, Math.PI*2);
    corridaCtx.fillStyle = '#2E1F3B';
    corridaCtx.fill();
  });

  const px = laneW*corridaLane + laneW/2;
  const petEl = document.getElementById('corridaPetSvg');
  petEl.style.left = px + 'px';
  petEl.style.top = playerY + 'px';

  if(corridaVidas <= 0){ endCorrida(); return; }
  corridaRaf = requestAnimationFrame(corridaLoop);
}

function endCorrida(){
  corridaActive = false;
  cancelAnimationFrame(corridaRaf);
  const statGain = Math.round(corridaScore*0.5 + 1);
  const coinGain = Math.max(1, Math.round(corridaScore/3));
  finishTraining('screen-corrida','velocidade', statGain, coinGain,
    corridaScore >= 15 ? 'Que velocidade!' : 'Treino concluído!',
    `Você desviou de ${corridaScore} obstáculos e chegou ao nível ${corridaLevel}.`);
}

/* =========================================================
   MINIGAME: PULO (estilo "dino game" do Chrome — o player pula
   por cima das pedras do modo mundo pra treinar Energia)
========================================================= */
let puloCtx, puloCanvas, puloActive=false;
let puloObstacles=[];
let puloScore=0, puloSpeed=0, puloLevel=1, puloRaf=null, puloLastTime=0;
let puloPlayerY=0, puloVelY=0, puloJumping=false, puloGroundY=0, puloPlayerX=0;
let puloDistSinceSpawn=0, puloNextSpawnDist=0, puloGroundScrollX=0, puloCanvasTopOffset=0;
const PULO_GRAVITY = 1750; // px/s² — mais baixa, dá um pulo mais flutuante e fácil de cronometrar
const PULO_JUMP_VELOCITY = -740; // px/s, impulso do pulo
const PULO_BASE_SPEED = 220; // sempre começa igual, independente do nível do bichinho, e mais devagar no início
// (removido o antigo teto PULO_MAX_SPEED — a velocidade agora sobe sem limite, ver puloLoop em 10-minigame-pulo.js)
const PULO_OBSTACLE_GROUND_NUDGE = 8; // a sprite da pedra tem uma sombra/margem embutida na base; empurra um pouco pra baixo pra encostar certinho na linha do chão

