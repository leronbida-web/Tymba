function lerp(a,b,t){ return a + (b-a)*t; }

// progresso "t" (0=longe/horizonte, 1=perto/bichinho) é convertido pra uma
// curva de aceleração: a bola parece devagar longe e acelera vindo perto,
// exatamente como objetos se comportam em perspectiva real.
function defesaEase(t){ return Math.pow(Math.min(1, Math.max(0,t)), 1.7); }

function defesaSpread(t){ return lerp(DEFESA_SPREAD_TOP, DEFESA_SPREAD_BOTTOM, t); }
function defesaLaneX(lane, t, w){ return w/2 + (lane-1) * defesaSpread(t) * w; }
function defesaScreenY(t, h, horizonY){ return horizonY + (h-horizonY) * defesaEase(t); }

// --- sistema de níveis: nível 1 bem devagar, cada nível fica mais rápido ---
function computeDefesaLevel(score){ return 1 + Math.floor(score/5); }

function computeDefesaLevelParams(level){
  const speedT = Math.min(1.15, defesaBaseSpeedT + (level-1)*0.052);
  const spawnRate = Math.max(0.40, defesaBaseSpawn - (level-1)*0.085);
  return { speedT, spawnRate };
}

function startDefesa(){
  hideAllScreens();
  document.getElementById('screen-defesa').classList.add('active');

  defesaCanvas = document.getElementById('defesaCanvas');
  const wrap = defesaCanvas.parentElement;
  defesaCanvas.width = wrap.clientWidth;
  defesaCanvas.height = wrap.clientHeight - 50;

  const el = ELEMENTS[state.element];
  defesaCanvas.style.background = `linear-gradient(180deg, ${el.dark}, #2E1F3B 60%, #1B1226)`;

  defesaCtx = defesaCanvas.getContext('2d');
  defesaLane = 1;
  defesaBalls = [];
  defesaScore = 0;
  defesaVidas = 3;
  defesaLevel = 1;
  // nível 1 sempre começa do mesmo jeito, independente do nível do bichinho
  defesaBaseSpeedT = 0.30;
  defesaBaseSpawn = 1.4;
  defesaActive = true;
  defesaLastSpawn = 0;
  defesaLastTime = 0;
  document.getElementById('defesaScore').textContent = defesaScore;
  document.getElementById('defesaVidas').textContent = defesaVidas;
  document.getElementById('defesaLevelLbl').textContent = defesaLevel;

  document.getElementById('defesaPetSvg').innerHTML = blobSvg(state.element, { evolved:state.evolved, wobble:true });

  defesaCanvas.onpointerdown = handleDefesaTap;
  requestAnimationFrame(defesaLoop);
}

function handleDefesaTap(e){
  if(!defesaActive) return;
  const rect = defesaCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if(x < defesaCanvas.width/2) defesaLane = Math.max(0, defesaLane-1);
  else defesaLane = Math.min(2, defesaLane+1);
}

