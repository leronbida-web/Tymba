function openOnlineSetup(){
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-duelo').classList.add('active');
  document.getElementById('duelSetup').style.display = 'none';
  document.getElementById('duelBattle').style.display = 'none';
  document.getElementById('duelOnlineHostScreen').style.display = 'none';
  document.getElementById('duelOnlineJoinScreen').style.display = 'none';
  document.getElementById('duelOnlineChoice').style.display = 'flex';
}

/* Volta pra escolha host/entrar, encerrando qualquer tentativa de conexão em andamento */
function cancelOnlineSetup(){
  stopQrScanner();
  closeOnlineConnection();
  duel = null;
  document.getElementById('duelOnlineHostScreen').style.display = 'none';
  document.getElementById('duelOnlineJoinScreen').style.display = 'none';
  document.getElementById('duelOnlineChoice').style.display = 'flex';
}

/* ---------- Anfitrião ---------- */
function openOnlineHost(){
  document.getElementById('duelOnlineChoice').style.display = 'none';
  document.getElementById('duelOnlineHostScreen').style.display = 'flex';
  document.getElementById('duelOnlineQr').innerHTML = '<span style="color:#999; font-size:12px;">Gerando QR code…</span>';
  document.getElementById('duelOnlineStatus').textContent = 'Gerando sala…';
  onlineRole = 'host';
  const hostCode = 'sb' + Math.random().toString(36).slice(2, 8);
  try{
    onlinePeer = new Peer(hostCode, { debug: 0 });
  }catch(e){ toast('Não consegui iniciar a conexão'); return; }

  onlinePeer.on('open', id=>{
    renderHostQr(id);
    document.getElementById('duelOnlineStatus').textContent = 'Esperando o outro jogador entrar…';
  });
  onlinePeer.on('connection', conn=>{
    onlineConn = conn;
    document.getElementById('duelOnlineStatus').textContent = 'Conectado! Preparando duelo…';
    setupOnlineConnHandlers();
  });
  onlinePeer.on('error', err=>{
    toast('Erro de conexão (' + (err?.type || 'desconhecido') + ')');
  });
}

function renderHostQr(id){
  const el = document.getElementById('duelOnlineQr');
  el.innerHTML = '';
  new QRCode(el, { text: id, width: 180, height: 180 });
  const codeLbl = document.createElement('div');
  codeLbl.style.cssText = 'font-size:11px; color:#666; margin-top:6px; font-weight:800; letter-spacing:1px; text-align:center;';
  codeLbl.textContent = id;
  el.parentElement.appendChild(codeLbl);
}

/* ---------- Convidado ---------- */
function openOnlineJoin(){
  document.getElementById('duelOnlineChoice').style.display = 'none';
  document.getElementById('duelOnlineJoinScreen').style.display = 'flex';
  onlineRole = 'guest';
  startQrScanner();
}

function startQrScanner(){
  document.getElementById('duelOnlineJoinStatus').textContent = 'Abrindo câmera…';
  qrScannerInstance = new Html5Qrcode('duelQrReader');
  qrScannerInstance.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: 220 },
    (decodedText)=>{
      stopQrScanner();
      connectToHost(decodedText.trim());
    },
    ()=>{ /* frame sem QR legível, ignora e continua tentando */ }
  ).catch(()=>{
    document.getElementById('duelOnlineJoinStatus').textContent = 'Não consegui acessar a câmera. Confere a permissão do navegador.';
  });
}

function stopQrScanner(){
  if(qrScannerInstance){
    const s = qrScannerInstance;
    qrScannerInstance = null;
    s.stop().catch(()=>{}).finally(()=>{ try{ s.clear(); }catch(e){} });
  }
}

function connectToHost(hostId){
  if(!hostId){ toast('Digite ou escaneie o código da sala'); return; }
  stopQrScanner();
  document.getElementById('duelOnlineJoinStatus').textContent = 'Conectando…';
  try{
    onlinePeer = new Peer(undefined, { debug: 0 });
  }catch(e){ toast('Não consegui iniciar a conexão'); return; }

  onlinePeer.on('open', ()=>{
    onlineConn = onlinePeer.connect(hostId, { reliable: true });
    setupOnlineConnHandlers();
  });
  onlinePeer.on('error', err=>{
    document.getElementById('duelOnlineJoinStatus').textContent = 'Erro de conexão (' + (err?.type || 'desconhecido') + ')';
  });
}

/* ---------- Comum aos dois lados ---------- */
function setupOnlineConnHandlers(){
  onlineConn.on('open', ()=>{
    sendOnline({
      type: 'hello',
      name: state.name,
      element: state.element,
      stats: state.stats,
      equipped: [...state.equippedPowers.livre, ...state.equippedPowers.especial],
    });
  });
  onlineConn.on('data', handleOnlineData);
  onlineConn.on('close', handleOnlineDisconnect);
  onlineConn.on('error', handleOnlineDisconnect);
}

function sendOnline(msg){
  if(onlineConn && onlineConn.open) onlineConn.send(msg);
}

function closeOnlineConnection(){
  try{ if(onlineConn && onlineConn.open) onlineConn.send({ type:'bye' }); }catch(e){}
  try{ if(onlineConn) onlineConn.close(); }catch(e){}
  try{ if(onlinePeer) onlinePeer.destroy(); }catch(e){}
  onlineConn = null;
  onlinePeer = null;
  onlineRole = null;
}

function handleOnlineDisconnect(){
  if(duel && duel.active){
    toast('O outro jogador saiu do duelo');
    duel.active = false;
    clearInterval(duel.mainInterval);
    clearInterval(window._guestUiInterval);
    foeDuelist().hp = 0; // desistência: quem ficou conectado vence
    setTimeout(()=> endDuelMatch(), 300);
  }
  closeOnlineConnection();
}

