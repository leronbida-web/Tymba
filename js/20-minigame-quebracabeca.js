/* =========================================================
   MINIGAME: QUEBRA-CABEÇA (treina Inteligência)
   ---------------------------------------------------------
   Cada fase gera um tabuleiro 8x8 particionado em retângulos
   coloridos que se encaixam perfeitamente (garante que sempre
   existe solução). Algumas peças já vêm fixas no tabuleiro
   como dica; o resto vai pra bandeja pro jogador arrastar.

   Cada peça tem UM lugar e UMA orientação certos (a mesma do
   particionamento original). Encaixou no lugar exato = 🟢
   correta e trava ali. Qualquer outro lugar = 🔴 errada, volta
   pra bandeja. Fase completa (todas as peças da bandeja
   corretas) dá +N de Inteligência e já monta a próxima fase.

   Toque simples numa peça da bandeja não faz nada; dois toques
   rápidos (menos de 350ms de diferença) giram ela 90°.
========================================================= */

let puzzleGame = null; // guarda a fase em andamento — sai e volta sem perder progresso (só reseta recarregando a página)

const PUZZLE_BOARD_SIZE = 8;
const PUZZLE_COLOR_NAMES = ['red','yellow','blue','gray','white','black'];
const PUZZLE_COLOR_HEX = {
  red:'#E63328', yellow:'#F6D511', blue:'#1857A4',
  gray:'#8F8D86', white:'#FDFDF9', black:'#241A30',
};

/* ---------- abrir/fechar a tela ---------- */
function startPuzzle(){
  document.getElementById('screen-treinos').classList.remove('active');
  document.getElementById('screen-puzzle').classList.add('active');
  if(!puzzleGame){
    puzzleGame = { phase: 1 };
    puzzleBuildPhase();
  } else {
    puzzleRenderAll(); // já tinha fase em andamento, só redesenha do jeito que estava
  }
}
function puzzleBack(){
  document.getElementById('screen-puzzle').classList.remove('active');
  document.getElementById('screen-treinos').classList.add('active');
}

/* =========================================================
   GERAÇÃO DA FASE
========================================================= */

/* Corta o tabuleiro em retângulos que se encaixam perfeitamente
   (particionamento recursivo tipo guilhotina). maxDim limita o
   maior lado de cada peça — fases mais difíceis usam peças menores. */
function puzzleGenerateLayout(maxDim){
  const size = PUZZLE_BOARD_SIZE;
  const pieces = [];
  function rec(x, y, w, h){
    const needSplitW = w > maxDim, needSplitH = h > maxDim;
    const canSplitW = w >= 2, canSplitH = h >= 2;
    const isUnit = (w === 1 && h === 1);
    let doSplit = false;
    if(!isUnit){
      if(needSplitW || needSplitH) doSplit = true;
      else if(canSplitW || canSplitH){
        const area = w*h;
        const continueProb = area >= 9 ? 0.55 : (area >= 4 ? 0.28 : 0.12);
        doSplit = Math.random() < continueProb;
      }
    }
    if(doSplit){
      let axis;
      if(needSplitW && canSplitW && !(needSplitH && canSplitH)) axis = 'v';
      else if(needSplitH && canSplitH && !(needSplitW && canSplitW)) axis = 'h';
      else if(canSplitW && canSplitH) axis = Math.random() < 0.5 ? 'v' : 'h';
      else axis = canSplitW ? 'v' : 'h';
      if(axis === 'v'){
        const cut = 1 + Math.floor(Math.random() * (w - 1));
        rec(x, y, cut, h);
        rec(x+cut, y, w-cut, h);
      } else {
        const cut = 1 + Math.floor(Math.random() * (h - 1));
        rec(x, y, w, cut);
        rec(x, y+cut, w, h-cut);
      }
      return;
    }
    pieces.push({ x, y, w, h });
  }
  rec(0, 0, size, size);
  return pieces;
}

