/* =========================================================
   MINIGAME: QUEBRA-CABEÇA LÓGICO (estilo Tangram/jigsaw)
   — Tabuleiro 8x8 com 2-3 peças já fixas no lugar (dica)
   — Demais peças ficam numa "bandeja" abaixo do tabuleiro
   — Jogador arrasta com o dedo (pointer events) e pode rotacionar
     com 2 toques rápidos (ou botão de rotação)
   — Mesmas peças em todas as fases, só a posição-alvo muda
   — Fase N completada → +2^(N-1) de Inteligência (1, 2, 4, 8, 16...)
========================================================= */
const PUZZLE_GRID = 8;                 // tabuleiro 8x8 (64 células)
const PUZZLE_TRAY_MAX_H = 130;         // altura máxima da bandeja (px) — força scroll horizontal se precisar

// ---------------- SET FIXO DE PEÇAS ----------------
// Cada peça: { id, w, h, color, label }  (w/h em células)
// Cores suaves combinando com o tema do jogo (roxo/lavanda, azul, âmbar, etc.)
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
// área total: 4+4+3+2+1+2+1+3+4+4+1+2 = 31 (a "solução" cobre metade do tabuleiro;
// o resto fica vazio — isso combina com o estilo da imagem 1 onde a maioria das
// peças não preenche tudo, deixando o "chão" da moldura visível)

