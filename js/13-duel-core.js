function meDuelist(){ return (duel && duel.localSide === 'p2') ? duel.p2 : duel.p1; }
function foeDuelist(){ return (duel && duel.localSide === 'p2') ? duel.p1 : duel.p2; }
/* =========================================================
   DUELO EM TEMPO REAL
   Sem rodada pareada: cada lado age quando quiser, contanto que tenha
   energia. Escudo/Esquiva armam um bloqueio que anula só o PRÓXIMO golpe
   que chegar (depois disso, expira). Os especiais e efeitos (queima, muro,
   voo, congelar) agora contam em segundos reais, não mais em "rodadas".
========================================================= */
const ACTION_COOLDOWN_MS = 500;   // trava mínima entre duas ações do mesmo lado (evita clique duplo instantâneo)
const FREEZE_DURATION_MS = 3000;  // Congelar: tempo que o alvo fica sem poder agir (3s, curado na hora se o alvo usar Círculo de Fogo)
const FLY_DURATION_MS = 3000;     // Voo: tempo esquivando de tudo que não for Terra (3s)
const WALL_HITS = 2;              // Muro de Terra: quantos golpes ele aguenta antes de sumir
const WALL_DURATION_MS = 20000;   // Muro de Terra: teto de segurança em tempo (some antes se levar 2 golpes, ou na hora se pegar Círculo de Fogo)
const BURN_TICK_MS = 1600;        // Círculo de Fogo: intervalo entre as 2 queimadas
const TIRED_DURATION_MS = 3200;   // Fúria: tempo cansado com penalidade nos poderes
const ELEMENT_CYCLE = { fogo:'terra', terra:'ar', ar:'agua', agua:'fogo' };

/* +20% de dano para quem tem vantagem elemental (Fogo>Terra>Ar>Água>Fogo) */
function elementAdvantage(atacante, defensor){
  return ELEMENT_CYCLE[atacante] === defensor ? 1.2 : 1.0;
}

function computeDuelHp(stats){
  return Math.round((stats.forca + stats.velocidade + stats.resistencia + stats.especial) * 3);
}
function otherOf(who){ return who === 'p1' ? 'p2' : 'p1'; }

/* Regenera a energia de acordo com o tempo real passado desde o último tick.
   Chamado sempre que precisamos saber o valor atual — por isso a barra sobe
   de forma contínua e não só "de uma vez" por rodada. */
function tickEnergy(p){
  const now = Date.now();
  const elapsed = (now - p.energyLastTick) / 1000;
  if(elapsed > 0){
    p.energy = Math.min(ENERGY_MAX, p.energy + elapsed * ENERGY_REGEN_PER_SEC);
    p.energyLastTick = now;
  }
  return p.energy;
}
function setEnergyBar(id, energy){
  const el = document.getElementById(id);
  if(el) el.style.width = Math.max(0, Math.min(100, (energy/ENERGY_MAX)*100)) + '%';
}

function openDuelSetup(){
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-duelo').classList.add('active');
  document.getElementById('duelBattle').style.display = 'none';
  document.getElementById('duelOnlineChoice').style.display = 'none';
  document.getElementById('duelOnlineHostScreen').style.display = 'none';
  document.getElementById('duelOnlineJoinScreen').style.display = 'none';
  document.getElementById('duelSetup').style.display = 'flex';

  // Prévia de um oponente sorteado (mesmo que seja re-sorteado ao começar)
  const previewEl = randomElement();
  document.getElementById('duelOppPreview').innerHTML = blobSvg(previewEl, { evolved:false, wobble:true });
  document.getElementById('duelOppPreviewName').textContent = 'Bichinho Selvagem (' + ELEMENTS[previewEl].label + ')';
}

function closeDuelo(){
  if(duel){ duel.active = false; clearInterval(duel.mainInterval); }
  clearInterval(window._guestUiInterval);
  closeOnlineConnection();
  duel = null;
  document.getElementById('duelWallStaticSelf')?.remove();
  document.getElementById('duelWallStaticOpp')?.remove();
  document.getElementById('screen-duelo').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
}

