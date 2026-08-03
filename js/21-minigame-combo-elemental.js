/* =========================================================
   MINIGAME: COMBO ELEMENTAL (treina Resistência)
   ---------------------------------------------------------
   Diferente do Reflexo (19): aqui os símbolos não caem em
   pistas separadas pra apertar "na hora certa" — eles descem
   numa fila única, em grupos (combos, tipo "água água fogo
   terra ar ar"), e o jogador aperta o teclado de 4 elementos
   NA ORDEM CERTA, o mais rápido possível, sem deixar nenhum
   símbolo passar da linha de baixo sem ser digitado.

   Apertar o botão certo (o do símbolo mais antigo da fila)
   remove ele e soma ponto. Apertar o errado, ou deixar um
   símbolo passar da linha sem digitar, custa 1 vida. 3 vidas
   erradas = fim de jogo. Novos combos continuam chegando o
   tempo todo, cada vez mais rápido e mais compridos.
========================================================= */

const COMBO_ELEMENTS = ['fogo', 'agua', 'ar', 'terra'];
const COMBO_EMOJI = { fogo: '🔥', agua: '💧', ar: '💨', terra: '🪨' };
const COMBO_COLOR = { fogo: '#E8794A', agua: '#2E6BB8', ar: '#A9CFE0', terra: '#9CAA5E' };

let comboGame = null;
let comboLastTs = 0;

/* ---------- abrir/fechar a tela ---------- */
function startCombo(){
  document.getElementById('screen-treinos').classList.remove('active');
  document.getElementById('screen-combo').classList.add('active');
  comboSetupButtons();
  comboResizeCanvas();
  comboLastTs = 0;
  comboGame = {
    active: true,
    score: 0, level: 1, lives: 3,
    queue: [], // {el, y} — o mais antigo é sempre o de maior y (o que caiu mais)
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
function comboFallSpeed(level){ return 62 + level * 9; } // px/s — mais devagar que o Reflexo, dá tempo de ler a fila
function comboSpawnInterval(level){ return Math.max(1100, 2300 - level * 110); } // ms entre combos novos
function comboBatchSize(level){ return 2 + Math.min(Math.floor(level / 2), 4); } // cresce até 6 símbolos por combo

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
  g.level = 1 + Math.floor(g.score / 8);

  // só manda um combo novo quando a fila já esvaziou bastante, senão empilha demais
  if(ts - g.lastSpawnAt > comboSpawnInterval(g.level) && g.queue.length < 3){
    g.lastSpawnAt = ts;
    comboSpawnBatch(g.level);
  }

  const canvas = document.getElementById('comboCanvas');
  const H = canvas._logicalH || 400;
  const missLine = H - 60;
  const speed = comboFallSpeed(g.level);
  for(let i = g.queue.length - 1; i >= 0; i--){
    g.queue[i].y += speed * dt;
  }
  // o mais antigo (maior y) passou da linha sem ser digitado? conta erro e remove só ele
  while(g.queue.length && g.queue[0].y > missLine){
    g.queue.shift();
    comboRegisterMiss();
    if(!g.active) return;
  }
}

/* Gera um novo combo: uma sequência de 2 a 6 símbolos, espaçados verticalmente
   (o primeiro da sequência entra na frente/mais embaixo). */
function comboSpawnBatch(level){
  const size = comboBatchSize(level);
  const gap = 60; // espaço vertical entre símbolos do mesmo combo
  // encontra o y mais alto (mais negativo) já ocupado na fila, pra não sobrepor com o combo anterior
  let startY = -30;
  comboGame.queue.forEach(s=>{ if(s.y < startY) startY = s.y; });
  startY -= gap;
  for(let i = 0; i < size; i++){
    const el = COMBO_ELEMENTS[Math.floor(Math.random() * COMBO_ELEMENTS.length)];
    // índice 0 é o PRIMEIRO da sequência a ser digitado: fica mais embaixo (chega primeiro)
    const y = startY - i * gap;
    comboGame.queue.push({ el, y });
  }
  // garante ordem por posição (maior y primeiro) — já devia estar ordenado, mas confirma
  comboGame.queue.sort((a,b)=> b.y - a.y);
}

/* ---------- entrada do jogador ---------- */
function comboHandlePress(el, btn){
  if(!comboGame || !comboGame.active) return;
  const g = comboGame;
  if(g.queue.length === 0) return; // nada pra digitar ainda

  const next = g.queue[0]; // o mais antigo (maior y) é sempre o esperado agora
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
  state.stats.resistencia = (state.stats.resistencia || 0) + reward;
  saveState();
  toast('Fim de jogo! ' + comboGame.score + ' pontos · +' + reward + ' 💪');
  comboStopLoop();
  setTimeout(comboBack, 1400);
}

/* ---------- desenho ---------- */
function comboDraw(){
  const canvas = document.getElementById('comboCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas._logicalW || 300, H = canvas._logicalH || 400;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const missLine = H - 60;

  // linha de "tem que digitar antes disso"
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(0, missLine); ctx.lineTo(W, missLine); ctx.stroke();
  ctx.setLineDash([]);

  if(comboGame){
    comboGame.queue.forEach((s, i)=>{
      const isNext = i === 0;
      ctx.beginPath();
      ctx.arc(cx, s.y, isNext ? 26 : 21, 0, Math.PI*2);
      ctx.fillStyle = COMBO_COLOR[s.el] + (isNext ? 'EE' : '99');
      ctx.fill();
      if(isNext){
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
      }
      ctx.font = (isNext ? '28px' : '22px') + ' sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(COMBO_EMOJI[s.el], cx, s.y + 1);
    });
  }
}
