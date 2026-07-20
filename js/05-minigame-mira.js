function computeMiraLevelParams(level, canvasWidth){
  const amp = level <= 1 ? 0 : Math.min(canvasWidth*0.30, (level-1) * 16);
  const period = level <= 1 ? 4000 : Math.max(650, 2600 - (level-1) * 160);
  return { amp, period };
}

function miraLevelForHits(hits){
  let L = 1;
  while ((L*(L+1))/2 <= hits) L++;
  return L;
}

const MIRA_RINGS = [
  { frac:1.00, color:'#F4F4F4', points:05 },
  { frac:0.83, color:'#333333', points:15 },
  { frac:0.64, color:'#2AA7E8', points:30 },
  { frac:0.46, color:'#F2762E', points:50 },
  { frac:0.28, color:'#F5D949', points:100 },
  { frac:0.12, color:'#141414', points:500 },
];

// teto de recompensa por sessão (ver endMira) — sem isso, uma sequência boa de
// centro (500 pontos por acerto) somada ao multiplicador de XP (que também cresce
// dentro da mesma partida conforme o nível de velocidade sobe) rendia ganhos
// explosivos e pulava vários níveis de personagem de uma vez só
const MIRA_MAX_STAT_GAIN = 25;
const MIRA_MAX_COIN_GAIN = 20;
const MIRA_MAX_XP_GAIN = 70;

function hideAllScreens(){
  document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
}

function startMira(){
  hideAllScreens();
  document.getElementById('screen-mira').classList.add('active');

  miraCanvas = document.getElementById('miraCanvas');
  const wrap = miraCanvas.parentElement;
  miraCanvas.width = wrap.clientWidth;
  miraCanvas.height = wrap.clientHeight - 50;

  const el = ELEMENTS[state.element];
  miraCanvas.style.background = `linear-gradient(180deg, ${el.c2}, ${el.dark})`;

  miraCtx = miraCanvas.getContext('2d');
  miraBalls = [];
  miraScore = 0;
  miraTimeLeft = 30;
  miraActive = true;
  document.getElementById('miraScore').textContent = miraScore;
  document.getElementById('miraTime').textContent = miraTimeLeft;

  miraSpeedLevel = 1;
  miraHits = 0;
  miraXpMultiplier = 1;

  const radius = Math.min(miraCanvas.width, miraCanvas.height) * 0.26;
  const { amp, period } = computeMiraLevelParams(miraSpeedLevel, miraCanvas.width);
  miraTarget = { cx: miraCanvas.width/2, cy: miraCanvas.height*0.36, r: radius, amp, period, startTime: performance.now() };

  document.getElementById('miraPetSvg').innerHTML = blobSvg(state.element, { evolved:state.evolved, wobble:true });
  const instr = document.getElementById('miraInstructions');
  instr.textContent = 'Toque no alvo! Acerte pra ele começar a se mexer.';

  miraCanvas.onpointerdown = handleMiraTap;

  miraInterval = setInterval(()=>{
    miraTimeLeft--;
    document.getElementById('miraTime').textContent = miraTimeLeft;
    if(miraTimeLeft <= 0) endMira();
  }, 1000);

  requestAnimationFrame(miraLoop);
}

function getMiraTargetPos(now){
  const t = miraTarget;
  if(t.amp <= 0) return { x:t.cx, y:t.cy };
  const phase = ((now - t.startTime) / t.period) * Math.PI * 2;
  return { x: t.cx + Math.sin(phase)*t.amp, y: t.cy + Math.cos(phase*1.3)*t.amp*0.25 };
}

