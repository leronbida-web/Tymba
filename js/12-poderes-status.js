function openPoderes(){
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-poderes').classList.add('active');
  renderPoderes();
}
function closePoderes(){
  document.getElementById('screen-poderes').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
}

function openStatus(){
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-status').classList.add('active');
}
function closeStatus(){
  document.getElementById('screen-status').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
}
function openTreinos(){
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-treinos').classList.add('active');
}
function closeTreinos(){
  document.getElementById('screen-treinos').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
}

function renderPoderes(){
  const eq = state.equippedPowers;

  const livreIds = ['forca','defesa','velocidade','golpe_certeiro','investida_dupla','furia'];
  const livreHtml = livreIds.map(id => poderCardHtml(id, eq.livre.includes(id))).join('')
    + Array.from({length:LIVRE_SOON_COUNT}).map((_,i)=> soonCardHtml('livre-soon-'+i)).join('');
  document.getElementById('poderesLivreGrid').innerHTML = livreHtml;
  document.getElementById('livreCountLbl').textContent = `${eq.livre.length}/${LIVRE_MAX}`;

  const especialIds = ['especial_fogo','especial_terra','especial_ar','especial_agua'];
  const especialHtml = especialIds.map(id => poderCardHtml(id, eq.especial.includes(id))).join('');
  document.getElementById('poderesEspecialGrid').innerHTML = especialHtml;
  document.getElementById('especialCountLbl').textContent = `${eq.especial.length}/${ESPECIAL_MAX}`;
}

function poderCardHtml(id, isEquipped){
  const def = POWER_DEFS[id];
  const val = Math.round(powerValue(state.stats, def));
  return `
    <div class="poder-card${isEquipped ? ' equipped' : ''}" onclick="togglePower('${def.category}','${id}')">
      ${isEquipped ? '<div class="check">✓</div>' : ''}
      <div class="icon">${def.icon}</div>
      <div class="title">${def.name}</div>
      <div class="val">${val}</div>
    </div>`;
}

function soonCardHtml(key){
  return `
    <div class="poder-card locked" data-key="${key}">
      <div class="icon">🔒</div>
      <div class="title">Em breve</div>
      <div class="val">—</div>
    </div>`;
}

function togglePower(category, id){
  const eq = state.equippedPowers;
  const list = category === 'livre' ? eq.livre : eq.especial;
  const max = category === 'livre' ? LIVRE_MAX : ESPECIAL_MAX;
  const idx = list.indexOf(id);
  if(idx >= 0){
    if(list.length <= 1){ toast('Você precisa manter pelo menos 1 poder ' + (category === 'livre' ? 'livre' : 'especial') + '!'); return; }
    list.splice(idx, 1);
  } else {
    if(list.length >= max){ toast(`Máximo de ${max} poderes ${category === 'livre' ? 'livres' : 'especiais'}!`); return; }
    list.push(id);
  }
  saveState();
  renderPoderes();
}

function toast(msg){
  let t = document.getElementById('poderesToast');
  if(!t){
    t = document.createElement('div');
    t.id = 'poderesToast';
    t.style.cssText = 'position:fixed; left:50%; bottom:90px; transform:translateX(-50%); background:var(--ink); color:#fff; padding:10px 16px; border-radius:100px; font-size:12.5px; font-weight:800; z-index:999; opacity:0; transition:opacity .25s ease; pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(()=> t.style.opacity = '0', 1800);
}


let duel = null;

/* Conexão online (Duelo Online via QR/PeerJS) */
let onlinePeer = null;
let onlineConn = null;
let onlineRole = null;      // 'host' | 'guest'
let qrScannerInstance = null;

/* "Eu" e "o oponente" dependem de quem está vendo a tela:
   - vs IA e anfitrião do online: eu sou sempre p1.
   - quem entra na sala online: eu sou p2. */