/* Quais peças se tocam (pra colorir sem repetir cor entre vizinhas) */
function puzzleAdjacency(pieces){
  const adj = pieces.map(()=> new Set());
  for(let i=0;i<pieces.length;i++){
    for(let j=i+1;j<pieces.length;j++){
      const a = pieces[i], b = pieces[j];
      const touchesV = (a.x+a.w === b.x || b.x+b.w === a.x) && (a.y < b.y+b.h && b.y < a.y+a.h);
      const touchesH = (a.y+a.h === b.y || b.y+b.h === a.y) && (a.x < b.x+b.w && b.x < a.x+a.w);
      if(touchesV || touchesH){ adj[i].add(j); adj[j].add(i); }
    }
  }
  return adj;
}
function puzzleColorPieces(pieces){
  const adj = puzzleAdjacency(pieces);
  const order = pieces.map((_,i)=>i).sort((a,b)=> adj[b].size - adj[a].size);
  const colors = new Array(pieces.length).fill(null);
  for(const i of order){
    const used = new Set([...adj[i]].map(j => colors[j]).filter(Boolean));
    const shuffled = [...PUZZLE_COLOR_NAMES].sort(()=> Math.random() - 0.5);
    colors[i] = shuffled.find(c => !used.has(c)) || shuffled[0];
  }
  return colors;
}

/* Dificuldade sobe com a fase: peças menores e menos dicas fixas */
function puzzleDifficultyForPhase(phase){
  return {
    maxDim: phase <= 3 ? 4 : (phase <= 7 ? 3 : 2),
    lockRatio: Math.max(0.12, 0.5 - phase * 0.035),
    reward: Math.min(1 + Math.floor((phase - 1) / 3), 5),
  };
}

function puzzleBuildPhase(){
  const cfg = puzzleDifficultyForPhase(puzzleGame.phase);
  const rects = puzzleGenerateLayout(cfg.maxDim);
  const colors = puzzleColorPieces(rects);
  const withMeta = rects.map((r,i)=>({ ...r, color: colors[i], area: r.w*r.h }));

  // trava as maiores peças primeiro (viram a "dica" visual do nível)
  const order = withMeta.map((_,i)=>i).sort((a,b)=> withMeta[b].area - withMeta[a].area);
  const lockCount = Math.max(1, Math.round(withMeta.length * cfg.lockRatio));
  const lockedSet = new Set(order.slice(0, lockCount));

  const pieces = withMeta.map((r,i)=>{
    const locked = lockedSet.has(i);
    let w = r.w, h = r.h;
    // metade das peças da bandeja já nasce girada, pra obrigar o jogador a girar de volta
    if(!locked && w !== h && Math.random() < 0.5){ const t = w; w = h; h = t; }
    return {
      id: 'pp' + i, color: r.color, locked,
      solX: r.x, solY: r.y, solW: r.w, solH: r.h,
      w, h, correct: locked,
      x: locked ? r.x : null, y: locked ? r.y : null,
      _lastTapAt: 0,
    };
  });
  // embaralha só a ORDEM de desenho (a posição das travadas no tabuleiro não muda)
  for(let i=pieces.length-1;i>0;i--){
    const j = Math.floor(Math.random() * (i+1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }

  puzzleGame.reward = cfg.reward;
  puzzleGame.pieces = pieces;
  puzzleGame.total = pieces.filter(p => !p.locked).length;
  puzzleGame.correctCount = 0;
  puzzleRenderAll();
}

/* =========================================================
   RENDER
========================================================= */
function puzzleRenderAll(){
  const board = document.getElementById('puzzleBoard');
  const trayEl = document.getElementById('puzzleTray');
  board.innerHTML = '';
  trayEl.innerHTML = '';

  // fundo do tabuleiro: 64 células da grade (as peças entram por cima, com grid-column/row explícitos)
  for(let i=0; i<PUZZLE_BOARD_SIZE*PUZZLE_BOARD_SIZE; i++){
    const c = document.createElement('div');
    c.className = 'puzzle-cell';
    board.appendChild(c);
  }

  puzzleGame.pieces.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'puzzle-piece' + (p.locked ? ' fixed' : (p.correct ? ' correct' : ''));
    el.style.background = PUZZLE_COLOR_HEX[p.color];
    p.el = el;
    if(p.x != null){
      el.style.gridColumn = (p.x + 1) + ' / span ' + p.w;
      el.style.gridRow = (p.y + 1) + ' / span ' + p.h;
      board.appendChild(el);
      if(!p.locked) puzzleAttachDrag(el, p); // peça já correta não é mais arrastável
    } else {
      puzzleSizeForTray(el, p);
      trayEl.appendChild(el);
      puzzleAttachDrag(el, p);
    }
  });

  document.getElementById('puzzlePhase').textContent = puzzleGame.phase;
  document.getElementById('puzzleCorrect').textContent = puzzleGame.correctCount;
  document.getElementById('puzzleTotal').textContent = puzzleGame.total;
  document.getElementById('puzzleNextReward').textContent = '+' + puzzleGame.reward + ' 🧠';
}

function puzzleSizeForTray(el, p){
  const unit = 28;
  el.style.width = (p.w * unit) + 'px';
  el.style.height = (p.h * unit) + 'px';
}

