/* =========================================================
   MINIGAME: SEQUÊNCIA DE PODERES (Simon Says elemental)
   — 4 símbolos elementais (Fogo/Água/Ar/Terra) num grid 2x2.
   — O jogo mostra uma sequência piscando os símbolos na ordem;
     o jogador repete tocando na mesma ordem. Acertou tudo?
     a sequência ganha mais um passo e recomeça. Errou um toque?
     acabou a partida (igual ao Simon clássico).
   — Pontuação = quantas rodadas completas o jogador aguentou.
   — SEM teto de dificuldade de propósito: a sequência só cresce,
     igual aos outros minigames desta sessão; o teto de recompensa
     abaixo continua sendo a rede de segurança.
   — Treina INTELIGÊNCIA (assumido; troque a string 'inteligencia'
     no finishTraining lá embaixo se quiser outra stat).
========================================================= */
let simonActive = false;
let simonSequence = [];       // ex: [2,0,3,1,...] índices 0..3 = fogo,agua,ar,terra
let simonPlayerIndex = 0;     // quantos passos da sequência o jogador já acertou nesta rodada
let simonScore = 0, simonLevel = 1;
let simonShowingSequence = false;
let simonTimers = [];         // guarda os setTimeout da sequência, pra poder cancelar (botão Voltar)
let simonEnding = false;      // trava re-entrada quando Voltar ou fim natural já disparou finishTraining

const SIMON_KEYS = ['fogo', 'agua', 'ar', 'terra'];
const SIMON_SYMBOL = { fogo: '🔥', agua: '💧', ar: '💨', terra: '🌎' };
const SIMON_STEP_MS_BASE = 650;   // duração de cada passo mostrado no nível 1
const SIMON_STEP_MS_MIN = 300;    // piso: nunca fica rápido demais a ponto de não dar pra ver
const SIMON_STEP_SHRINK_PER_LEVEL = 18; // quanto cada nível acelera a exibição da sequência
const SIMON_PAUSE_BEFORE_NEXT_MS = 700; // pausa depois de acertar a rodada, antes da próxima sequência

const SIMON_MAX_STAT_GAIN = 25;
const SIMON_MAX_COIN_GAIN = 20;

function startSimon(){
  hideAllScreens();
  document.getElementById('screen-simon').classList.add('active');

  simonSequence = [];
  simonPlayerIndex = 0;
  simonScore = 0;
  simonLevel = 1;
  simonActive = true;
  simonEnding = false;
  simonShowingSequence = false;
  clearSimonTimers();

  document.getElementById('simonScore').textContent = simonScore;
  document.getElementById('simonLevelLbl').textContent = simonLevel;
  document.getElementById('simonPetSvg').innerHTML = blobSvg(state.element, { evolved: state.evolved, wobble: true });

  buildSimonPad();
  setSimonInstructions('Observe a sequência...');
  addSimonStep();
}

function clearSimonTimers(){
  simonTimers.forEach(t => clearTimeout(t));
  simonTimers = [];
}

function setSimonInstructions(text){
  const instr = document.getElementById('simonInstructions');
  if(instr) instr.textContent = text;
}

// monta os 4 botões do pad uma vez só (reaproveita se já existir, igual ao
// padrão usado no coresBuildColorGuide — não duplica elemento a cada partida)
function buildSimonPad(){
  const pad = document.getElementById('simonPad');
  if(!pad || pad.childElementCount === SIMON_KEYS.length) return;
  pad.innerHTML = '';
  SIMON_KEYS.forEach((key, idx) => {
    const btn = document.createElement('button');
    btn.className = 'simon-btn simon-' + key;
    btn.dataset.idx = idx;
    btn.textContent = SIMON_SYMBOL[key];
    btn.onpointerdown = (e) => { e.preventDefault(); handleSimonTap(idx); };
    pad.appendChild(btn);
  });
}

function flashSimonButton(idx, durationMs){
  const pad = document.getElementById('simonPad');
  const btn = pad.querySelector(`[data-idx="${idx}"]`);
  if(!btn) return;
  btn.classList.add('lit');
  const t = setTimeout(() => btn.classList.remove('lit'), durationMs);
  simonTimers.push(t);
}

// adiciona um passo aleatório na sequência e mostra a sequência inteira do
// zero — igual ao Simon clássico, o jogador sempre vê a sequência completa
function addSimonStep(){
  simonSequence.push(Math.floor(Math.random() * SIMON_KEYS.length));
  simonPlayerIndex = 0;
  playSimonSequence();
}

function playSimonSequence(){
  simonShowingSequence = true;
  setSimonInstructions('Observe a sequência...');
  const stepMs = Math.max(SIMON_STEP_MS_MIN, SIMON_STEP_MS_BASE - (simonLevel - 1) * SIMON_STEP_SHRINK_PER_LEVEL);
  const gapMs = stepMs * 0.45;

  simonSequence.forEach((idx, i) => {
    const startAt = i * (stepMs + gapMs);
    const t = setTimeout(() => flashSimonButton(idx, stepMs), startAt);
    simonTimers.push(t);
  });

  const totalMs = simonSequence.length * (stepMs + gapMs);
  const t = setTimeout(() => {
    simonShowingSequence = false;
    setSimonInstructions('Sua vez! Repita a sequência.');
  }, totalMs);
  simonTimers.push(t);
}

function handleSimonTap(idx){
  if(!simonActive || simonShowingSequence) return;

  const btn = document.querySelector(`#simonPad [data-idx="${idx}"]`);
  if(btn){
    btn.classList.add('lit');
    setTimeout(() => btn.classList.remove('lit'), 180);
  }

  if(idx === simonSequence[simonPlayerIndex]){
    simonPlayerIndex++;
    if(simonPlayerIndex === simonSequence.length){
      // rodada completa!
      simonScore++;
      simonLevel++;
      document.getElementById('simonScore').textContent = simonScore;
      document.getElementById('simonLevelLbl').textContent = simonLevel;
      spawnMiraLevelUpPop(simonLevel, 'screen-simon');
      setSimonInstructions('Isso aí! Preparando a próxima sequência...');
      const t = setTimeout(addSimonStep, SIMON_PAUSE_BEFORE_NEXT_MS);
      simonTimers.push(t);
    }
  } else {
    endSimon();
  }
}

function endSimon(){
  simonActive = false;
  simonEnding = true;
  clearSimonTimers();

  const statGain = Math.min(SIMON_MAX_STAT_GAIN, Math.max(1, Math.round(simonScore * 1.5 + 1)));
  const coinGain = Math.min(SIMON_MAX_COIN_GAIN, Math.max(1, Math.round(simonScore)));
  const title = simonScore >= 10 ? 'Memória de elefante!' : 'Treino concluído!';
  finishTraining('screen-simon', 'inteligencia', statGain, coinGain, title,
    `Você completou ${simonScore} sequências, chegando no nível ${simonLevel}.`);
}

// botão Voltar: sai a qualquer momento levando o XP/inteligência/moedas já
// conquistados até aqui (mesmo padrão do coresBack/arremessoBack).
function simonBack(){
  if(!simonActive || simonEnding) return;
  endSimon();
}
