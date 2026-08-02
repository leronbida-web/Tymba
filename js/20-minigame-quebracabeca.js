/* =========================================================
   MINIGAME: QUEBRA-CABEÇA LÓGICO (estilo Tangram/jigsaw)
   — Tabuleiro 8x8 com 2-3 peças já fixas no lugar (dica)
   — Demais peças ficam numa "bandeja" abaixo do tabuleiro
   — Jogador arrasta com o dedo (pointer events) e pode rotacionar
     com 2 toques rápidos
   — Mesmas peças em todas as fases, só a posição-alvo muda
   — Fase N completada → +2^(N-1) de Inteligência (1, 2, 4, 8, 16...)
========================================================= */
const PUZZLE_GRID = 8;          // tabuleiro 8x8 (64 células)
const PUZZLE_TRAY_CELLS = 8;    // bandeja tem 8 colunas (vai "wrapando" se precisar de mais)

// ---------------- SET FIXO DE PEÇAS ----------------
const PUZZLE_PIECES_DEF = [
  { id: 'p1',  w: 2, h: 2, color: '#E57373', label: 'Vermelho' }, // 2x2
  { id: 'p2',  w: 4, h: 1, color: '#FFD65C', label: 'Âmbar'    }, // 1x4
  { id: 'p3',  w: 3, h: 1, color: '#B0BEC5', label: 'Cinza'    }, // 1x3
  { id: 'p4',  w: 2, h: 1, color: '#7FB3E5', label: 'Azul'     }, // 1x2
  { id: 'p5',  w: 1, h: 1, color: '#F5F5F5', label: 'Branco'   }, // 1x1
  { id: 'p6',  w: 2, h: 1, color: '#9CD3C0', label: 'Verde-água'}, // 1x2
  { id: 'p7',  w: 1, h: 1, color: '#C9B6E4', label: 'Lavanda'  }, // 1x1
  { id: 'p8',  w: 3, h: 1, color: '#E29B9B', label: 'Rosa'     }, // 1x3
  { id: 'p9',  w: 2, h: 2, color: '#7FAEDD', label: 'Azul-claro' }, // 2x2
  { id: 'p10', w: 4, h: 1, color: '#8A8A8A', label: 'Grafite'  }, // 1x4
  { id: 'p11', w: 1, h: 1, color: '#F4D35E', label: 'Amarelo'  }, // 1x1
  { id: 'p12', w: 2, h: 1, color: '#B5A8D6', label: 'Lilás'    }, // 1x2
];