/* =========================================================
   ARRASTAR / GIRAR
========================================================= */
function puzzleAttachDrag(el, p){
  el.addEventListener('pointerdown', function(e){
    if(p.locked || p.correct) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false, originRect = null;
    try{ el.setPointerCapture(e.pointerId); }catch(err){}

    function onMove(ev){
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if(!dragging && Math.hypot(dx, dy) > 6){
        dragging = true;
        originRect = el.getBoundingClientRect();
        el.classList.add('dragging');
        el.style.position = 'fixed';
        el.style.left = originRect.left + 'px';
        el.style.top = originRect.top + 'px';
        el.style.width = originRect.width + 'px';
        el.style.height = originRect.height + 'px';
        document.body.appendChild(el);
      }
      if(dragging){
        el.style.left = (originRect.left + dx) + 'px';
        el.style.top = (originRect.top + dy) + 'px';
      }
    }
    function onUp(ev){
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.classList.remove('dragging');
      if(dragging){
        puzzleHandleDrop(p, el, ev.clientX, ev.clientY);
      } else {
        // toque simples não faz nada — só 2 toques rápidos giram (ver dica na tela)
        const now = Date.now();
        if(p._lastTapAt && (now - p._lastTapAt) < 350){
          p._lastTapAt = 0;
          puzzleRotate(p, el);
        } else {
          p._lastTapAt = now;
        }
      }
    }
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });
}

function puzzleRotate(p, el){
  if(p.w === p.h) return; // peça quadrada, girar não muda nada
  const t = p.w; p.w = p.h; p.h = t;
  puzzleSizeForTray(el, p);
}

function puzzleHandleDrop(p, el, clientX, clientY){
  const boardEl = document.getElementById('puzzleBoard');
  const bRect = boardEl.getBoundingClientRect();
  const padPx = 6, gapPx = 2; // precisa bater com o padding/gap do .puzzle-board no CSS
  const cellPx = (bRect.width - padPx*2 - gapPx*7) / 8;
  const overBoard = clientX >= bRect.left && clientX <= bRect.right && clientY >= bRect.top && clientY <= bRect.bottom;
  let success = false;

  if(overBoard){
    const pieceW = p.w*cellPx + (p.w-1)*gapPx;
    const pieceH = p.h*cellPx + (p.h-1)*gapPx;
    const localX = clientX - bRect.left - padPx - pieceW/2;
    const localY = clientY - bRect.top - padPx - pieceH/2;
    let col = Math.round(localX / (cellPx + gapPx));
    let row = Math.round(localY / (cellPx + gapPx));
    col = Math.max(0, Math.min(col, PUZZLE_BOARD_SIZE - p.w));
    row = Math.max(0, Math.min(row, PUZZLE_BOARD_SIZE - p.h));

    // só existe UM lugar/orientação certos por peça — qualquer outro é "errado",
    // mesmo que a célula esteja livre (não tem tabuleiro parcialmente certo).
    if(col === p.solX && row === p.solY && p.w === p.solW && p.h === p.solH){
      success = true;
      p.x = col; p.y = row; p.correct = true;
      el.style.position = ''; el.style.left = ''; el.style.top = '';
      el.style.width = ''; el.style.height = '';
      el.style.gridColumn = (col+1) + ' / span ' + p.w;
      el.style.gridRow = (row+1) + ' / span ' + p.h;
      el.className = 'puzzle-piece correct';
      el.style.background = PUZZLE_COLOR_HEX[p.color];
      boardEl.appendChild(el);

      puzzleGame.correctCount++;
      document.getElementById('puzzleCorrect').textContent = puzzleGame.correctCount;
      puzzleCheckWin();
    } else {
      el.classList.add('wrong');
      setTimeout(()=> el.classList.remove('wrong'), 620);
    }
  }

  if(!success){
    el.style.position = ''; el.style.left = ''; el.style.top = '';
    puzzleSizeForTray(el, p);
    document.getElementById('puzzleTray').appendChild(el);
  }
}

function puzzleCheckWin(){
  if(puzzleGame.correctCount < puzzleGame.total) return;
  const reward = puzzleGame.reward;
  state.stats.inteligencia = (state.stats.inteligencia || 0) + reward;
  saveState();
  toast('Fase ' + puzzleGame.phase + ' completa! +' + reward + ' 🧠');
  puzzleGame.phase++;
  setTimeout(puzzleBuildPhase, 900); // dá um respiro pro jogador ver o tabuleiro todo certo antes de trocar
}
