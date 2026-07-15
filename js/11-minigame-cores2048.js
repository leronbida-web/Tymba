function coresEmptyBoard(){
  const b = [];
  for(let r=0;r<CORES_GRID;r++){ b.push(new Array(CORES_GRID).fill(0)); }
  return b;
}

function coresAddRandomTile(){
  const empties = [];
  for(let r=0;r<CORES_GRID;r++){
    for(let c=0;c<CORES_GRID;c++){
      if(coresBoard[r][c] === 0) empties.push([r,c]);
    }
  }
  if(empties.length === 0) return false;
  const [r,c] = empties[Math.floor(Math.random()*empties.length)];
  // 90% chance de nascer nível 1, 10% de nascer nível 2 (mais esperto = mais recompensa)
  coresBoard[r][c] = Math.random() < 0.9 ? 1 : 2;
  return true;
}

function coresRender(mergedCells){
  const boardEl = document.getElementById('coresBoard');
  boardEl.innerHTML = '';
  for(let r=0;r<CORES_GRID;r++){
    for(let c=0;c<CORES_GRID;c++){
      const v = coresBoard[r][c];
      const cell = document.createElement('div');
      cell.className = 'cores-cell';
      if(v > 0){
        cell.classList.add('tile', 'lv'+v);
        if(v === CORES_MAX_LEVEL) cell.classList.add('sparkle');
        if(mergedCells && mergedCells.some(([mr,mc]) => mr===r && mc===c)){
          cell.classList.add('merge');
        }
        const lbl = document.createElement('span');
        lbl.className = 'lbl';
        lbl.textContent = CORES_TILE_VALUE(v);
        cell.appendChild(lbl);
      }
      boardEl.appendChild(cell);
    }
  }
  document.getElementById('coresScore').textContent = coresScore;
  document.getElementById('coresMaxTile').textContent = coresMaxTile ? CORES_TILE_VALUE(coresMaxTile) : 0;
  document.getElementById('coresBest').textContent = coresBest;
}

function coresCopyBoard(b){ return b.map(row => row.slice()); }

function coresSlide(line){
  // remove zeros
  let arr = line.filter(v => v !== 0);
  let gained = 0;
  let merged = new Array(line.length).fill(false);
  for(let i=0;i<arr.length-1;i++){
    if(arr[i] !== 0 && arr[i] === arr[i+1]){
      const newLv = arr[i] + 1;
      arr[i] = newLv;
      gained += CORES_TILE_VALUE(newLv);  // pontuação clássica: valor da peça nova
      arr[i+1] = 0;
      merged[i] = true;
      if(newLv === CORES_MAX_LEVEL) coresReached2048 = true;
      i++; // pula a próxima pra não fundir em cadeia
    }
  }
  arr = arr.filter(v => v !== 0);
  while(arr.length < line.length) arr.push(0);
  return { arr, gained, merged };
}

function coresMove(dir){
  // dir: 'L','R','U','D'
  if(coresBusy || coresGameOver) return;
  const before = coresCopyBoard(coresBoard);
  let totalGained = 0;
  const mergedCells = [];
  const isRow = (dir === 'L' || dir === 'R');

  for(let i=0;i<CORES_GRID;i++){
    let line;
    let reverseAfter = false;
    if(dir === 'L'){
      line = coresBoard[i].slice();
    } else if(dir === 'R'){
      line = coresBoard[i].slice().reverse();
      reverseAfter = true;
    } else if(dir === 'U'){
      line = [0,1,2,3].map(j => coresBoard[j][i]);
    } else { // D
      line = [0,1,2,3].map(j => coresBoard[j][i]).reverse();
      reverseAfter = true;
    }

    const { arr, gained, merged } = coresSlide(line);
    if(reverseAfter) { arr.reverse(); merged.reverse(); }
    totalGained += gained;
    for(let k=0;k<CORES_GRID;k++){
      if(isRow){
        coresBoard[i][k] = arr[k];
      } else {
        coresBoard[k][i] = arr[k];
      }
    }
    // marca as células que fundiram (pra animar)
    for(let k=0;k<CORES_GRID;k++){
      if(merged[k]){
        if(isRow) mergedCells.push([i, k]);
        else mergedCells.push([k, i]);
      }
    }
  }

  // checa se algo mexeu
  let changed = false;
  for(let r=0;r<CORES_GRID;r++){
    for(let c=0;c<CORES_GRID;c++){
      if(before[r][c] !== coresBoard[r][c]){ changed = true; break; }
    }
    if(changed) break;
  }
  if(!changed) return;

  coresScore += totalGained;
  // atualiza peça máxima
  for(let r=0;r<CORES_GRID;r++){
    for(let c=0;c<CORES_GRID;c++){
      if(coresBoard[r][c] > coresMaxTile) coresMaxTile = coresBoard[r][c];
    }
  }
  if(coresScore > coresBest) coresBest = coresScore;

  // spawna nova peça
  coresAddRandomTile();
  coresRender(mergedCells);

  // parabéns ao chegar em 2048 pela primeira vez nesta partida
  if(coresReached2048 && !coresWonShown){
    coresWonShown = true;
    coresShowWin();
  }

  // checa game over
  if(coresIsGameOver()){
    coresGameOver = true;
    setTimeout(coresEndGame, 350);
  }
}