function handleOnlineData(msg){
  if(!msg || !msg.type) return;
  if(onlineRole === 'host'){
    if(msg.type === 'hello'){
      startOnlineDuelAsHost(msg);
    } else if(msg.type === 'action'){
      if(duel && duel.active) fireCard(duel.p2, duel.p1, msg.key);
    } else if(msg.type === 'bye'){
      handleOnlineDisconnect();
    }
  } else {
    if(msg.type === 'start'){
      startOnlineDuelAsGuest(msg);
    } else if(msg.type === 'state'){
      applyRemoteState(msg);
    } else if(msg.type === 'end'){
      if(duel){
        duel.active = false;
        duel.p1.hp = msg.p1hp;
        duel.p2.hp = msg.p2hp;
        duel.endedByTimeout = !!msg.timeout;
        clearInterval(window._guestUiInterval);
        setTimeout(()=> endDuelMatch(), msg.timeout ? 300 : 700);
      }
    } else if(msg.type === 'bye'){
      handleOnlineDisconnect();
    }
  }
}

/* Converte um duelista pra um objeto simples (Set não viaja em JSON) */
function serializeDuelist(d){
  return {
    name: d.name, element: d.element, stats: d.stats, hp: d.hp, maxHp: d.maxHp,
    equipped: d.equipped, deck: d.deck, usedSpecialIds: [...d.usedSpecialIds],
    energy: d.energy, energyLastTick: d.energyLastTick, nextActionReadyAt: d.nextActionReadyAt,
    blockCharge: d.blockCharge, shieldPct: d.shieldPct, shieldExpiresAt: d.shieldExpiresAt,
    flyUntil: d.flyUntil, frozenUntil: d.frozenUntil,
    burnTicksLeft: d.burnTicksLeft, burnDmg: d.burnDmg, nextBurnTickAt: d.nextBurnTickAt,
    tiredUntil: d.tiredUntil, tiredPenalty: d.tiredPenalty,
  };
}
function deserializeDuelist(o){
  return { ...o, usedSpecialIds: new Set(o.usedSpecialIds || []) };
}

/* Anfitrião: assim que recebe o "hello" do convidado, monta o duelo real e avisa */
function startOnlineDuelAsHost(guestHello){
  const p1Stats = { ...state.stats };
  const p1Equipped = [...state.equippedPowers.livre, ...state.equippedPowers.especial];
  const p2Equipped = (guestHello.equipped && guestHello.equipped.length) ? guestHello.equipped : ['forca','defesa','velocidade'];

  duel = {
    active: true,
    mode: 'online-host',
    localSide: 'p1',
    mainInterval: null,
    startedAt: Date.now(),
    endsAt: Date.now() + DUEL_TIME_LIMIT_MS,
    furyAnnounced: false,
    log: [],
    p1: newDuelist(state.name, state.element, p1Stats, p1Equipped),
    p2: newDuelist(guestHello.name || 'Convidado', guestHello.element || randomElement(), guestHello.stats || state.stats, p2Equipped),
  };

  showDuelBattleUI();
  sendOnline({ type:'start', p1: serializeDuelist(duel.p1), p2: serializeDuelist(duel.p2), log: [], startedAt: duel.startedAt, endsAt: duel.endsAt });
  renderDuelArena();
  renderDuelCards();
  clearInterval(duel.mainInterval);
  duel.mainInterval = setInterval(combatTick, 200);
}

/* Convidado: recebe o "start" do anfitrião e só passa a espelhar a tela dele */
function startOnlineDuelAsGuest(startMsg){
  duel = {
    active: true,
    mode: 'online-guest',
    localSide: 'p2',
    mainInterval: null,
    startedAt: startMsg.startedAt || Date.now(),
    endsAt: startMsg.endsAt || ((startMsg.startedAt || Date.now()) + DUEL_TIME_LIMIT_MS),
    log: startMsg.log || [],
    p1: deserializeDuelist(startMsg.p1),
    p2: deserializeDuelist(startMsg.p2),
  };
  showDuelBattleUI();
  renderDuelArena();
  renderDuelCards();
  clearInterval(window._guestUiInterval);
  window._guestUiInterval = setInterval(()=>{
    if(duel && duel.active){
      renderDuelCards();
      renderDuelTimer();
    }
  }, 500);
}

/* Convidado: cada retrato que chega do anfitrião substitui o estado local */
function applyRemoteState(msg){
  if(!duel) return;
  const prevP1Hp = duel.p1.hp, prevP2Hp = duel.p2.hp;
  duel.p1 = deserializeDuelist(msg.p1);
  duel.p2 = deserializeDuelist(msg.p2);
  duel.log = msg.log || duel.log;
  // O anfitrião já anima os golpes na tela dele; aqui a gente só reage à queda de vida
  if(duel.p1.hp < prevP1Hp) reactToDamage('p1', Math.round(prevP1Hp - duel.p1.hp));
  if(duel.p2.hp < prevP2Hp) reactToDamage('p2', Math.round(prevP2Hp - duel.p2.hp));
  renderDuelArena();
  renderDuelCards();
}
function reactToDamage(side, amount){
  if(amount <= 0) return;
  const isMe = duel.localSide === side;
  popDamage(isMe ? 'self' : 'opp', amount);
  flashArena();
  playHitAnimation(isMe ? 'self' : 'opp', duel[side].element);
}

function broadcastOnlineState(){
  sendOnline({ type:'state', p1: serializeDuelist(duel.p1), p2: serializeDuelist(duel.p2), log: duel.log });
}

/* =========================================================
   PLACEHOLDER "EM BREVE"
========================================================= */