/* Ponto único de saída/entrada das telas de duelo (vs IA e online, todos os passos) */
function showDuelBattleUI(){
  document.getElementById('duelSetup').style.display = 'none';
  document.getElementById('duelOnlineChoice').style.display = 'none';
  document.getElementById('duelOnlineHostScreen').style.display = 'none';
  document.getElementById('duelOnlineJoinScreen').style.display = 'none';
  document.getElementById('duelBattle').style.display = 'flex';
  document.getElementById('duelConfirmBtn').style.display = 'none';
  document.getElementById('duelRoundLbl').textContent = '⚔️ Ao vivo';
}

function shuffleDeck(arr){
  const a = [...arr];
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// mão = as 4 primeiras cartas do deck; fila = o resto; deck[4] é a "próxima carta" (estilo Clash Royale)
function handOf(d){ return d.deck.slice(0, 4); }
function nextCardOf(d){ return d.deck.length > 4 ? d.deck[4] : null; }

function newDuelist(name, element, stats, equipped){
  return {
    name, element, stats, hp: computeDuelHp(stats), maxHp: computeDuelHp(stats),
    equipped, deck: shuffleDeck(equipped), usedSpecialIds: new Set(),
    energy: ENERGY_MAX, energyLastTick: Date.now(), nextActionReadyAt: 0,
    blockCharge: null,
    shieldPct: 0, shieldExpiresAt: 0, wallHitsLeft: 0,
    flyUntil: 0, frozenUntil: 0,
    burnTicksLeft: 0, burnDmg: 0, nextBurnTickAt: 0,
    tiredUntil: 0, tiredPenalty: 0,
    aiNextActionAt: 0,
  };
}

function startAiDuel(opts){
  opts = opts || {};
  let p2Element = randomElement();
  if(opts.source === 'world' && state.world && worldPendingEnemyId){
    // o bichinho selvagem que encostou no player no mundo entra no duelo com o MESMO elemento que tinha lá fora
    const worldFoe = state.world.enemies.find(e => e.id === worldPendingEnemyId);
    if(worldFoe) p2Element = worldFoe.element;
  }
  const p2Stats = {};
  ['forca','velocidade','resistencia','especial','precisao','inteligencia','energia'].forEach(k=>{
    const base = state.stats[k];
    const varied = base * (0.75 + Math.random()*0.5); // IA fica próxima do seu nível, sem ser idêntica
    p2Stats[k] = Math.max(MIN_STAT, Math.round(varied));
  });
  const p1Stats = { ...state.stats };
  const p1Equipped = [...state.equippedPowers.livre, ...state.equippedPowers.especial];
  const p2Equipped = ['forca','defesa','velocidade', 'especial_' + p2Element];

  duel = {
    active: true,
    mode: 'ai',
    source: opts.source || 'menu',
    worldLevel: levelFromXp(state.xp),
    localSide: 'p1',
    mainInterval: null,
    log: [],
    p1: newDuelist(state.name, state.element, p1Stats, p1Equipped),
    p2: newDuelist('Bichinho Selvagem', p2Element, p2Stats, p2Equipped),
  };
  duel.p2.aiNextActionAt = Date.now() + 800;

  showDuelBattleUI();
  renderDuelArena();
  renderDuelCards();
  clearInterval(duel.mainInterval);
  duel.mainInterval = setInterval(combatTick, 200);
}

function setHpBar(id, hp, maxHp){
  const pct = Math.max(0, Math.min(100, (hp/maxHp)*100));
  const el = document.getElementById(id);
  el.style.width = pct + '%';
  el.classList.toggle('low', pct <= 30);
}

function statusIcons(p){
  let s = '';
  if(p.burnTicksLeft > 0) s += '🔥';
  if(p.shieldPct > 0 && p.shieldExpiresAt > Date.now()) s += '🛡️';
  if(p.blockCharge) s += '🙅';
  if(p.flyUntil > Date.now()) s += '💨';
  if(p.frozenUntil > Date.now()) s += '🧊';
  return s;
}

function renderDuelArena(){
  const self = meDuelist();
  const opp = foeDuelist();
  document.getElementById('duelSelfHpName').textContent = self.name + (statusIcons(self) ? ' ' + statusIcons(self) : '');
  document.getElementById('duelOppHpName').textContent = opp.name + (statusIcons(opp) ? ' ' + statusIcons(opp) : '');
  document.getElementById('duelSelfHpNum').textContent = Math.max(0, Math.round(self.hp)) + '/' + self.maxHp;
  setHpBar('duelSelfHpFill', self.hp, self.maxHp);
  setHpBar('duelOppHpFill', opp.hp, opp.maxHp);
  // No convidado a energia já vem calculada pelo anfitrião a cada snapshot — não tica de novo aqui
  const isGuest = duel.mode === 'online-guest';
  setEnergyBar('duelSelfEnergyFill', isGuest ? self.energy : tickEnergy(self));
  if(!isGuest) tickEnergy(opp); // a energia do oponente segue existindo internamente, só não é exibida
  document.getElementById('duelOppNameTag').textContent = opp.name;
  document.getElementById('duelSelfSvg').style.backgroundImage = _hitAnimActive.self ? document.getElementById('duelSelfSvg').style.backgroundImage : "url('" + DUEL_SPRITES_BACK[self.element] + "')";
  document.getElementById('duelOppSvg').style.backgroundImage = _hitAnimActive.opp ? document.getElementById('duelOppSvg').style.backgroundImage : "url('" + DUEL_SPRITES_FRONT[opp.element] + "')";
  renderPersistentWall();
  renderLog();
}

function renderPersistentWall(){
  const now = Date.now();
  const self = meDuelist();
  const opp = foeDuelist();
  const selfActive = self.shieldPct > 0 && self.shieldExpiresAt > now;
  const oppActive = opp.shieldPct > 0 && opp.shieldExpiresAt > now;
  updateWallSide('duelWallStaticSelf', selfActive, false);
  updateWallSide('duelWallStaticOpp', oppActive, true);
}
function updateWallSide(elId, active, isOpp){
  const arena = document.getElementById('duelArena');
  let w = document.getElementById(elId);
  if(active && !w){
    w = document.createElement('div');
    w.id = elId;
    w.className = 'duel-wall-static' + (isOpp ? ' opp' : ' self');
    arena.appendChild(w);
  } else if(!active && w){
    w.remove();
  }
}

function logEvent(msg){
  duel.log.unshift(msg);
  duel.log = duel.log.slice(0, 4);
  renderLog();
}
function renderLog(){
  const el = document.getElementById('duelTurnLbl');
  if(!el) return;
  el.innerHTML = duel.log.length
    ? duel.log.map((m,i)=> `<div style="opacity:${1 - i*0.22}">${m}</div>`).join('')
    : 'Toque num poder pra agir. A IA age sozinha quando tiver energia.';
}

function renderDuelCards(){
  const self = meDuelist();
  const now = Date.now();
  const wrap = document.getElementById('duelCards');
  const nextWrap = document.getElementById('duelNextCard');

  if(duel.mode !== 'online-guest') tickEnergy(self);

  const isFrozen = self.frozenUntil > now;
  const frozenNotice = isFrozen
    ? `<div style="grid-column:1/-1; text-align:center; font-weight:800; padding:6px 0 10px;">🧊 Você está congelado! (${Math.ceil((self.frozenUntil - now)/1000)}s) — use o Círculo de Fogo pra descongelar na hora</div>`
    : '';

  wrap.innerHTML = frozenNotice + handOf(self).map(id => {
    const def = POWER_DEFS[id];
    const isFireSpecial = def.category === 'especial' && def.element === 'fogo';
    // Congelado: só o Círculo de Fogo fica disponível, o resto trava.
    if(isFrozen && !isFireSpecial){
      return `
      <div class="duel-card disabled">
        <div class="icon">${def.icon}</div>
        <div class="title">${def.name}</div>
        <div class="val">${Math.round(powerValue(self.stats, def))}</div>
        <div class="cost">🧊 congelado</div>
      </div>
    `;
    }
    const isUsedSpecial = def.category === 'especial' && self.usedSpecialIds.has(id);
    const noEnergy = self.energy < def.energyCost;
    const onCooldown = now < (self.nextActionReadyAt||0);
    const alreadyBlocking = !def.off && def.category === 'livre' && !!self.blockCharge;
    const disabled = isUsedSpecial || noEnergy || onCooldown || alreadyBlocking;
    return `
    <div class="duel-card${disabled ? ' disabled' : ''}" data-key="${id}" ${disabled ? '' : `onclick="handleCardTap('${id}')"`}>
      <div class="icon">${def.icon}</div>
      <div class="title">${def.name}${isUsedSpecial ? ' (usado)' : ''}</div>
      <div class="val">${Math.round(powerValue(self.stats, def))}</div>
      <div class="cost">⚡${def.energyCost}${noEnergy ? ' (sem energia)' : ''}</div>
    </div>
  `;}).join('');

  // Carta que vai entrar na mão assim que uma das 4 atuais for jogada
  if(nextWrap){
    const nextId = nextCardOf(self);
    nextWrap.innerHTML = nextId ? (()=>{
      const def = POWER_DEFS[nextId];
      return `
        <div class="icon">${def.icon}</div>
        <div class="val">${Math.round(powerValue(self.stats, def))}</div>
        <div class="cost">⚡${def.energyCost}</div>
      `;
    })() : '';
  }
}

function handleCardTap(key){
  if(!duel || !duel.active) return;
  if(duel.mode === 'online-guest'){
    sendOnline({ type:'action', key });
    return;
  }
  fireCard(meDuelist(), foeDuelist(), key);
}

/* Executa uma carta imediatamente pra quem chamou (jogador ou IA) */
function fireCard(actor, defender, key){
  if(!duel || !duel.active) return;
  const now = Date.now();
  const def = POWER_DEFS[key];
  if(!def) return;
  // só pode jogar uma carta que esteja na mão (as 4 primeiras da fila)
  if(!handOf(actor).includes(key)) return;
  // Congelado trava tudo, exceto o Círculo de Fogo — que derrete o gelo na hora (ver castSpecialLive).
  const isFireSpecial = def.category === 'especial' && def.element === 'fogo';
  if(now < actor.frozenUntil && !isFireSpecial) return;
  if(now < (actor.nextActionReadyAt||0)) return;
  if(def.category === 'especial' && actor.usedSpecialIds.has(key)) return;
  tickEnergy(actor);
  if(actor.energy < def.energyCost) return;

  actor.energy -= def.energyCost;
  actor.nextActionReadyAt = now + ACTION_COOLDOWN_MS;
  const selfSide = actor === duel.p1;

  // A carta jogada sai da mão e vai pro final da fila — exceto especiais,
  // que são de uso único no duelo e não voltam mais.
  const deckIdx = actor.deck.indexOf(key);
  if(deckIdx !== -1){
    actor.deck.splice(deckIdx, 1);
    if(def.category !== 'especial') actor.deck.push(key);
  }

  if(def.category === 'especial'){
    actor.usedSpecialIds.add(key);
    castSpecialLive(actor, defender, def, selfSide);
  } else if(!def.off){
    // Escudo: guarda o valor calculado pra comparar com o golpe recebido depois.
    // Esquiva: continua sendo tudo ou nada (esquivou ou não).
    const chargeVal = key === 'defesa' ? powerValue(actor.stats, def) : null;
    actor.blockCharge = { source: key, value: chargeVal };
    logEvent(`${def.icon} ${actor.name} se prepara com ${def.name}`);
    // A animação de Escudo/Esquiva não toca aqui mais — ela só aparece
    // junto com o golpe do adversário, no momento em que essa defesa é
    // consumida (ver applyHitToDefender). Isso tira o delay entre "ativei"
    // e "o golpe realmente chegou".
  } else {
    applyOffensiveLive(actor, defender, def, key, selfSide);
  }
  renderDuelArena();
  renderDuelCards();
}

function applyOffensiveLive(attacker, defender, def, key, selfSide){
  let val = powerValue(attacker.stats, def);
  if(attacker.tiredUntil > Date.now() && attacker.tiredPenalty > 0){
    val *= (1 - attacker.tiredPenalty);
  }
  val *= elementAdvantage(attacker.element, defender.element);

  if(key === 'forca') spawnAtkBalls(selfSide, attacker.element);

  applyHitToDefender(attacker, defender, val, selfSide, undefined, key === 'golpe_certeiro');

  if(def.multiHit){
    const decay = def.multiHitDecay ?? 0.7;
    let current = val;
    for(let i = 1; i < def.multiHit; i++){
      current *= decay;
      const hitNum = i + 1;
      setTimeout(()=>{
        if(!duel || !duel.active) return;
        applyHitToDefender(attacker, defender, current, selfSide, `⚡💥 ${attacker.name} acerta o ${hitNum}º golpe`);
      }, i * 300);
    }
  }

  if(def.exhaustEnergy){
    const drain = (attacker.stats.energia || 0) * def.exhaustEnergy;
    attacker.stats.energia = Math.max(0, (attacker.stats.energia || 0) - drain);
    attacker.tiredUntil = Date.now() + TIRED_DURATION_MS;
    attacker.tiredPenalty = def.tiredPenalty;
    logEvent(`😠 ${attacker.name} ficou cansado (-${Math.round(def.tiredPenalty*100)}% por um tempo)`);
  }
}

function applyHitToDefender(attacker, defender, rawVal, attackerSelfSide, label, ignoresDodge){
  if(!duel || !duel.active) return;
  let dmg = rawVal;
  // 1) Bloqueio de Escudo/Esquiva
  if(defender.blockCharge){
    const block = defender.blockCharge;
    const dodging = block.source === 'velocidade';
    const defenderOnSelf = !attackerSelfSide; // lado do defensor na tela (mesmo esquema do popDamage)
    if(dodging){
      defender.blockCharge = null;
      spawnDodge(defenderOnSelf); // toca junto com o golpe do atacante, não mais na hora que foi ativada
      if(ignoresDodge){
        // Golpe Certeiro atravessa a Esquiva — a esquiva é gasta, mas o golpe passa inteiro
        logEvent(`🎯 ${attacker.name} atravessa a Esquiva de ${defender.name} com Golpe Certeiro!`);
      } else {
        logEvent(`💨 ${defender.name} desviou do golpe de ${attacker.name}!`);
        renderDuelArena();
        return;
      }
    } else {
      // Escudo: compara o valor do escudo com o valor do golpe recebido
      defender.blockCharge = null;
      spawnShield(defenderOnSelf); // idem: junto com o golpe, não na ativação
      const shieldVal = block.value || 0;
      if(shieldVal >= dmg){
        logEvent(`🛡️ ${defender.name} bloqueou completamente o golpe de ${attacker.name} com o Escudo (${Math.round(shieldVal)} vs ${Math.round(dmg)})!`);
        renderDuelArena();
        return;
      } else {
        logEvent(`🛡️ ${defender.name} amorteceu parte do golpe com o Escudo (${Math.round(shieldVal)} bloqueados)`);
        dmg -= shieldVal;
      }
    }
  }
  // 2) Voo: esquiva de tudo que não for Terra
  if(defender.flyUntil > Date.now() && attacker.element !== 'terra'){
    logEvent(`💨 ${defender.name} estava voando e desviou!`);
    return;
  }
  // 3) Muro de Terra: amortece 60% do golpe, aguenta WALL_HITS golpes seguidos e então some
  if(defender.shieldPct > 0 && defender.shieldExpiresAt > Date.now()){
    dmg *= (1 - defender.shieldPct);
    defender.wallHitsLeft = Math.max(0, (defender.wallHitsLeft || 0) - 1);
    if(defender.wallHitsLeft <= 0){
      defender.shieldPct = 0;
      defender.shieldExpiresAt = 0;
      logEvent(`🛡️ ${defender.name} amorteceu o golpe — o Muro de Terra se desfez!`);
    } else {
      logEvent(`🛡️ ${defender.name} amorteceu o golpe com o Muro de Terra (aguenta mais ${defender.wallHitsLeft})`);
    }
  }
  dmg = Math.max(0, Math.round(dmg));
  if(dmg <= 0) return;
  defender.hp = Math.max(0, defender.hp - dmg);
  popDamage(attackerSelfSide ? 'opp' : 'self', dmg);
  flashArena();
  logEvent(`${label || ((attackerSelfSide ? '💥' : '⚠️') + ' ' + attacker.name + ' acertou ' + defender.name)} (${dmg})`);
  renderDuelArena();
  playHitAnimation(attackerSelfSide ? 'opp' : 'self', defender.element);
}

function castSpecialLive(caster, target, def, selfSide){
  const elementKey = def.element;
  const now = Date.now();

  if(elementKey === 'fogo'){
    // O calor do próprio Círculo de Fogo derrete o gelo: se quem lança
    // estava congelado, volta ao normal na hora.
    if(caster.frozenUntil > now){
      caster.frozenUntil = 0;
      logEvent(`🔥 O calor derrete o gelo e ${caster.name} volta ao normal!`);
    }
    // Voo esquiva de tudo que não for Terra — inclusive do Círculo de Fogo.
    if(target.flyUntil > now){
      logEvent(`💨 ${target.name} estava voando e escapou do Círculo de Fogo!`);
      spawnEmojiPop(selfSide, '💨');
      renderDuelArena();
      return;
    }
    // O fogo destrói o Muro de Terra na hora, antes mesmo de queimar.
    if(target.shieldPct > 0 && target.shieldExpiresAt > now){
      target.shieldPct = 0;
      target.shieldExpiresAt = 0;
      target.wallHitsLeft = 0;
      logEvent(`🔥🪨 O fogo de ${caster.name} destrói o Muro de Terra de ${target.name}!`);
    }
    const dmg = Math.round(caster.stats.especial * elementAdvantage(elementKey, target.element) * 0.4);
    target.burnTicksLeft = 2;
    target.burnDmg = dmg;
    target.nextBurnTickAt = now + BURN_TICK_MS;
    logEvent(`🔥 ${caster.name} envolve ${target.name} em chamas (queima 2 vezes seguidas)`);
    spawnEmojiPop(!selfSide, '🔥');
  } else if(elementKey === 'terra'){
    caster.shieldPct = 0.6;
    caster.wallHitsLeft = WALL_HITS;
    caster.shieldExpiresAt = now + WALL_DURATION_MS;
    spawnWall();
    logEvent(`🪨 ${caster.name} ergue um Muro de Terra (aguenta ${WALL_HITS} golpes)`);
  } else if(elementKey === 'ar'){
    caster.flyUntil = now + FLY_DURATION_MS;
    spawnEmojiPop(selfSide, '💨');
    logEvent(`💨 ${caster.name} alça voo! Só ataques de Terra o alcançam por um tempo`);
  } else if(elementKey === 'agua'){
    // Água apaga fogo: se quem lança estava queimando, o efeito é anulado na hora.
    if(caster.burnTicksLeft > 0){
      caster.burnTicksLeft = 0;
      caster.burnDmg = 0;
      logEvent(`💧 A água apaga as chamas em ${caster.name}!`);
    }
    // Voo esquiva de tudo que não for Terra — inclusive de Congelar.
    if(target.flyUntil > now){
      logEvent(`💨 ${target.name} estava voando e escapou do Congelar!`);
      spawnEmojiPop(selfSide, '💨');
      renderDuelArena();
      return;
    }
    target.frozenUntil = now + FREEZE_DURATION_MS;
    spawnEmojiPop(!selfSide, '🧊');
    logEvent(`🧊 ${caster.name} congela ${target.name}, que não vai poder agir por 3s`);
  }
}

function spawnAtkBalls(fromSelf, elKey){
  const el = ELEMENTS[elKey];
  const arena = document.getElementById('duelArena');
  const arenaH = arena.clientHeight || 320;
  const startTop = fromSelf ? (arenaH - 90) : 20;
  const endTop = fromSelf ? 10 : (arenaH - 110);
  const color = `radial-gradient(circle at 35% 30%, ${el.c1}, ${el.c2})`;
  [0, 1, 2].forEach(i=>{
    setTimeout(()=>{
      const ball = document.createElement('div');
      ball.className = 'duel-atk-ball';
      ball.style.background = color;
      ball.style.top = startTop + 'px';
      ball.style.marginLeft = ((i-1) * 16) + 'px';
      arena.appendChild(ball);
      requestAnimationFrame(()=> requestAnimationFrame(()=>{
        ball.style.top = endTop + 'px';
        ball.style.opacity = '0';
      }));
      setTimeout(()=> ball.remove(), 950);
    }, i * 160);
  });
}

function spawnEmojiPop(onSelf, emoji){
  const arena = document.getElementById('duelArena');
  const arenaH = arena.clientHeight || 320;
  const s = document.createElement('div');
  s.className = 'duel-shield-fx';
  s.textContent = emoji;
  s.style.top = (onSelf ? (arenaH - 130) : 90) + 'px';
  arena.appendChild(s);
  setTimeout(()=> s.remove(), 1150);
}
function spawnShield(onSelf){ spawnEmojiPop(onSelf, '🛡️'); }

function spawnWall(){
  const arena = document.getElementById('duelArena');
  const w = document.createElement('div');
  w.className = 'duel-wall-fx';
  arena.appendChild(w);
  setTimeout(()=> w.remove(), 1450);
}

function spawnDodge(onSelf){
  const target = document.getElementById(onSelf ? 'duelSelfSvg' : 'duelOppSvg');
  target.classList.remove('dodge');
  void target.offsetWidth;
  target.classList.add('dodge');
  setTimeout(()=> target.classList.remove('dodge'), 1000);
}

function popDamage(target, amount){
  const arena = document.getElementById('duelArena');
  const el = document.createElement('div');
  el.className = 'dmg-pop show';
  el.textContent = '-' + amount;
  el.style.top = target === 'self' ? '56%' : '16%';
  arena.appendChild(el);
  setTimeout(()=> el.remove(), 1000);
}

function flashArena(){
  const f = document.getElementById('duelFlash');
  f.classList.remove('hit');
  void f.offsetWidth;
  f.classList.add('hit');
}

/* IA: verificada a cada ~1s (com um pouco de aleatoriedade). Só age se tiver
   energia pra alguma carta; senão espera a próxima checagem regenerar mais. */
function aiActLive(){
  const ai = duel.p2, foe = duel.p1;
  const now = Date.now();
  if(now < (ai.nextActionReadyAt||0)) return;
  tickEnergy(ai);
  const aiHpFrac = ai.hp / ai.maxHp;
  const foeHpFrac = foe.hp / foe.maxHp;
  let keys = handOf(ai).filter(id => !(POWER_DEFS[id].category === 'especial' && ai.usedSpecialIds.has(id)));
  keys = keys.filter(id => POWER_DEFS[id].energyCost <= ai.energy);
  // Não deixa a IA reativar Escudo/Esquiva enquanto já tem um bloqueio de pé
  // (senão ela fica "recarregando" o escudo pra sempre e nunca toma dano)
  keys = keys.filter(id => !(POWER_DEFS[id].category === 'livre' && !POWER_DEFS[id].off && ai.blockCharge));
  // Congelada, a IA só pode agir com o Círculo de Fogo (derrete o gelo na hora)
  if(now < ai.frozenUntil){
    keys = keys.filter(id => POWER_DEFS[id].category === 'especial' && POWER_DEFS[id].element === 'fogo');
  }
  if(keys.length === 0) return; // sem energia pra nada ainda, espera regenerar

  const weights = {};
  keys.forEach(id=>{
    const def = POWER_DEFS[id];
    let w = powerValue(ai.stats, def);
    if(def.category === 'especial'){
      w = ai.stats.especial * 0.6;
      if(foeHpFrac < 0.45) w *= 2.2;
      if(aiHpFrac < 0.35) w *= 1.8;
    }
    if(def.category !== 'especial' && id !== 'forca' && aiHpFrac < 0.35) w *= 1.6;
    w *= 0.85 + Math.random()*0.3;
    weights[id] = Math.max(0.1, w);
  });
  const total = keys.reduce((sum,id)=> sum + weights[id], 0);
  let r = Math.random()*total;
  let chosen = keys[0];
  for(const id of keys){
    r -= weights[id];
    if(r <= 0){ chosen = id; break; }
  }
  fireCard(ai, foe, chosen);
}

function checkMatchEnd(){
  if(!duel || !duel.active) return;
  if(duel.p1.hp <= 0 || duel.p2.hp <= 0){
    duel.active = false;
    clearInterval(duel.mainInterval);
    if(duel.mode === 'online-host'){
      sendOnline({ type:'end', p1hp: duel.p1.hp, p2hp: duel.p2.hp });
    }
    setTimeout(()=> endDuelMatch(), 700);
  }
}

/* Loop principal: roda a cada 200ms enquanto o duelo está ativo */
function combatTick(){
  if(!duel || !duel.active) return;
  const now = Date.now();
  tickEnergy(duel.p1);
  tickEnergy(duel.p2);

  [duel.p1, duel.p2].forEach(p=>{
    if(p.burnTicksLeft > 0 && now >= p.nextBurnTickAt){
      p.hp = Math.max(0, p.hp - p.burnDmg);
      popDamage(p === duel.p1 ? 'self' : 'opp', p.burnDmg);
      logEvent(`🔥 ${p.name} sofre ${p.burnDmg} de queimadura`);
      p.burnTicksLeft--;
      p.nextBurnTickAt = now + BURN_TICK_MS;
    }
    if(p.tiredUntil > 0 && p.tiredUntil <= now){
      p.tiredUntil = 0;
      p.tiredPenalty = 0;
    }
  });

  if(duel.mode === 'ai' && now >= (duel.p2.aiNextActionAt||0)){
    aiActLive();
    duel.p2.aiNextActionAt = now + 900 + Math.random()*900;
  }

  renderDuelArena();
  renderDuelCards();
  checkMatchEnd();

  if(duel.mode === 'online-host' && duel.active){
    broadcastOnlineState();
  }
}

function endDuelMatch(){
  document.getElementById('duelBattle').style.display = 'none';
  document.getElementById('duelWallStaticSelf')?.remove();
  document.getElementById('duelWallStaticOpp')?.remove();
  const me = meDuelist();
  const foe = foeDuelist();
  const iWon = me.hp > 0 && foe.hp <= 0;
  const iLost = foe.hp > 0 && me.hp <= 0;
  const isOnline = duel.mode === 'online-host' || duel.mode === 'online-guest';
  const title = document.getElementById('duelResultTitle');
  const sub = document.getElementById('duelResultSub');
  const rewardRow = document.getElementById('duelResultRewardRow');

  if(iWon){
    title.textContent = '🏆 Você venceu!';
    sub.textContent = isOnline ? 'Seu bichinho venceu o duelo online!' : 'Seu bichinho dominou o duelo.';
    const coinGain = duel.source === 'world' ? worldEnemyCoinReward(duel.worldLevel) : 15;
    state.coins += coinGain;
    document.getElementById('duelResultCoins').textContent = '+' + coinGain;
    rewardRow.style.display = 'flex';
  } else if(iLost){
    title.textContent = '💀 Você perdeu';
    sub.textContent = isOnline ? 'Seu amigo venceu essa. Bora treinar e revanche!' : 'O bichinho selvagem venceu essa. Treine mais e tente de novo.';
    rewardRow.style.display = 'none';
  } else {
    title.textContent = 'Empate!';
    sub.textContent = 'Os dois bichinhos caíram juntos.';
    rewardRow.style.display = 'none';
  }

  // o bichinho selvagem do mundo some depois do duelo (ganhando, perdendo ou empatando)
  // pra não ficar preso re-lutando em loop assim que volta pro mundo
  if(duel.source === 'world' && state.world && worldPendingEnemyId){
    const worldFoe = state.world.enemies.find(e => e.id === worldPendingEnemyId);
    if(worldFoe) worldFoe.alive = false;
    worldPendingEnemyId = null;
  }
  saveState();

  document.getElementById('duelResultModal').classList.add('active');
  clearInterval(window._guestUiInterval);
  closeOnlineConnection();
}

function closeDuelResult(){
  document.getElementById('duelResultModal').classList.remove('active');
  document.getElementById('screen-duelo').classList.remove('active');
  if(duel && duel.source === 'world'){
    document.getElementById('screen-world').classList.add('active');
    ensureWorldState();
    renderWorldStatic();
    worldLastFrameTs = performance.now();
    cancelAnimationFrame(worldRAF);
    worldRAF = requestAnimationFrame(worldLoop);
  } else {
    document.getElementById('screen-home').classList.add('active');
    renderHome();
  }
}

/* =========================================================
   DUELO ONLINE (2 jogadores, mesma rede Wi-Fi, via QR code)
   -------------------------------------------------------
   Um cria a sala (anfitrião) e mostra um QR code contendo um
   código de sala. O outro escaneia (convidado) e os dois se
   conectam direto (WebRTC/PeerJS), sem passar por servidor
   próprio nenhum.

   O anfitrião roda o duelo de verdade (é sempre o "p1", igual
   ao duelo vs IA) e manda um retrato do estado a cada 200ms.
   O convidado é um "terminal burro": manda só a carta que
   apertou e desenha o que o anfitrião mandar. Isso evita que
   os dois lados calculem coisas diferentes e desincronizem.
========================================================= */