function coresShowWin(){
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); border-radius:22px; z-index:5; animation:coresPop .35s ease;';
  overlay.innerHTML = '<div style="text-align:center; color:#fff; font-family:Fredoka,sans-serif;"><div style="font-size:46px; font-weight:700; letter-spacing:1px; color:#FFD65C; text-shadow:0 2px 12px rgba(0,0,0,0.6);">2048!</div><div style="font-size:14px; font-weight:800; margin-top:2px;">Você chegou lá ✨</div><div style="font-size:12px; font-weight:700; opacity:0.85; margin-top:4px;">Continue jogando pra ir mais longe</div></div>';
  document.querySelector('#screen-cores .mira-wrap').appendChild(overlay);
  setTimeout(()=>{ overlay.remove(); }, 1800);
}

function coresIsGameOver(){
  // tem célula vazia? não acabou
  for(let r=0;r<CORES_GRID;r++){
    for(let c=0;c<CORES_GRID;c++){
      if(coresBoard[r][c] === 0) return false;
    }
  }
  // tem fusão possível? (horizontal ou vertical)
  for(let r=0;r<CORES_GRID;r++){
    for(let c=0;c<CORES_GRID-1;c++){
      if(coresBoard[r][c] === coresBoard[r][c+1]) return false;
    }
  }
  for(let c=0;c<CORES_GRID;c++){
    for(let r=0;r<CORES_GRID-1;r++){
      if(coresBoard[r][c] === coresBoard[r+1][c]) return false;
    }
  }
  return true;
}

function coresHandleKey(e){
  if(!document.getElementById('screen-cores').classList.contains('active')) return;
  const map = { ArrowLeft:'L', ArrowRight:'R', ArrowUp:'U', ArrowDown:'D',
                a:'L', d:'R', w:'U', s:'D',
                A:'L', D:'R', W:'U', S:'D' };
  const dir = map[e.key];
  if(dir){
    e.preventDefault();
    coresMove(dir);
  }
}

function coresAttachSwipe(){
  const el = document.getElementById('coresBoard');
  let sx=0, sy=0, active=false;
  const TH = 28;
  el.addEventListener('pointerdown', (e)=>{
    active = true; sx = e.clientX; sy = e.clientY;
  });
  el.addEventListener('pointerup', (e)=>{
    if(!active) return;
    active = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if(Math.max(Math.abs(dx), Math.abs(dy)) < TH) return;
    if(Math.abs(dx) > Math.abs(dy)){
      coresMove(dx > 0 ? 'R' : 'L');
    } else {
      coresMove(dy > 0 ? 'D' : 'U');
    }
  });
  el.addEventListener('pointercancel', ()=>{ active = false; });
  el.addEventListener('pointerleave', ()=>{ active = false; });
}

function startCores(){
  hideAllScreens();
  document.getElementById('screen-cores').classList.add('active');

  coresBoard = coresEmptyBoard();
  coresScore = 0;
  coresMaxTile = 0;
  coresReached2048 = false;
  coresWonShown = false;
  coresGameOver = false;
  coresBusy = false;
  coresBest = state.coresBest || 0;

  // começa com 2 peças
  coresAddRandomTile();
  coresAddRandomTile();
  coresRender();

  // swipe
  coresAttachSwipe();
  // teclado
  window.addEventListener('keydown', coresHandleKey);
  // quando sair da tela, tira o listener
  const observer = new MutationObserver(()=>{
    if(!document.getElementById('screen-cores').classList.contains('active')){
      window.removeEventListener('keydown', coresHandleKey);
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('screen-cores'), { attributes:true, attributeFilter:['class'] });
}

function coresEndGame(){
  // pontuação 2048 (clássica) já tá em coresScore
  // statGain escalando pelo maxTile alcançado + bônus de pontuação
  const maxVal = CORES_TILE_VALUE(coresMaxTile);
  let statGain;
  if(coresMaxTile >= 11) statGain = 25;          // 2048!
  else if(coresMaxTile >= 10) statGain = 18;     // 1024
  else if(coresMaxTile >= 9)  statGain = 12;     // 512
  else if(coresMaxTile >= 8)  statGain = 8;      // 256
  else if(coresMaxTile >= 7)  statGain = 6;      // 128
  else if(coresMaxTile >= 6)  statGain = 4;      // 64
  else if(coresMaxTile >= 5)  statGain = 3;      // 32
  else if(coresMaxTile >= 4)  statGain = 2;      // 16
  else                          statGain = 1;    // 8 ou menos
  // + bônus da pontuação acumulada
  statGain += Math.round(coresScore / 50);

  const coinGain = Math.max(1, Math.round(coresScore / 20) + Math.floor(coresMaxTile / 2));

  if(coresScore > (state.coresBest || 0)){
    state.coresBest = coresScore;
    saveState();
  }

  const reached2048 = coresMaxTile >= 11;
  finishTraining('screen-cores','inteligencia', statGain, coinGain,
    reached2048 ? 'VOCÊ CHEGOU EM 2048! 🏆' : (coresMaxTile >= 9 ? 'Quase em 2048!' : 'Treino concluído!'),
    `Peça máxima: ${maxVal}. Pontos: ${coresScore}.${reached2048 ? ' Bônus máximo de Inteligência!' : ''}`);
}

/* =========================================================
   DUELO (turnos, contra IA)
========================================================= */
/* =========================================================
   MENU DE PODERES (escolher o time de poderes pro duelo)
========================================================= */