function drawMiraTarget(ctx, x, y, r){
  ctx.beginPath();
  ctx.arc(x, y, r*1.08, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  MIRA_RINGS.forEach(ring=>{
    ctx.beginPath();
    ctx.arc(x, y, r*ring.frac, 0, Math.PI*2);
    ctx.fillStyle = ring.color;
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function miraLoop(){
  if(!miraActive) return;
  miraCtx.clearRect(0, 0, miraCanvas.width, miraCanvas.height);
  const now = performance.now();
  const pos = getMiraTargetPos(now);
  drawMiraTarget(miraCtx, pos.x, pos.y, miraTarget.r);

  miraBalls = miraBalls.filter(b => now - b.start < b.dur);
  miraBalls.forEach(b=>{
    const p = Math.min(1, (now - b.start) / b.dur);
    const ease = 1 - Math.pow(1-p, 2);
    const x = b.fromX + (b.toX - b.fromX) * ease;
    const y = b.fromY + (b.toY - b.fromY) * ease - Math.sin(p*Math.PI) * 70;
    miraCtx.beginPath();
    miraCtx.arc(x, y, 9, 0, Math.PI*2);
    miraCtx.fillStyle = b.color;
    miraCtx.fill();
    miraCtx.strokeStyle = 'rgba(0,0,0,0.25)';
    miraCtx.lineWidth = 1.5;
    miraCtx.stroke();
  });

  requestAnimationFrame(miraLoop);
}

function spawnMiraScorePop(x, y, points){
  const wrap = document.querySelector('#screen-mira .mira-wrap');
  const pop = document.createElement('div');
  pop.className = 'mira-score-pop' + (points === 0 ? ' miss' : '');
  pop.textContent = points > 0 ? '+' + points : 'Errou!';
  pop.style.left = (miraCanvas.offsetLeft + x) + 'px';
  pop.style.top = (miraCanvas.offsetTop + y) + 'px';
  wrap.appendChild(pop);
  setTimeout(()=> pop.remove(), 700);
}

function handleMiraTap(e){
  if(!miraActive) return;
  const rect = miraCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const now = performance.now();
  const pos = getMiraTargetPos(now);
  const dist = Math.hypot(pos.x - x, pos.y - y);

  let points = 0;
  if(dist <= miraTarget.r){
    MIRA_RINGS.forEach(ring=>{
      if(dist <= miraTarget.r * ring.frac) points = ring.points;
    });
  }

  miraScore += points;
  document.getElementById('miraScore').textContent = miraScore;

  const petEl = document.getElementById('miraPetSvg');
  petEl.classList.remove('throw');
  void petEl.offsetWidth;
  petEl.classList.add('throw');

  miraBalls.push({
    fromX: miraCanvas.width/2, fromY: miraCanvas.height - 20,
    toX: x, toY: y, start: now, dur: 260,
    color: ELEMENTS[state.element].c2,
  });

  spawnMiraScorePop(x, y, points);

  if(points > 0){
    miraHits++;
    const newLevel = miraLevelForHits(miraHits);
    if(newLevel > miraSpeedLevel) levelUpMiraTarget(newLevel);
  }
}

function levelUpMiraTarget(newLevel){
  const now = performance.now();
  const oldPhase = miraTarget.amp > 0 ? (((now - miraTarget.startTime) / miraTarget.period) % 1) : 0;
  const { amp, period } = computeMiraLevelParams(newLevel, miraCanvas.width);
  miraTarget.amp = amp;
  miraTarget.period = period;
  miraTarget.startTime = now - oldPhase * period;

  miraSpeedLevel = newLevel;
  miraXpMultiplier = 1 + (newLevel-1) * 0.15;

  const instr = document.getElementById('miraInstructions');
  instr.textContent = newLevel === 2
    ? 'O alvo começou a se mexer!'
    : `Nível ${newLevel} • cada vez mais rápido!`;

  spawnMiraLevelUpPop(newLevel);
}

function spawnMiraLevelUpPop(level, screenId){
  const wrap = document.querySelector('#' + (screenId || 'screen-mira') + ' .mira-wrap');
  if(!wrap) return;
  const pop = document.createElement('div');
  pop.className = 'mira-levelup-pop';
  pop.textContent = 'Nível ' + level + '!';
  wrap.appendChild(pop);
  setTimeout(()=> pop.remove(), 900);
}

function endMira(){
  miraActive = false;
  clearInterval(miraInterval);

  const statGain = Math.min(MIRA_MAX_STAT_GAIN, Math.max(1, Math.round(miraScore / 120)));
  const coinGain = Math.min(MIRA_MAX_COIN_GAIN, Math.max(1, Math.round(miraScore / 250)));
  const xpGain = Math.min(MIRA_MAX_XP_GAIN, Math.round(statGain * 2 * miraXpMultiplier));
  const oldLevel = levelFromXp(state.xp);

  state.stats.precisao += statGain;
  state.xp += xpGain;
  state.coins += coinGain;
  state.lastTrained.precisao = Date.now();
  saveState();

  const newLevel = levelFromXp(state.xp);

  document.getElementById('screen-mira').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  renderHome();

  document.getElementById('resultTitle').textContent = miraScore >= 1200 ? 'Treino excelente!' : 'Treino concluído!';
  document.getElementById('resultSub').textContent = `Você fez ${miraScore} pontos no alvo (nível ${miraSpeedLevel}).`;
  document.getElementById('rewardStat').textContent = '+' + statGain;
  document.getElementById('rewardStatLbl').textContent = 'Precisão';
  document.getElementById('rewardCoins').textContent = '+' + coinGain;
  document.getElementById('resultModal').classList.add('active');

  if(newLevel >= 5 && !state.evolved){
    state.evolved = true;
    saveState();
    pendingEvolution = true;
  }
}

let pendingEvolution = false;
function closeResult(){
  document.getElementById('resultModal').classList.remove('active');
  // reseta o modal pro formato padrão de 1 stat (caso o último treino tenha sido o Esquiva, que usa 3 stats)
  const single = document.getElementById('rewardStatSingle');
  const multi = document.getElementById('rewardStatMulti');
  if(single) single.style.display = '';
  if(multi) multi.style.display = 'none';
  if(pendingEvolution){
    pendingEvolution = false;
    showEvolution();
  }
}

