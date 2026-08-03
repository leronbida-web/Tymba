/* =========================================================
   MINIGAME: COMBO ELEMENTAL (treina Especial)
   ---------------------------------------------------------
   Diferente do Reflexo (19): aqui os símbolos não caem em
   pistas separadas pra apertar "na hora certa" — eles descem
   em LINHAS HORIZONTAIS inteiras (um combo por linha, tipo
   "água ar fogo terra" lado a lado numa fileira só), uma
   linha atrás da outra. O jogador aperta o teclado de 4
   elementos na ordem da fileira (esquerda pra direita), o
   mais rápido possível, sem deixar nenhum símbolo passar da
   linha de baixo sem ser digitado.

   Apertar o botão certo (o do símbolo mais antigo ainda na
   fila) remove ele e soma ponto. Apertar o errado, ou deixar
   um símbolo passar da linha sem digitar, custa 1 vida. 3
   vidas erradas = fim de jogo. Novas fileiras continuam
   chegando o tempo todo, cada vez mais rápido e mais compridas.
========================================================= */

const COMBO_ELEMENTS = ['fogo', 'agua', 'ar', 'terra'];
const COMBO_EMOJI = { fogo: '🔥', agua: '💧', ar: '💨', terra: '🪨' };
const COMBO_COLOR = { fogo: '#E8794A', agua: '#2E6BB8', ar: '#A9CFE0', terra: '#9CAA5E' };

let comboGame = null;
let comboLastTs = 0;
let comboSeqCounter = 0;

/* ---------- abrir/fechar a tela ---------- */
function startCombo(){
  document.getElementById('screen-treinos').classList.remove('active');
  document.getElementById('screen-combo').classList.add('active');
  comboSetupButtons();
  comboResizeCanvas();
  comboLastTs = 0;
  comboSeqCounter = 0;
  comboGame = {
    active: true,
    score: 0, level: 1, lives: 3,
    queue: [], // {el, x, y, seq} — o próximo a digitar é sempre o de menor seq (ordem de leitura da fileira)
    lastSpawnAt: 0,
    rafId: null,
  };
  document.getElementById('comboScore').textContent = '0';
  document.getElementById('comboLevelLbl').textContent = '1';
  document.getElementById('comboVidas').textContent = '3';
  window.addEventListener('resize', comboResizeCanvas);
  comboGame.rafId = requestAnimationFrame(comboLoop);
}

function comboBack(){
  comboStopLoop();
  window.removeEventListener('resize', comboResizeCanvas);
  document.getElementById('screen-combo').classList.remove('active');
  document.getElementById('screen-treinos').classList.add('active');
}

function comboStopLoop(){
  if(comboGame){
    comboGame.active = false;
    if(comboGame.rafId) cancelAnimationFrame(comboGame.rafId);
  }
}

/* ---------- monta os 4 botões do teclado (uma vez só) ---------- */
function comboSetupButtons(){
  const row = document.getElementById('comboButtonRow');
  if(row.childElementCount === COMBO_ELEMENTS.length) return;
  row.innerHTML = '';
  COMBO_ELEMENTS.forEach((el)=>{
    const btn = document.createElement('button');
    btn.className = 'reflexo-btn reflexo-' + el;
    btn.textContent = COMBO_EMOJI[el];
    btn.style.touchAction = 'none';
    btn.addEventListener('pointerdown', function(e){
      e.preventDefault();
      comboHandlePress(el, btn);
    });
    row.appendChild(btn);
  });
}

