function showEvolution(){
  const dom = dominantStat(state);
  const el = ELEMENTS[state.element];
  document.getElementById('evoName').textContent = state.name + ' evoluiu!';
  const domLabel = { forca:'Força', velocidade:'Velocidade', resistencia:'Resistência', especial: ELEMENTS[state.element].special, precisao:'Precisão', inteligencia:'Inteligência', energia:'Energia' }[dom];
  document.getElementById('evoSub').textContent = `O treino em ${domLabel} moldou um novo corpo, do elemento ${el.label}.`;
  document.getElementById('evoPreview').innerHTML = `
    <style>.blob-wobble{ transform-origin:100px 120px; animation: wobble 3.2s ease-in-out infinite;} @keyframes wobble{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}</style>
    ${blobSvg(state.element, {evolved:true, dominant:dom})}
  `;
  document.getElementById('evoModal').classList.add('active');
}
function closeEvo(){
  document.getElementById('evoModal').classList.remove('active');
  renderHome();
}

/* =========================================================
   RECOMPENSA COMPARTILHADA (usada pelos treinos novos)
========================================================= */
function finishTraining(screenId, stat, statGain, coinGain, title, sub){
  state.stats[stat] += statGain;
  state.xp += statGain * 2;
  state.coins += coinGain;
  state.lastTrained[stat] = Date.now();
  saveState();
  const newLevel = levelFromXp(state.xp);

  document.getElementById(screenId).classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  renderHome();

  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultSub').textContent = sub;
  document.getElementById('rewardStat').textContent = '+' + statGain;
  const statLabels = { forca:'Força', resistencia:'Resistência', velocidade:'Velocidade', especial: ELEMENTS[state.element].special, precisao:'Precisão', inteligencia:'Inteligência', energia:'Energia' };
  document.getElementById('rewardStatLbl').textContent = statLabels[stat] || cap(stat);
  document.getElementById('rewardCoins').textContent = '+' + coinGain;
  document.getElementById('resultModal').classList.add('active');

  if(newLevel >= 5 && !state.evolved){
    state.evolved = true;
    saveState();
    pendingEvolution = true;
  }
}

/* =========================================================
/* =========================================================
   MINIGAME: DEFESA (entrar na frente das balas do canhão pra bloquear)
   — visão em perspectiva 3D: canhão pequeno lá no fundo, bichinho grande
   na frente da câmera, bolas crescendo conforme se aproximam.
========================================================= */
let defesaCtx, defesaCanvas, defesaActive=false, defesaLane=1, defesaBalls=[];
let defesaScore=0, defesaVidas=3, defesaRaf=null, defesaLastTime=0, defesaLastSpawn=0;
let defesaBaseSpeedT=0.30, defesaBaseSpawn=1.35, defesaLevel=1;

// --- parâmetros de perspectiva (frações da tela) ---
const DEFESA_HORIZON_FRAC = 0.16;   // altura do "horizonte" onde fica o canhão (bem pequeno, longe)
const DEFESA_SPREAD_TOP   = 0.045;  // meia-largura de cada pista lá no fundo (perto do canhão)
const DEFESA_SPREAD_BOTTOM= 0.30;   // meia-largura de cada pista perto da câmera (perto do bichinho)
const DEFESA_R_FAR = 4;             // raio da bola lá longe (quase um pontinho)
const DEFESA_R_NEAR_FRAC = 0.135;   // raio da bola perto (fração da largura da tela)

