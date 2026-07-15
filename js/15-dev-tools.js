function showSoon(){
  document.getElementById('soonModal').classList.add('active');
}

/* =========================================================
   INIT
========================================================= */
// ============================================================
// MODO DESENVOLVEDOR: arrastar (1 dedo) pra mover e beliscar (2 dedos)
// pra redimensionar os elementos da home. Fica salvo no localStorage
// deste navegador (não é sincronizado com o save do jogo).
// ============================================================
let devMode = false;
let devLayout = {};

function loadDevLayout(){
  try{ devLayout = JSON.parse(localStorage.getItem('bichinhoDevLayout') || '{}'); }
  catch(e){ devLayout = {}; }
}

function saveDevLayoutToStorage(){
  try{ localStorage.setItem('bichinhoDevLayout', JSON.stringify(devLayout)); }catch(e){}
}

function applyDevLayout(){
  document.querySelectorAll('.dev-adjustable').forEach(el => {
    const key = el.dataset.devKey;
    const d = devLayout[key];
    el.style.transform = d ? `translate(${d.dx||0}px, ${d.dy||0}px) scale(${d.scale||1})` : '';
  });
}

function toggleDevMode(){
  devMode = !devMode;
  document.body.classList.toggle('dev-mode-active', devMode);
  document.getElementById('devModePanel').style.display = devMode ? 'flex' : 'none';
  if(devMode) toast('🛠 Modo dev ativado — arraste ou belisque os elementos marcados');
}

function resetDevLayout(){
  devLayout = {};
  saveDevLayoutToStorage();
  applyDevLayout();
  toast('Layout resetado ao padrão');
}

function exportDevLayout(){
  const txt = JSON.stringify(devLayout, null, 2);
  console.log('Layout do modo dev:', txt);

  // mostra sempre o texto num modal com textarea — funciona mesmo quando o
  // clipboard do navegador/webview bloqueia a cópia automática
  const textarea = document.getElementById('devExportTextarea');
  textarea.value = txt;
  document.getElementById('devExportModal').classList.add('active');
  setTimeout(() => { textarea.focus(); textarea.select(); }, 50);

  // tenta copiar sozinho também, só como bônus — se falhar, o modal já resolve
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(
      () => toast('Valores copiados! Cole aqui no chat.'),
      () => {} // silencioso: o modal com o texto já ficou visível como alternativa
    );
  }
}

// gestos de arrastar/beliscar, um listener por elemento ajustável
function setupDevGestures(){
  document.querySelectorAll('.dev-adjustable').forEach(el => {
    if(el._devGesturesBound) return; // evita duplicar listeners se chamado de novo
    el._devGesturesBound = true;
    let mode = null;
    let startX = 0, startY = 0, startDist = 0;
    let baseDx = 0, baseDy = 0, baseScale = 1;

    el.addEventListener('click', (e) => {
      if(devMode){ e.preventDefault(); e.stopPropagation(); }
    }, true);

    el.addEventListener('touchstart', (e) => {
      if(!devMode) return;
      e.stopPropagation();
      const key = el.dataset.devKey;
      const d = devLayout[key] || { dx:0, dy:0, scale:1 };
      baseDx = d.dx || 0; baseDy = d.dy || 0; baseScale = d.scale || 1;
      if(e.touches.length === 1){
        mode = 'drag';
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      } else if(e.touches.length === 2){
        mode = 'pinch';
        startDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive:true });

    el.addEventListener('touchmove', (e) => {
      if(!devMode || !mode) return;
      e.preventDefault(); e.stopPropagation();
      const key = el.dataset.devKey;
      if(mode === 'drag' && e.touches.length === 1){
        const dx = baseDx + (e.touches[0].clientX - startX);
        const dy = baseDy + (e.touches[0].clientY - startY);
        devLayout[key] = { dx, dy, scale: baseScale };
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${baseScale})`;
      } else if(mode === 'pinch' && e.touches.length === 2){
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = Math.max(0.4, Math.min(3, baseScale * (dist / startDist)));
        devLayout[key] = { dx: baseDx, dy: baseDy, scale };
        el.style.transform = `translate(${baseDx}px, ${baseDy}px) scale(${scale})`;
      }
    }, { passive:false });

    el.addEventListener('touchend', () => {
      if(!devMode) return;
      mode = null;
      saveDevLayoutToStorage();
    });
  });
}

loadDevLayout();
applyDevLayout();
setupDevGestures();

window.addEventListener('resize', ()=>{ if(document.getElementById('screen-home').classList.contains('active')) renderStage(); });

// tempo do ciclo dia/noite do mundo: avança 1s a cada 1s real, mas só enquanto o
// jogo está de fato aberto e a aba está visível — fechar o app ou trocar de aba
// pausa a contagem, então não existe mais recompensa "acumulada" ao reabrir depois de um tempo
let worldTimeTicker = null;
function startWorldTimeTicker(){
  if(worldTimeTicker) return;
  worldTimeTicker = setInterval(() => {
    if(document.hidden) return;
    if(!state || !state.world) return;
    state.world.elapsedMs = (state.world.elapsedMs || 0) + 1000;
  }, 1000);
}

if(state){
  migrateState(state);
  applyDecay(state);
  saveState();
  goHome();
  startWorldTimeTicker();
} else {
  renderSetupPreview();
}