// ---------------- RNG COM SEED ----------------
function puzzleRng(seed){
  // mulberry32 — gerador simples e estável
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
// Retorna: { solution: { peçaId -> {gx,gy,rot} }, fixed: [peçaId,...] }
// `solution` é a posição "correta" de cada peça (incluindo as fixas, mas essas o
// jogador não mexe). `fixed` lista quais peças já aparecem travadas no tabuleiro
// no início da fase — são a dica.
function puzzleGenerateLevel(phaseNum){
  // Semear com phaseNum pra cada fase ter layout único mas reproduzível
  const rng = puzzleRng(0xC0FFEE * phaseNum + 7);
  const placed = new Map(); // id -> {gx, gy, rot, w, h, color}
  const sol = {};
  const occupied = new Set(); // "gx,gy"

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

  // embaralha a ordem de tentativa das peças
  const order = PUZZLE_PIECES_DEF.slice().sort(() => rng() - 0.5);

  for(const def of order){
    // tenta rotacionar (0 ou 90) aleatoriamente
    const rot = rng() < 0.5 ? 0 : 1;
    const w = rot ? def.h : def.w;
    const h = rot ? def.w : def.h;
    // tenta posições aleatórias (até 200 tentativas)
    let chosen = null;
    const cells = [];
    for(let i=0;i<PUZZLE_GRID;i++) for(let j=0;j<PUZZLE_GRID;j++) cells.push([i,j]);
    // embaralha cells de forma estável
    for(let i=cells.length-1;i>0;i--){
      const k = Math.floor(rng()*(i+1));
      [cells[i], cells[k]] = [cells[k], cells[i]];
    }
    for(const [x,y] of cells){
      if(canPlaceAt(x, y, w, h)){
        chosen = {gx:x, gy:y, rot, w, h};
        break;
      }
    }
    if(chosen){
      sol[def.id] = { gx:chosen.gx, gy:chosen.gy, rot:chosen.rot };
      mark(chosen.gx, chosen.gy, chosen.w, chosen.h);
    } else {
      // peça não cabe — fica como "extra" (não faz parte da solução)
      sol[def.id] = null;
    }
  }

  // escolhe 2 ou 3 peças pra ficarem fixas no tabuleiro (de preferência 2x2 ou maiores,
  // porque dão uma dica mais útil). Só pega peças que estão no solution.
  const candidates = Object.keys(sol).filter(id => sol[id] !== null);
  candidates.sort((a,b) => {
    const A = PUZZLE_PIECES_DEF.find(p=>p.id===a);
    const B = PUZZLE_PIECES_DEF.find(p=>p.id===b);
    return (B.w*B.h) - (A.w*A.h); // maiores primeiro
  });
  // phaseNum ímpar = 2 fixas, par = 3 fixas (varia pra não ficar repetitivo)
  const numFixed = (phaseNum % 2 === 0) ? 3 : 2;
  const fixed = candidates.slice(0, Math.min(numFixed, candidates.length));

  return { solution: sol, fixed };
}

// ---------------- ESTADO DO JOGO ----------------
let puzzlePhase = 1;             // fase atual
let puzzleSolution = null;       // { peçaId -> {gx,gy,rot} } da fase atual
let puzzleFixed = [];            // ids das peças travadas no tabuleiro
let puzzlePieces = [];           // estado runtime das peças: { def, rot, gx, gy, inTray, el, dragging }
let puzzleSolved = false;
let puzzleDrag = null;           // { piece, offsetX, offsetY, pointerId }
let puzzleLastTap = {};          // { peçaId -> timestamp } pro double-tap rotaciona
let puzzleTapTimeout = null;
let puzzleRAF = null;

// ---------------- HELPERS DE GEOMETRIA ----------------
function puzzleCurrentDims(piece){
  // retorna {w, h} da peça na rotação atual
  return piece.rot ? { w: piece.def.h, h: piece.def.w } : { w: piece.def.w, h: piece.def.h };
}
function puzzlePieceCells(piece){
  // retorna as células que a peça ocupa (considerando rotação)
  const { w, h } = puzzleCurrentDims(piece);
  const cells = [];
  for(let i=0;i<w;i++) for(let j=0;j<h;j++) cells.push([piece.gx + i, piece.gy + j]);
  return cells;
}
function puzzleCellSize(){
  // tamanho em px de 1 célula do tabuleiro (calculado a partir do board)
  const board = document.getElementById('puzzleBoard');
  if(!board) return 40;
  return board.clientWidth / PUZZLE_GRID;
}

// ---------------- INICIALIZAÇÃO DE FASE ----------------
function puzzleSetupLevel(phaseNum){
  puzzlePhase = phaseNum;
  const { solution, fixed } = puzzleGenerateLevel(phaseNum);
  puzzleSolution = solution;
  puzzleFixed = fixed;

  // monta peças: as que estão no solution viram peças de tabuleiro;
  // as que não couberam (sol[def.id] === null) ficam na bandeja
  puzzlePieces = PUZZLE_PIECES_DEF.map(def => {
    const sol = puzzleSolution[def.id];
    const isFixed = puzzleFixed.includes(def.id);
    let rot = 0;
    let gx = 0, gy = 0, inTray = true;
    if(sol){
      rot = sol.rot;
      gx = sol.gx; gy = sol.gy;
    }
    if(sol && !isFixed){
      inTray = true; // começa na bandeja, jogador tem que arrastar pro tabuleiro
      gx = 0; gy = 0; // posição "fake" na bandeja
    }
    if(isFixed){
      inTray = false; // já começa no tabuleiro, travada
    }
    return { def, rot, gx, gy, inTray, fixed: isFixed, el: null };
  });

  puzzleRender();
  puzzleRefreshHud();
}

function puzzleRefreshHud(){
  document.getElementById('puzzlePhase').textContent = puzzlePhase;
  // próxima recompensa: 2^(N-1) de inteligência
  const reward = Math.pow(2, puzzlePhase - 1);
  document.getElementById('puzzleNextReward').textContent = '+' + reward + ' 🧠';
  document.getElementById('puzzleBest').textContent = state.puzzleBest || 0;
}

// ---------------- RENDER ----------------
function puzzleRender(){
  const board = document.getElementById('puzzleBoard');
  const tray = document.getElementById('puzzleTray');
  if(!board || !tray) return;

  // limpa tudo (re-render completo é mais simples que diff, e é só 12 peças)
  board.innerHTML = '';
  tray.innerHTML = '';

  // grid do tabuleiro
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

  // peças
  for(const piece of puzzlePieces){
    const el = document.createElement('div');
    el.className = 'puzzle-piece';
    if(piece.fixed) el.classList.add('fixed');
    el.style.background = piece.def.color;
    const { w, h } = puzzleCurrentDims(piece);
    if(piece.rot) el.classList.add('rot90');
    piece.el = el;
    puzzlePositionPiece(piece);
    puzzleAttachPieceEvents(piece);
    if(piece.inTray) tray.appendChild(el);
    else board.appendChild(el);
  }
}

function puzzlePositionPiece(piece){
  const el = piece.el;
  if(!el) return;
  if(piece.inTray){
    el.style.gridColumn = 'auto';
    el.style.gridRow = 'auto';
  } else {
    // ocupa células gx..gx+w-1 e gy..gy+h-1 (CSS grid é 1-indexed)
    const { w, h } = puzzleCurrentDims(piece);
    el.style.gridColumn = `${piece.gx + 1} / span ${w}`;
    el.style.gridRow = `${piece.gy + 1} / span ${h}`;
  }
}

// ---------------- INTERAÇÃO: DRAG / TAP / ROTAÇÃO ----------------
function puzzleAttachPieceEvents(piece){
  const el = piece.el;
  el.addEventListener('pointerdown', (e) => {
    if(puzzleSolved) return;
    if(piece.fixed) return; // não pode mexer em peça fixa
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    puzzleBeginDrag(piece, e);
  });
  el.addEventListener('pointermove', (e) => {
    if(!puzzleDrag || puzzleDrag.piece !== piece) return;
    puzzleDragMove(e);
  });
  el.addEventListener('pointerup', (e) => {
    if(!puzzleDrag || puzzleDrag.piece !== piece) return;
    puzzleEndDrag(e);
  });
  el.addEventListener('pointercancel', () => {
    puzzleCancelDrag();
  });
}

function puzzleBeginDrag(piece, e){
  // double-tap = rotaciona (somente se a peça ainda tá na bandeja)
  if(piece.inTray){
    const now = Date.now();
    const last = puzzleLastTap[piece.def.id] || 0;
    if(now - last < 280){
      piece.rot = piece.rot ? 0 : 1;
      el = piece.el;
      el.classList.toggle('rot90', !!piece.rot);
      puzzleLastTap[piece.def.id] = 0;
      return;
    }
    puzzleLastTap[piece.def.id] = now;
  }

  // tira a peça do tabuleiro/bandeja e bota no "drag layer" pra poder flutuar livre
  const layer = document.getElementById('puzzleDragLayer');
  if(!layer) return;
  const r = piece.el.getBoundingClientRect();
  // copia o estilo visual pro layer
  piece.el.style.position = 'fixed';
  piece.el.style.left = r.left + 'px';
  piece.el.style.top = r.top + 'px';
  piece.el.style.width = r.width + 'px';
  piece.el.style.height = r.height + 'px';
  piece.el.style.gridColumn = '';
  piece.el.style.gridRow = '';
  piece.el.classList.add('dragging');
  layer.appendChild(piece.el);

  puzzleDrag = {
    piece,
    offsetX: e.clientX - r.left,
    offsetY: e.clientY - r.top,
    pointerId: e.pointerId,
    inTrayAtStart: piece.inTray,
    originalGx: piece.gx,
    originalGy: piece.gy,
  };
  piece.inTray = false; // durante o drag a peça não está em lugar nenhum fixo
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
  el.releasePointerCapture(puzzleDrag.pointerId);

  // pra onde o jogador soltou? — usa o centro da peça
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top + r.height/2;

  const board = document.getElementById('puzzleBoard');
  const tray = document.getElementById('puzzleTray');
  const boardR = board.getBoundingClientRect();
  const trayR = tray.getBoundingClientRect();

  const droppedOnBoard = (cx >= boardR.left && cx <= boardR.right && cy >= boardR.top && cy <= boardR.bottom);
  const droppedOnTray  = (cx >= trayR.left  && cx <= trayR.right  && cy >= trayR.top  && cy <= trayR.bottom);

  // tira do drag layer
  const layer = document.getElementById('puzzleDragLayer');
  if(layer) layer.removeChild(el);
  el.classList.remove('dragging');
  el.style.position = '';
  el.style.left = '';
  el.style.top = '';
  el.style.width = '';
  el.style.height = '';

  if(droppedOnBoard){
    // converte posição em pixels pra célula do tabuleiro
    const cell = puzzleCellSize();
    const localX = cx - boardR.left;
    const localY = cy - boardR.top;
    const { w, h } = puzzleCurrentDims(piece);
    // alinha pelo canto top-left mais próximo (pra peça "encaixar" na grade)
    const gx = Math.round((localX - w*cell/2) / cell);
    const gy = Math.round((localY - h*cell/2) / cell);
    // valida: dentro do tabuleiro, sem overlap com outras peças, e === posição-alvo
    if(gx >= 0 && gy >= 0 && gx + w <= PUZZLE_GRID && gy + h <= PUZZLE_GRID
       && puzzleCanPlaceAt(gx, gy, w, h, piece)){
      piece.gx = gx; piece.gy = gy; piece.inTray = false;
      board.appendChild(el);
      puzzlePositionPiece(piece);
      // checa se a fase tá completa
      puzzleCheckSolved();
    } else {
      // lugar inválido — volta pra bandeja
      piece.gx = puzzleDrag.originalGx; piece.gy = puzzleDrag.originalGy;
      piece.inTray = true;
      tray.appendChild(el);
      puzzlePositionPiece(piece);
      if(!puzzleDrag.inTrayAtStart) toast('Posição inválida');
    }
  } else {
    // soltou fora do tabuleiro → volta pra bandeja
    piece.gx = puzzleDrag.originalGx; piece.gy = puzzleDrag.originalGy;
    piece.inTray = true;
    tray.appendChild(el);
    puzzlePositionPiece(piece);
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
  el.style.width = '';
  el.style.height = '';
  if(piece.inTray) document.getElementById('puzzleTray').appendChild(el);
  else document.getElementById('puzzleBoard').appendChild(el);
  puzzlePositionPiece(piece);
  puzzleDrag = null;
}

function puzzleCanPlaceAt(gx, gy, w, h, exceptPiece){
  for(let i=0;i<w;i++) for(let j=0;j<h;j++){
    const x = gx+i, y = gy+j;
    for(const p of puzzlePieces){
      if(p === exceptPiece) continue;
      if(p.inTray) continue;
      if(p.fixed) continue; // peça fixa é tratada como "obstáculo permanente"
      const { w:pw, h:ph } = puzzleCurrentDims(p);
      // se a peça p ocupa a célula (x,y), conflita
      if(x >= p.gx && x < p.gx + pw && y >= p.gy && y < p.gy + ph) return false;
    }
    // também não pode pisar em peça fixa
    for(const p of puzzlePieces){
      if(!p.fixed || p.inTray) continue;
      if(p === exceptPiece) continue;
      const { w:pw, h:ph } = puzzleCurrentDims(p);
      if(x >= p.gx && x < p.gx + pw && y >= p.gy && y < p.gy + ph) return false;
    }
  }
  return true;
}

// ---------------- VITÓRIA / RECOMPENSA ----------------
function puzzleCheckSolved(){
  // pra vencer, todas as peças da solução (não-nulas) precisam estar no tabuleiro
  // na posição + rotação certas
  for(const def of PUZZLE_PIECES_DEF){
    const sol = puzzleSolution[def.id];
    if(!sol) continue; // peça que não coube na solução
    const piece = puzzlePieces.find(p => p.def.id === def.id);
    if(piece.inTray) return; // ainda tá na bandeja
    if(piece.gx !== sol.gx || piece.gy !== sol.gy || piece.rot !== sol.rot) return;
  }
  // venceu!
  puzzleSolved = true;
  setTimeout(puzzleClaimReward, 500);
}

function puzzleClaimReward(){
  // recompensa: 2^(N-1) de inteligência + algumas moedas
  const statGain = Math.pow(2, puzzlePhase - 1);
  const coinGain = Math.max(5, statGain * 3);
  if(puzzlePhase > (state.puzzleBest || 0)) state.puzzleBest = puzzlePhase;
  saveState();
  finishTraining('screen-puzzle', 'inteligencia', statGain, coinGain,
    `Fase ${puzzlePhase} completa! 🧩`, `+${statGain} de Inteligência. Próxima fase rende ${statGain*2}.`);
  // prepara a próxima fase pra quando o jogador voltar
  setTimeout(() => { puzzlePhase++; puzzleSolved = false; }, 500);
}

// ---------------- START / BACK ----------------
function startPuzzle(){
  hideAllScreens();
  document.getElementById('screen-puzzle').classList.add('active');
  puzzleSolved = false;
  if(!puzzleSolution) puzzlePhase = 1;
  puzzleSetupLevel(puzzlePhase);
}

function puzzleBack(){
  // sai dando metade da recompensa parcial (não premiamos ficar saindo,
  // mas também não punimos — devolve o que acumulou na fase atual como 0)
  if(puzzleSolved) return; // já tá no finishTraining
  // sem recompensa por sair no meio — isso incentiva completar
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
