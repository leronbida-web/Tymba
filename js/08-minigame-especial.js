function startEspecial(){
  hideAllScreens();
  document.getElementById('screen-especial').classList.add('active');

  especialCanvas = document.getElementById('especialCanvas');
  const wrap = especialCanvas.parentElement;
  especialCanvas.width = wrap.clientWidth;
  especialCanvas.height = wrap.clientHeight - 50;

  const el = ELEMENTS[state.element];
  especialCanvas.style.background = `linear-gradient(180deg, ${el.c1}, ${el.dark})`;
  document.getElementById('especialFlavor').textContent = el.special;

  especialCtx = especialCanvas.getContext('2d');
  especialRound = 0;
  especialScore = 0;
  especialActive = true;
  document.getElementById('especialScore').textContent = especialScore;

  especialCanvas.onpointerdown = handleEspecialTap;
  nextEspecialRound();
  requestAnimationFrame(especialLoop);
}

function nextEspecialRound(){
  especialPos = 0;
  especialDir = 1;
  // dificuldade sempre começa igual, independente do nível do bichinho
  especialSpeed = 0.012 + especialRound*0.002;
  const zoneSize = Math.max(0.10, 0.24 - especialRound*0.012);
  especialZoneStart = Math.random()*(1-zoneSize);
  especialZoneEnd = especialZoneStart + zoneSize;
}

function especialLoop(){
  if(!especialActive) return;
  especialPos += especialSpeed*especialDir;
  if(especialPos >= 1){ especialPos = 1; especialDir = -1; }
  if(especialPos <= 0){ especialPos = 0; especialDir = 1; }

  const w = especialCanvas.width, h = especialCanvas.height;
  especialCtx.clearRect(0,0,w,h);
  const barY = h/2, barX = 40, barW = w-80, barH = 26;

  especialCtx.fillStyle = 'rgba(255,255,255,0.25)';
  especialCtx.fillRect(barX, barY-barH/2, barW, barH);
  especialCtx.fillStyle = 'rgba(255,255,255,0.85)';
  especialCtx.fillRect(barX+especialZoneStart*barW, barY-barH/2, (especialZoneEnd-especialZoneStart)*barW, barH);

  const mx = barX + especialPos*barW;
  especialCtx.beginPath();
  especialCtx.arc(mx, barY, 16, 0, Math.PI*2);
  especialCtx.fillStyle = ELEMENTS[state.element].c2;
  especialCtx.fill();
  especialCtx.strokeStyle = '#fff';
  especialCtx.lineWidth = 3;
  especialCtx.stroke();

  especialCtx.fillStyle = '#fff';
  especialCtx.font = '700 14px Nunito, sans-serif';
  especialCtx.textAlign = 'center';
  especialCtx.fillText(`Rodada ${especialRound+1} / 8`, w/2, barY-60);

  especialRaf = requestAnimationFrame(especialLoop);
}

function handleEspecialTap(){
  if(!especialActive) return;
  const inZone = especialPos >= especialZoneStart && especialPos <= especialZoneEnd;
  if(inZone) especialScore++;
  document.getElementById('especialScore').textContent = especialScore;
  especialRound++;
  if(especialRound >= 8) endEspecial();
  else nextEspecialRound();
}

function endEspecial(){
  especialActive = false;
  cancelAnimationFrame(especialRaf);
  const statGain = Math.round(especialScore*1.1 + 1);
  const coinGain = Math.max(1, especialScore);
  finishTraining('screen-especial','especial', statGain, coinGain,
    especialScore >= 6 ? 'Domínio especial!' : 'Treino concluído!',
    `Você acertou ${especialScore} de 8 tentativas.`);
}

/* =========================================================
   MINIGAME: CORRIDA (desviar de obstáculos em 3 pistas)
========================================================= */
let corridaCtx, corridaCanvas, corridaActive=false, corridaLane=1, corridaObstacles=[];
let corridaScore=0, corridaVidas=3, corridaSpeed=240, corridaLastSpawn=0, corridaRaf=null, corridaLastTime=0;
let corridaBaseSpeed=240, corridaBaseSpawn=1.0, corridaLevel=1;