// ---------------- RNG COM SEED ----------------
function puzzleRng(seed){
  let a = (seed | 0) || 1;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- GERAÇÃO DE FASE ----------------
function puzzleGenerateLevel(phaseNum){
  const rng = puzzleRng(0xC0FFEE * phaseNum + 7);
  const sol = {};
  const occupied = new Set();
  function key(x,y){ return x + ',' + y; }
  function canPlaceAt(x, y, w, h){
    if(x < 0 || y < 0 || x + w > PUZZLE_GRID || y + h > PUZZLE_GRID) return false;
    for(let i=0;i<w;i++) for(let j=0;j<h;j++){
      if(occupied.has(key(x+i, y+j))) return false;
    }
    return true;
  }
  function mark(x, y, w, h){
    for(let i=0;i<w;i++) for(let j=0;j<h;j++) occupied.add(key(x+i, y+j));
  }
  const order = PUZZLE_PIECES_DEF.slice().sort(() => rng() - 0.5);
  for(const def of order){
    const rot = rng() < 0.5 ? 0 : 1;
    const w = rot ? def.h : def.w;
    const h = rot ? def.w : def.h;
    const cells = [];
    for(let i=0;i<PUZZLE_GRID;i++) for(let j=0;j<PUZZLE_GRID;j++) cells.push([i,j]);
    for(let i=cells.length-1;i>0;i--){
      const k = Math.floor(rng()*(i+1));
      [cells[i], cells[k]] = [cells[k], cells[i]];
    }
    let chosen = null;
    for(const [x,y] of cells){
      if(canPlaceAt(x, y, w, h)){ chosen = {gx:x, gy:y, rot}; break; }
    }
    if(chosen){
      sol[def.id] = { gx:chosen.gx, gy:chosen.gy, rot:chosen.rot };
      mark(chosen.gx, chosen.gy, w, h);
    } else {
      sol[def.id] = null;
    }
  }
  const candidates = Object.keys(sol).filter(id => sol[id] !== null);
  candidates.sort((a,b) => {
    const A = PUZZLE_PIECES_DEF.find(p=>p.id===a);
    const B = PUZZLE_PIECES_DEF.find(p=>p.id===b);
    return (B.w*B.h) - (A.w*A.h);
  });
  const numFixed = (phaseNum % 2 === 0) ? 3 : 2;
  const fixed = candidates.slice(0, Math.min(numFixed, candidates.length));
  return { solution: sol, fixed };
}

// ---------------- ESTADO DO JOGO ----------------
let puzzlePhase = 1;
let puzzleSolution = null;
let puzzleFixed = [];
let puzzlePieces = [];
let puzzleSolved = false;
let puzzleDrag = null;
let puzzleLastTap = {};
let puzzleCellPx = 40;      // tamanho de 1 célula do TABULEIRO (px) — recalculado a cada render
let puzzleTrayCellPx = 18;  // tamanho de 1 célula da BANDEJA (px) — bem menor

// ---------------- HELPERS DE GEOMETRIA ----------------
function puzzleCurrentDims(piece){
  return piece.rot ? { w: piece.def.h, h: piece.def.w } : { w: piece.def.w, h: piece.def.h };
}
function puzzlePieceCells(piece){
  const { w, h } = puzzleCurrentDims(piece);
  const cells = [];
  for(let i=0;i<w;i++) for(let j=0;j<h;j++) cells.push([piece.gx + i, piece.gy + j]);
  return cells;
}
// retorna o tamanho em pixels de uma peça no TABULEIRO (= célula do tabuleiro)
function puzzleBoardPieceSize(piece){
  const { w, h } = puzzleCurrentDims(piece);
  return { wpx: w * puzzleCellPx, hpx: h * puzzleCellPx };
}
// retorna o tamanho em pixels de uma peça na BANDEJA (= célula menor da bandeja)
function puzzleTrayPieceSize(piece){
  const { w, h } = puzzleCurrentDims(piece);
  return { wpx: w * puzzleTrayCellPx, hpx: h * puzzleTrayCellPx };
}

// ---------------- SETUP DE FASE ----------------
function puzzleSetupLevel(phaseNum){
  puzzlePhase = phaseNum;
  const { solution, fixed } = puzzleGenerateLevel(phaseNum);
  puzzleSolution = solution;
  puzzleFixed = fixed;

  puzzlePieces = PUZZLE_PIECES_DEF.map(def => {
    const sol = puzzleSolution[def.id];
    if(!sol) return null; // peça que não coube na geração — some do jogo
    const isFixed = puzzleFixed.includes(def.id);
    const rot = sol.rot;
    const gx = sol.gx;
    const gy = sol.gy;
    return {
      def,
      rot,
      gx,
      gy,
      inTray: !isFixed, // fixas começam no tabuleiro, todas as outras na bandeja
      fixed: isFixed,
      el: null,
    };
  }).filter(p => p !== null);

  puzzleRender();
  puzzleRefreshHud();
}

function puzzleRefreshHud(){
  document.getElementById('puzzlePhase').textContent = puzzlePhase;
  const reward = Math.pow(2, puzzlePhase - 1);
  document.getElementById('puzzleNextReward').textContent = '+' + reward + ' 🧠';
  document.getElementById('puzzleBest').textContent = state.puzzleBest || 0;
  // quantas peças estão no lugar certo? (exclui peças fixas, que já contam como corretas)
  const { correct, total } = puzzleCountCorrect();
  document.getElementById('puzzleCorrect').textContent = correct;
  document.getElementById('puzzleTotal').textContent = total;
}

// conta quantas peças estão na posição+rotação corretas. Peças fixas contam como corretas.
function puzzleCountCorrect(){
  let correct = 0;
  const total = puzzlePieces.length;
  for(const piece of puzzlePieces){
    if(piece.fixed){ correct++; continue; }
    const sol = puzzleSolution[piece.def.id];
    if(!sol) continue;
    if(!piece.inTray && piece.gx === sol.gx && piece.gy === sol.gy && piece.rot === sol.rot){
      correct++;
    }
  }
  return { correct, total };
}

// marca visualmente uma peça como correta (verde) ou errada (vermelho por 600ms)
function puzzleMarkPiece(piece, status){
  if(!piece.el) return;
  piece.el.classList.remove('correct', 'wrong');
  if(status === 'correct'){
    piece.el.classList.add('correct');
  } else if(status === 'wrong'){
    piece.el.classList.add('wrong');
    setTimeout(() => { if(piece.el) piece.el.classList.remove('wrong'); }, 600);
  }
}

// ---------------- RENDER ----------------
function puzzleRender(){
  const board = document.getElementById('puzzleBoard');
  const tray = document.getElementById('puzzleTray');
  if(!board || !tray) return;

  // ---- calcula o tamanho da célula do tabuleiro com base no que o CSS deixou
  // O CSS dá ao board `width = min(360px, 92vw)` e `aspect-ratio: 1/1`. Deixa o
  // layout assentar e mede.
  const boardW = board.clientWidth;
  if(boardW > 0){
    puzzleCellPx = (boardW - 12 /* padding */ - 7*2 /* 7 gaps de 2px */) / PUZZLE_GRID;
  } else {
    puzzleCellPx = 40;
  }
  // bandeja: as peças na bandeja têm escala 0.5 (menores, pra caber mais)
  puzzleTrayCellPx = Math.max(14, Math.floor(puzzleCellPx * 0.42));

  // ---- tabuleiro
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${PUZZLE_GRID}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${PUZZLE_GRID}, 1fr)`;
  for(let r=0;r<PUZZLE_GRID;r++){
    for(let c=0;c<PUZZLE_GRID;c++){
      const cell = document.createElement('div');
      cell.className = 'puzzle-cell';
      cell.dataset.gx = c;
      cell.dataset.gy = r;
      board.appendChild(cell);
    }
  }

  // ---- bandeja
  tray.innerHTML = '';

  // ---- peças
  for(const piece of puzzlePieces){
    const el = document.createElement('div');
    el.className = 'puzzle-piece';
    if(piece.fixed) el.classList.add('fixed', 'correct'); // fixas já contam como corretas
    el.style.background = piece.def.color;
    if(piece.rot) el.classList.add('rot90');
    piece.el = el;
    if(piece.inTray){
      puzzleApplyTraySize(piece);
      tray.appendChild(el);
    } else {
      puzzleApplyBoardSize(piece);
      board.appendChild(el);
    }
    puzzleAttachPieceEvents(piece);
  }
}

// aplica o tamanho do tabuleiro (grid-column/row com span)
function puzzleApplyBoardSize(piece){
  const el = piece.el;
  const { w, h } = puzzleCurrentDims(piece);
  el.style.gridColumn = `${piece.gx + 1} / span ${w}`;
  el.style.gridRow    = `${piece.gy + 1} / span ${h}`;
  el.style.width  = (w * puzzleCellPx) + 'px';
  el.style.height = (h * puzzleCellPx) + 'px';
}

// aplica o tamanho da bandeja (largura/altura em pixels, sem grid)
function puzzleApplyTraySize(piece){
  const el = piece.el;
  const { w, h } = puzzleCurrentDims(piece);
  el.style.gridColumn = '';
  el.style.gridRow = '';
  el.style.width  = (w * puzzleTrayCellPx) + 'px';
  el.style.height = (h * puzzleTrayCellPx) + 'px';
}

// reaplica tudo de uma peça depois de mexer em gx/gy/rot
function puzzleRepositionPiece(piece){
  if(piece.inTray) puzzleApplyTraySize(piece);
  else             puzzleApplyBoardSize(piece);
}

// ---------------- EVENTOS DAS PEÇAS ----------------
// Estratégia de drag:
// 1) A peça GANHA `position: fixed` mas PERMANECE no mesmo parent (bandeja ou tabuleiro).
//    Assim, ela "flutua" sobre a tela mas continua no DOM tree, e os event listeners
//    dela continuam disparando normalmente.
// 2) `setPointerCapture` garante que TODOS os pointermove/pointerup vão pra ela
//    enquanto o usuário tá arrastando, mesmo se o dedo sair da área visual da peça.
// 3) Ao soltar, removemos `position: fixed` e re-anexamos no parent correto
//    (bandeja ou tabuleiro) conforme a posição onde foi solto.
function puzzleAttachPieceEvents(piece){
  const el = piece.el;
  el.addEventListener('pointerdown', (e) => {
    if(puzzleSolved) return;
    if(piece.fixed) return;
    e.preventDefault();
    e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch(_) {}
    puzzleBeginDrag(piece, e);
  });
  el.addEventListener('pointermove', (e) => {
    if(!puzzleDrag || puzzleDrag.piece !== piece) return;
    puzzleDragMove(e);
  });
  el.addEventListener('pointerup', (e) => {
    if(!puzzleDrag || puzzleDrag.piece !== piece) return;
    try { el.releasePointerCapture(e.pointerId); } catch(_) {}
    puzzleEndDrag(e);
  });
  el.addEventListener('pointercancel', () => {
    if(!puzzleDrag || puzzleDrag.piece !== piece) return;
    puzzleCancelDrag();
  });
}

function puzzleBeginDrag(piece, e){
  // ---- double-tap = rotaciona (somente se a peça ainda tá na bandeja)
  if(piece.inTray){
    const now = Date.now();
    const last = puzzleLastTap[piece.def.id] || 0;
    if(now - last < 280){
      piece.rot = piece.rot ? 0 : 1;
      const el = piece.el;
      el.classList.toggle('rot90', !!piece.rot);
      puzzleRepositionPiece(piece);
      puzzleLastTap[piece.def.id] = 0;
      return;
    }
    puzzleLastTap[piece.def.id] = now;
  }

  // ---- guarda a posição visual atual ANTES de mudar nada
  const el = piece.el;
  const r = el.getBoundingClientRect();
  const dragW = r.width;
  const dragH = r.height;

  // tira do grid (caso estivesse no tabuleiro) pra ela poder usar left/top absolutos
  el.style.gridColumn = '';
  el.style.gridRow = '';
  el.style.position = 'fixed';
  el.style.left   = r.left + 'px';
  el.style.top    = r.top  + 'px';
  el.style.width  = dragW + 'px';
  el.style.height = dragH + 'px';
  el.style.zIndex = '1000';
  el.style.margin = '0';
  el.classList.add('dragging');

  puzzleDrag = {
    piece,
    offsetX: e.clientX - r.left,
    offsetY: e.clientY - r.top,
    pointerId: e.pointerId,
    inTrayAtStart: piece.inTray,
    originalGx: piece.gx,
    originalGy: piece.gy,
    startLeft: r.left,
    startTop:  r.top,
  };
  // durante o drag, a peça não tem lugar fixo
  piece.inTray = false;
}

function puzzleDragMove(e){
  if(!puzzleDrag) return;
  const el = puzzleDrag.piece.el;
  el.style.left = (e.clientX - puzzleDrag.offsetX) + 'px';
  el.style.top  = (e.clientY - puzzleDrag.offsetY) + 'px';
}

function puzzleEndDrag(e){
  if(!puzzleDrag) return;
  const piece = puzzleDrag.piece;
  const el = piece.el;

  // centro da peça
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;

  const board = document.getElementById('puzzleBoard');
  const tray  = document.getElementById('puzzleTray');
  const boardR = board.getBoundingClientRect();
  const trayR  = tray.getBoundingClientRect();

  const droppedOnBoard = (cx >= boardR.left && cx <= boardR.right && cy >= boardR.top && cy <= boardR.bottom);
  const droppedOnTray  = (cx >= trayR.left  && cx <= trayR.right  && cy >= trayR.top  && cy <= trayR.bottom);

  // tira a classe e os estilos de drag (mantém no mesmo parent, vai só reposicionar)
  el.classList.remove('dragging');
  el.style.position = '';
  el.style.left = '';
  el.style.top = '';
  el.style.zIndex = '';
  el.style.margin = '';
  // (width/height/grid vão ser re-aplicados em puzzleRepositionPiece)

  if(droppedOnBoard){
    // re-anexa no board e calcula a célula
    if(el.parentNode !== board) board.appendChild(el);
    const localX = cx - boardR.left;
    const localY = cy - boardR.top;
    const { w, h } = puzzleCurrentDims(piece);
    const gx = Math.round((localX - w*puzzleCellPx/2) / puzzleCellPx);
    const gy = Math.round((localY - h*puzzleCellPx/2) / puzzleCellPx);
    if(gx >= 0 && gy >= 0 && gx + w <= PUZZLE_GRID && gy + h <= PUZZLE_GRID
       && puzzleCanPlaceAt(gx, gy, w, h, piece)){
      piece.gx = gx; piece.gy = gy; piece.inTray = false;
      puzzleRepositionPiece(piece);
      // feedback visual: a peça tá na posição+rotação certas da solução?
      const sol = puzzleSolution[piece.def.id];
      if(sol && piece.gx === sol.gx && piece.gy === sol.gy && piece.rot === sol.rot){
        puzzleMarkPiece(piece, 'correct');
        // se a peça veio de outra posição do tabuleiro, limpa o estado da posição anterior
        // (não precisa fazer nada, o gx/gy já foram atualizados)
      } else {
        puzzleMarkPiece(piece, 'wrong');
      }
      puzzleRefreshHud();
      puzzleCheckSolved();
    } else {
      // lugar inválido — volta pro lugar de origem
      piece.gx = puzzleDrag.originalGx; piece.gy = puzzleDrag.originalGy;
      piece.inTray = puzzleDrag.inTrayAtStart;
      if(piece.inTray && el.parentNode !== tray) tray.appendChild(el);
      else if(!piece.inTray && el.parentNode !== board) board.appendChild(el);
      puzzleRepositionPiece(piece);
      if(!puzzleDrag.inTrayAtStart){
        toast('Posição inválida');
        puzzleMarkPiece(piece, 'wrong');
      }
    }
  } else if(droppedOnTray){
    // soltou na bandeja — vai pra bandeja
    if(el.parentNode !== tray) tray.appendChild(el);
    piece.gx = 0; piece.gy = 0; piece.inTray = true;
    puzzleRepositionPiece(piece);
  } else {
    // soltou fora de qualquer lugar — volta pro lugar de origem
    piece.gx = puzzleDrag.originalGx; piece.gy = puzzleDrag.originalGy;
    piece.inTray = puzzleDrag.inTrayAtStart;
    if(piece.inTray && el.parentNode !== tray) tray.appendChild(el);
    else if(!piece.inTray && el.parentNode !== board) board.appendChild(el);
    puzzleRepositionPiece(piece);
  }

  puzzleDrag = null;
}

function puzzleCancelDrag(){
  if(!puzzleDrag) return;
  const piece = puzzleDrag.piece;
  const el = piece.el;
  el.classList.remove('dragging');
  el.style.position = '';
  el.style.left = '';
  el.style.top = '';
  el.style.zIndex = '';
  el.style.margin = '';
  if(piece.inTray && el.parentNode !== document.getElementById('puzzleTray')){
    document.getElementById('puzzleTray').appendChild(el);
  } else if(!piece.inTray && el.parentNode !== document.getElementById('puzzleBoard')){
    document.getElementById('puzzleBoard').appendChild(el);
  }
  puzzleRepositionPiece(piece);
  puzzleDrag = null;
}

function puzzleCanPlaceAt(gx, gy, w, h, exceptPiece){
  for(let i=0;i<w;i++) for(let j=0;j<h;j++){
    const x = gx+i, y = gy+j;
    for(const p of puzzlePieces){
      if(p === exceptPiece) continue;
      if(p.inTray) continue;
      const { w:pw, h:ph } = puzzleCurrentDims(p);
      if(x >= p.gx && x < p.gx + pw && y >= p.gy && y < p.gy + ph) return false;
    }
  }
  return true;
}

// ---------------- VITÓRIA / RECOMPENSA ----------------
function puzzleCheckSolved(){
  if(puzzleSolved) return;
  const { correct, total } = puzzleCountCorrect();
  if(correct >= total){
    puzzleSolved = true;
    setTimeout(puzzleClaimReward, 600);
  }
}

function puzzleClaimReward(){
  const statGain = Math.pow(2, puzzlePhase - 1);
  const coinGain = Math.max(5, statGain * 3);
  if(puzzlePhase > (state.puzzleBest || 0)) state.puzzleBest = puzzlePhase;
  saveState();
  finishTraining('screen-puzzle', 'inteligencia', statGain, coinGain,
    `Fase ${puzzlePhase} completa! 🧩`, `+${statGain} de Inteligência. Próxima fase rende ${statGain*2}.`);
  setTimeout(() => { puzzlePhase++; puzzleSolved = false; }, 500);
}

// ---------------- START / BACK ----------------
function startPuzzle(){
  hideAllScreens();
  document.getElementById('screen-puzzle').classList.add('active');
  puzzleSolved = false;
  if(!puzzleSolution) puzzlePhase = (state.puzzleBest || 0) + 1;
  // garante um pequeno delay pra o browser assentar o layout antes de medir
  requestAnimationFrame(() => requestAnimationFrame(() => puzzleSetupLevel(puzzlePhase)));
}

function puzzleBack(){
  if(puzzleSolved) return;
  document.getElementById('screen-puzzle').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  renderHome();
}

// expõe a fase atual no escopo global (debug)
function puzzleGetState(){
  return { phase: puzzlePhase, pieces: puzzlePieces.map(p => ({
    id: p.def.id, rot: p.rot, gx: p.gx, gy: p.gy, inTray: p.inTray, fixed: p.fixed
  })) };
}