// --- chão/pista em perspectiva: converge num ponto de fuga no horizonte ---
function drawDefesaRoad(ctx, w, h, horizonY){
  const topHalf = defesaSpread(0) * w * 1.65;
  const botHalf = defesaSpread(1) * w * 1.65;
  const grad = ctx.createLinearGradient(0, horizonY, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(255,255,255,0.10)');
  ctx.beginPath();
  ctx.moveTo(w/2-topHalf, horizonY);
  ctx.lineTo(w/2+topHalf, horizonY);
  ctx.lineTo(w/2+botHalf, h);
  ctx.lineTo(w/2-botHalf, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  [-0.5, 0.5].forEach(off=>{
    ctx.beginPath();
    ctx.moveTo(w/2 + off*defesaSpread(0)*w*2, horizonY);
    ctx.lineTo(w/2 + off*defesaSpread(1)*w*2, h);
    ctx.stroke();
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  [-1.5, 1.5].forEach(off=>{
    ctx.beginPath();
    ctx.moveTo(w/2 + off*defesaSpread(0)*w, horizonY);
    ctx.lineTo(w/2 + off*defesaSpread(1)*w, h);
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  const rungs = 5;
  for(let i=1;i<rungs;i++){
    const t = defesaEase(i/rungs);
    const y = horizonY + (h-horizonY)*t;
    const half = defesaSpread(i/rungs)*w*1.55;
    ctx.beginPath();
    ctx.moveTo(w/2-half, y);
    ctx.lineTo(w/2+half, y);
    ctx.stroke();
  }
}

function drawCannonball(ctx, cx, cy, r){
  ctx.beginPath();
  ctx.ellipse(cx, cy + r*0.55, r*0.9, r*0.28, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  const grad = ctx.createRadialGradient(cx-r*0.35, cy-r*0.35, r*0.15, cx, cy, r);
  grad.addColorStop(0, '#4a4a4a');
  grad.addColorStop(0.55, '#1c1c1c');
  grad.addColorStop(1, '#000000');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx - r*0.32, cy - r*0.32, r*0.22, r*0.14, -0.6, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
}

function drawCannon(ctx, cx, topY, scale){
  ctx.save();
  ctx.translate(cx, topY);
  ctx.scale(scale, scale);

  // sombra no chão
  ctx.beginPath();
  ctx.ellipse(0, 44, 44, 9, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();

  // rodas com raios, estilo carroça de madeira
  function wheel(wx){
    ctx.save();
    ctx.translate(wx, 20);
    const rimGrad = ctx.createRadialGradient(-4,-5,3, 0,0,20);
    rimGrad.addColorStop(0, '#EAD08A');
    rimGrad.addColorStop(1, '#B07E3A');
    ctx.beginPath(); ctx.arc(0,0,19,0,Math.PI*2);
    ctx.fillStyle = rimGrad; ctx.fill();
    ctx.strokeStyle = '#7A5A2C'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#8A6A34'; ctx.lineWidth = 2.2;
    for(let a=0; a<Math.PI*2; a += Math.PI/4){
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*17, Math.sin(a)*17);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2);
    ctx.fillStyle = '#6E4A2E'; ctx.fill();
    ctx.restore();
  }
  wheel(-30);
  wheel(30);

  // carrinho / base de madeira
  ctx.fillStyle = '#C9964F';
  ctx.beginPath();
  ctx.moveTo(-24, 12); ctx.lineTo(-13, 28); ctx.lineTo(13, 28); ctx.lineTo(24, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8A6A34'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#E8C24A';
  ctx.fillRect(-6, 20, 12, 6);

  // cano visto de frente/baixo, com sombreado cilíndrico
  const barrelGrad = ctx.createLinearGradient(-27, 0, 27, 0);
  barrelGrad.addColorStop(0, '#264C33');
  barrelGrad.addColorStop(0.45, '#5FA072');
  barrelGrad.addColorStop(0.6, '#3D6B4A');
  barrelGrad.addColorStop(1, '#1E3A28');
  ctx.beginPath();
  ctx.ellipse(0, 3, 27, 18, 0, 0, Math.PI*2);
  ctx.fillStyle = barrelGrad;
  ctx.fill();
  ctx.strokeStyle = '#16281B'; ctx.lineWidth = 2; ctx.stroke();

  // faixas douradas em volta do cano
  ctx.strokeStyle = '#E8C24A'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 3, 27, 18, 0, Math.PI*1.08, Math.PI*1.92); ctx.stroke();
  ctx.strokeStyle = '#F3DA8A'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 3, 27, 18, 0, Math.PI*1.08, Math.PI*1.92); ctx.stroke();
  ctx.strokeStyle = '#E8C24A'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, -6, 20, 12, 0, Math.PI*1.08, Math.PI*1.92); ctx.stroke();

  // boca do canhão (com profundidade)
  const boreGrad = ctx.createRadialGradient(0,3,2, 0,3,14);
  boreGrad.addColorStop(0, '#0A1710');
  boreGrad.addColorStop(1, '#356B47');
  ctx.beginPath(); ctx.ellipse(0, 3, 14, 9.5, 0, 0, Math.PI*2);
  ctx.fillStyle = boreGrad; ctx.fill();
  ctx.strokeStyle = '#0A1710'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 3.5, 6.5, 4.2, 0, 0, Math.PI*2);
  ctx.fillStyle = '#000'; ctx.fill();

  ctx.restore();
}

function defesaLoop(ts){
  if(!defesaActive) return;
  if(!defesaLastTime) defesaLastTime = ts;
  const dt = Math.min(0.05, (ts - defesaLastTime)/1000);
  defesaLastTime = ts;

  const w = defesaCanvas.width, h = defesaCanvas.height;
  const horizonY = h * DEFESA_HORIZON_FRAC;
  const playerT = 1; // plano do bichinho, bem na frente da câmera

  const newLevel = computeDefesaLevel(defesaScore);
  if(newLevel > defesaLevel){
    defesaLevel = newLevel;
    document.getElementById('defesaLevelLbl').textContent = defesaLevel;
    spawnMiraLevelUpPop(defesaLevel, 'screen-defesa');
  }
  const { speedT, spawnRate } = computeDefesaLevelParams(defesaLevel);

  defesaLastSpawn += dt;
  if(defesaLastSpawn > spawnRate){
    defesaLastSpawn = 0;
    defesaBalls.push({ lane: Math.floor(Math.random()*3), t:0, passed:false });
  }

  // avança a distância percorrida (não é pixel/s, é progresso 0→1 na perspectiva)
  defesaBalls.forEach(b=> b.t += speedT*dt);
  defesaBalls.forEach(b=>{
    if(!b.passed && b.t >= 0.94){
      b.passed = true;
      if(b.lane === defesaLane){
        defesaScore++;
        document.getElementById('defesaScore').textContent = defesaScore;
      } else {
        defesaVidas--;
        document.getElementById('defesaVidas').textContent = defesaVidas;
        const petEl = document.getElementById('defesaPetSvg');
        petEl.classList.remove('hit'); void petEl.offsetWidth; petEl.classList.add('hit');
      }
    }
  });
  defesaBalls = defesaBalls.filter(b => b.t < 1.25);

  defesaCtx.clearRect(0,0,w,h);
  drawDefesaRoad(defesaCtx, w, h, horizonY);
  drawCannon(defesaCtx, w/2, horizonY, 0.5);

  // ordena por profundidade: bolas mais longe são desenhadas primeiro
  const sorted = [...defesaBalls].sort((a,b)=> a.t - b.t);
  sorted.forEach(b=>{
    const y = defesaScreenY(b.t, h, horizonY);
    const cx = defesaLaneX(b.lane, b.t, w);
    const r = lerp(DEFESA_R_FAR, w*DEFESA_R_NEAR_FRAC, b.t);
    drawCannonball(defesaCtx, cx, y, r);
  });

  const px = defesaLaneX(defesaLane, playerT, w);
  const py = defesaScreenY(playerT, h, horizonY) - 6;
  const petEl = document.getElementById('defesaPetSvg');
  petEl.style.left = px + 'px';
  petEl.style.top = py + 'px';

  if(defesaVidas <= 0){ endDefesa(); return; }
  defesaRaf = requestAnimationFrame(defesaLoop);
}

function endDefesa(){
  defesaActive = false;
  cancelAnimationFrame(defesaRaf);
  // teto no ganho por sessão: sem isso, uma sessão longa (jogador acostumado com o
  // platô de dificuldade lá pelo nível ~17) rendia XP sem limite e pulava vários
  // níveis de uma vez só. Acima do placar do teto, continua sendo um ótimo resultado,
  // só não cresce mais o ganho — pra isso, joga de novo.
  const statGain = Math.min(DEFESA_MAX_STAT_GAIN, Math.round(defesaScore*0.6 + 1));
  const coinGain = Math.min(DEFESA_MAX_COIN_GAIN, Math.max(1, Math.round(defesaScore/2)));
  finishTraining('screen-defesa','resistencia', statGain, coinGain,
    defesaScore >= 12 ? 'Resistência impenetrável!' : 'Treino concluído!',
    `Você bloqueou ${defesaScore} bolas de canhão e chegou ao nível ${defesaLevel}.`);
}

/* =========================================================
   MINIGAME: ESPECIAL (acertar a zona no marcador em movimento)
========================================================= */
let especialCtx, especialCanvas, especialActive=false, especialRound=0, especialScore=0;
let especialPos=0, especialDir=1, especialSpeed=0, especialZoneStart=0, especialZoneEnd=0, especialRaf=null;