/* ---------- canvas ---------- */
function comboResizeCanvas(){
  const canvas = document.getElementById('comboCanvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.flex = '1';
  canvas.style.touchAction = 'none';
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(rect.width, 200);
  const h = Math.max(rect.height, 300);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas._logicalW = w;
  canvas._logicalH = h;
}

/* ---------- dificuldade em função do nível ---------- */
function comboFallSpeed(level){ return 55 + level * 8; } // px/s — dá tempo de ler a fileira inteira
function comboSpawnInterval(level){ return Math.max(1300, 2600 - level * 120); } // ms entre fileiras novas
function comboRowSize(level){ return 3 + Math.min(Math.floor(level / 2), 4); } // cresce até 7 símbolos por fileira

/* ---------- loop principal ---------- */
function comboLoop(ts){
  if(!comboGame || !comboGame.active) return;
  if(!comboLastTs) comboLastTs = ts;
  const dt = Math.min((ts - comboLastTs) / 1000, 0.05);
  comboLastTs = ts;

  comboUpdate(ts, dt);
  comboDraw();

  comboGame.rafId = requestAnimationFrame(comboLoop);
}

function comboUpdate(ts, dt){
  const g = comboGame;
  g.level = 1 + Math.floor(g.score / 10);

  // só manda uma fileira nova quando a fila já esvaziou bastante, senão empilha demais
  if(ts - g.lastSpawnAt > comboSpawnInterval(g.level) && g.queue.length < 4){
    g.lastSpawnAt = ts;
    comboSpawnRow(g.level);
  }

  const canvas = document.getElementById('comboCanvas');
  const H = canvas._logicalH || 400;
  const missLine = H - 70;
  const speed = comboFallSpeed(g.level);
  for(let i = 0; i < g.queue.length; i++) g.queue[i].y += speed * dt;

  // o(s) símbolo(s) mais antigo(s) passou da linha sem ser digitado? conta erro e remove
  comboSortQueue();
  while(g.queue.length && g.queue[0].y > missLine){
    g.queue.shift();
    comboRegisterMiss();
    if(!g.active) return;
  }
}

/* Ordena a fila: primeiro por posição (quem já caiu mais fica na frente),
   e dentro da MESMA fileira (mesmo y), por ordem de leitura esquerda->direita. */
function comboSortQueue(){
  comboGame.queue.sort((a,b)=> (b.y - a.y) || (a.seq - b.seq));
}

/* Gera uma fileira nova: 3 a 7 símbolos lado a lado, na MESMA altura,
   espalhados horizontalmente. A fileira inteira desce junto. */
function comboSpawnRow(level){
  const size = comboRowSize(level);
  const rowGap = 100; // distância vertical entre uma fileira e a próxima
  let startY = -30;
  comboGame.queue.forEach(s=>{ if(s.y < startY) startY = s.y; });
  startY -= rowGap;

  const canvas = document.getElementById('comboCanvas');
  const W = canvas._logicalW || 300;
  const margin = 34;
  const usableW = Math.max(W - margin*2, 40);

  for(let i = 0; i < size; i++){
    const el = COMBO_ELEMENTS[Math.floor(Math.random() * COMBO_ELEMENTS.length)];
    const x = size > 1 ? (margin + (usableW * i) / (size - 1)) : W/2;
    comboGame.queue.push({ el, x, y: startY, seq: comboSeqCounter++ });
  }
  comboSortQueue();
}

/* ---------- entrada do jogador ---------- */
function comboHandlePress(el, btn){
  if(!comboGame || !comboGame.active) return;
  const g = comboGame;
  if(g.queue.length === 0) return; // nada pra digitar ainda

  const next = g.queue[0]; // o próximo esperado (mais antigo/mais à esquerda da fileira em jogo)
  if(next.el === el){
    g.queue.shift();
    g.score++;
    document.getElementById('comboScore').textContent = g.score;
    document.getElementById('comboLevelLbl').textContent = g.level;
    btn.classList.remove('miss'); btn.classList.add('ok');
    setTimeout(()=> btn.classList.remove('ok'), 150);
  } else {
    btn.classList.remove('ok'); btn.classList.add('miss');
    setTimeout(()=> btn.classList.remove('miss'), 220);
    comboRegisterMiss();
  }
}

function comboRegisterMiss(){
  if(!comboGame || !comboGame.active) return;
  comboGame.lives--;
  document.getElementById('comboVidas').textContent = Math.max(0, comboGame.lives);
  if(comboGame.lives <= 0) comboGameOver();
}

function comboGameOver(){
  const reward = Math.max(1, comboGame.score);
  state.stats.especial = (state.stats.especial || 0) + reward;
  saveState();
  toast('Fim de jogo! ' + comboGame.score + ' pontos · +' + reward + ' ✨');
  comboStopLoop();
  setTimeout(comboBack, 1400);
}

/* ---------- desenho ---------- */
function comboDraw(){
  const canvas = document.getElementById('comboCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas._logicalW || 300, H = canvas._logicalH || 400;
  ctx.clearRect(0, 0, W, H);

  const missLine = H - 70;

  // linha de "tem que digitar antes disso"
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(0, missLine); ctx.lineTo(W, missLine); ctx.stroke();
  ctx.setLineDash([]);

  if(comboGame){
    const nextSeq = comboGame.queue.length ? comboGame.queue[0].seq : -1;
    comboGame.queue.forEach(s=>{
      const isNext = s.seq === nextSeq;
      ctx.beginPath();
      ctx.arc(s.x, s.y, isNext ? 24 : 20, 0, Math.PI*2);
      ctx.fillStyle = COMBO_COLOR[s.el] + (isNext ? 'EE' : '99');
      ctx.fill();
      if(isNext){
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
      }
      ctx.font = (isNext ? '24px' : '20px') + ' sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(COMBO_EMOJI[s.el], s.x, s.y + 1);
    });
  }
}
