/* =========================================================
   ESTADO / PERSISTÊNCIA
========================================================= */
const SAVE_KEY = 'bichinhoElementalSave';
const MIN_STAT = 5;
const STAT_MAX = 1000; // valor de stat que enche a barra 100% na tela de status (antes era 100)
const DECAY_PER_DAY = 1.5;
const ELEMENTS = {
  fogo:  { label:'Fogo',  color:'var(--fire)',  c1:'#FFAE7A', c2:'#E8794A', dark:'#C0562E', special:'Círculo de Fogo' },
  terra: { label:'Terra', color:'var(--earth)', c1:'#C7D08A', c2:'#9CAA5E', dark:'#6E7A3E', belly:'#8B5E3C', special:'Muro de Terra' },
  ar:    { label:'Ar',    color:'var(--air)',   c1:'#F3FBFF', c2:'#D9EDF5', dark:'#A9CFE0', special:'Voo' },
  agua:  { label:'Água',  color:'var(--water)', c1:'#BEE0FF', c2:'#6FB3F0', dark:'#3E86C7', special:'Congelar' },
};

/* =========================================================
   CATÁLOGO DE PODERES (menu tipo "escolha suas cartas")
   — os stats (força/velocidade/defesa/especial) continuam sendo
   treinados normalmente e definem a FORÇA de cada poder; o que
   muda aqui é QUAIS poderes o jogador leva pro duelo.
========================================================= */
const LIVRE_MAX = 6;     // poderes livres equipáveis por duelo
const ESPECIAL_MAX = 2;  // poderes especiais equipáveis por duelo

/* Sistema de energia (tipo Clash Royale): cada poder custa energia pra ser jogado.
   A energia regenera continuamente em tempo real (não só 1x por rodada) — pensar rápido
   economiza tempo mas gasta a barra que teria regenerado; esperar um pouco enche mais a barra.
   Ataques pesados custam caro (não dá pra spammar); defesa/esquiva são baratas (sempre dá
   pra se proteger). */
const ENERGY_MAX = 100;
const ENERGY_REGEN_PER_SEC = 100 / 28; // velocidade do elixir do Clash Royale: barra cheia em ~28s

const POWER_DEFS = {
  forca:          { id:'forca',          name:'Investida',      icon:'💪',     category:'livre',    off:true,  weights:{forca:0.7, velocidade:0.2, precisao:0.1},   unlocked:true,  energyCost:35, desc:'Ataque físico direto: 70% Força, 20% Velocidade, 10% Precisão.' },
  defesa:         { id:'defesa',         name:'Escudo',         icon:'🛡️',     category:'livre',    off:false, weights:{resistencia:0.7, energia:0.3},              unlocked:true,  energyCost:12, desc:'Bloqueia o golpe: 70% Resistência, 30% Energia.' },
  velocidade:     { id:'velocidade',     name:'Esquiva',        icon:'⚡',     category:'livre',    off:false, weights:{velocidade:0.8, energia:0.2},               unlocked:true,  energyCost:12, desc:'Desvia do golpe: 80% Velocidade, 20% Energia.' },
  golpe_certeiro: { id:'golpe_certeiro', name:'Golpe Certeiro', icon:'🎯',     category:'livre',    off:true,  weights:{precisao:0.6, forca:0.3, velocidade:0.1},  unlocked:true,  energyCost:38, desc:'Ataque cirúrgico: 60% Precisão, 30% Força, 10% Velocidade. Counter contra Esquiva.' },
  investida_dupla: { id:'investida_dupla', name:'Investida Dupla', icon:'⚡💥', category:'livre',    off:true,  weights:{velocidade:0.6, forca:0.3, precisao:0.1}, unlocked:true,  energyCost:55, desc:'Ataque rápido: 60% Velocidade, 30% Força, 10% Precisão. Acerta 2x (segundo hit com 70% do dano).', multiHit:2, multiHitDecay:0.7 },
  furia:          { id:'furia',          name:'Fúria',           icon:'😠',     category:'livre',    off:true,  weights:{forca:0.6, energia:0.4},                   unlocked:true,  energyCost:60, desc:'Ataque bruto: 60% Força, 40% Energia. Drena parte da energia e cansa o bichinho por 2 rodadas (-35% nos próximos poderes).', exhaustEnergy:0.5, tiredPenalty:0.35, tiredDuration:2 },
  especial_fogo:  { id:'especial_fogo',  name:'Círculo de Fogo',icon:'🔥', category:'especial', off:true,  statKey:'especial',   unlocked:true,  element:'fogo',  energyCost:65, desc:'Queima o oponente por 2 rodadas.' },
  especial_terra: { id:'especial_terra', name:'Muro de Terra',  icon:'🪨', category:'especial', off:true,  statKey:'especial',   unlocked:true,  element:'terra', energyCost:65, desc:'Ergue um muro que amortece o próximo golpe.' },
  especial_ar:    { id:'especial_ar',    name:'Voo',            icon:'💨', category:'especial', off:true,  statKey:'especial',   unlocked:true,  element:'ar',    energyCost:65, desc:'Voa por 2 rodadas — só ataques de Terra alcançam você.' },
  especial_agua:  { id:'especial_agua',  name:'Congelar',       icon:'🧊', category:'especial', off:true,  statKey:'especial',   unlocked:true,  element:'agua',  energyCost:65, desc:'Congela o oponente, que perde a próxima rodada.' },
};
// vagas "em breve" mostradas no menu de livres (ainda não existem poderes reais aqui)
const LIVRE_SOON_COUNT = 0;

/* Valor de um poder a partir dos status de quem o usa.
   Poderes novos definem "weights": um objeto { status: fração } que soma 1
   (ex: forca:0.7, velocidade:0.2, precisao:0.1). O valor final é a soma de
   cada status vezes seu peso. Poderes antigos/ainda simples podem usar
   "statKey" (um único status, peso 1) — os especiais usam esse formato por ora. */
function powerValue(stats, def){
  if(def.weights){
    let total = 0;
    for(const stat in def.weights){
      total += (stats[stat] || 0) * def.weights[stat];
    }
    return total;
  }
  return stats[def.statKey] || 0;
}

function defaultEquippedPowers(element){
  return {
    livre: ['forca','defesa','velocidade'],
    especial: ['especial_' + element],
  };
}

/* elemento "de fato" usado num golpe: um poder especial carrega seu próprio
   elemento; um poder livre carrega o elemento do corpo do bichinho */
function pickElement(p){
  if(p.pick && POWER_DEFS[p.pick] && POWER_DEFS[p.pick].category === 'especial') return POWER_DEFS[p.pick].element;
  return p.element;
}

function defaultState(name, element){
  const now = Date.now();
  return {
    name, element,
    xp: 0,
    coins: 20,
    stats: { forca: MIN_STAT, velocidade: MIN_STAT, resistencia: MIN_STAT, especial: MIN_STAT, precisao: MIN_STAT, inteligencia: MIN_STAT, energia: MIN_STAT },
    lastTrained: { forca: now, velocidade: now, resistencia: now, especial: now, precisao: now, inteligencia: now, energia: now },
    unlockedElements: [element],
    evolved: false,
    createdAt: now,
    equippedPowers: defaultEquippedPowers(element),
    world: {
      x: Math.round(WORLD_WIDTH/2), y: Math.round(WORLD_HEIGHT/2),
      wood: 0, stone: 0,
      trees: genWorldTrees(),
      blocks: [],
      cycleStart: now,
      elapsedMs: 0, // tempo do ciclo dia/noite — só avança enquanto o jogo está aberto
      nightIndex: -1,
      enemies: [],
    },
  };
}

function loadState(){
  const raw = localStorage.getItem(SAVE_KEY);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch(e){ return null; }
}
function saveState(){ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

const FULLSCREEN_ICON_EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 3 3 3 3 8"></polyline><polyline points="16 3 21 3 21 8"></polyline><polyline points="3 16 3 21 8 21"></polyline><polyline points="21 16 21 21 16 21"></polyline></svg>';
const FULLSCREEN_ICON_COLLAPSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 8 8 8 3"></polyline><polyline points="16 3 16 8 21 8"></polyline><polyline points="21 16 16 16 16 21"></polyline><polyline points="8 21 8 16 3 16"></polyline></svg>';

function toggleFullscreen(){
  if(!document.fullscreenElement){
    document.documentElement.requestFullscreen?.().catch(()=>{});
  } else {
    document.exitFullscreen?.().catch(()=>{});
  }
}

function updateFullscreenBtnIcon(){
  const btn = document.getElementById('fullscreenBtn');
  if(!btn) return;
  btn.innerHTML = document.fullscreenElement ? FULLSCREEN_ICON_COLLAPSE : FULLSCREEN_ICON_EXPAND;
}
document.addEventListener('fullscreenchange', updateFullscreenBtnIcon);

let state = loadState();

/* =========================================================
   DECAIMENTO DIÁRIO
========================================================= */
function migrateState(s){
  if(s.stats.especial === undefined) s.stats.especial = MIN_STAT;
  if(s.lastTrained.especial === undefined) s.lastTrained.especial = Date.now();
  // renomeia a antiga stat "defesa" para "resistencia" (mesmo valor, novo nome)
  if(s.stats.defesa !== undefined && s.stats.resistencia === undefined){
    s.stats.resistencia = s.stats.defesa;
    delete s.stats.defesa;
  }
  if(s.lastTrained.defesa !== undefined && s.lastTrained.resistencia === undefined){
    s.lastTrained.resistencia = s.lastTrained.defesa;
    delete s.lastTrained.defesa;
  }
  // novos status: entram com o valor mínimo até ganharem seus próprios minigames
  ['resistencia','precisao','inteligencia','energia'].forEach(stat=>{
    if(s.stats[stat] === undefined) s.stats[stat] = MIN_STAT;
    if(s.lastTrained[stat] === undefined) s.lastTrained[stat] = Date.now();
  });
  if(!s.equippedPowers) s.equippedPowers = defaultEquippedPowers(s.element);
  if(!Array.isArray(s.equippedPowers.livre) || s.equippedPowers.livre.length === 0) s.equippedPowers.livre = ['forca','defesa','velocidade'];
  if(!Array.isArray(s.equippedPowers.especial) || s.equippedPowers.especial.length === 0) s.equippedPowers.especial = ['especial_' + s.element];
  if(s.coresBest === undefined) s.coresBest = 0;
  if(s.puloBest === undefined) s.puloBest = 0;
}

function applyDecay(s){
  const now = Date.now();
  const dayMs = 1000*60*60*24;
  // só decai o que já tem minigame pra ser retreinado; Precisão treina com Mira,
  // Velocidade com Corrida, Resistência com Defesa, Especial com o minigame Especial,
  // Inteligência treina com Cores, Energia treina com Pulo, Força treina com Arremesso de Peso.
  ['velocidade','resistencia','especial','precisao','inteligencia','energia','forca'].forEach(stat=>{
    const last = s.lastTrained[stat] || s.createdAt;
    const daysPassed = Math.floor((now - last) / dayMs);
    if(daysPassed > 0){
      const decay = daysPassed * DECAY_PER_DAY;
      s.stats[stat] = Math.max(MIN_STAT, s.stats[stat] - decay);
      s.lastTrained[stat] = now - ((now-last) % dayMs); // avanca a referencia, evita re-decair no mesmo dia
    }
  });
}

/* =========================================================
   NÍVEL / EVOLUÇÃO
========================================================= */
// XP necessário pra "fechar" o nível n (ex: cumulativeXpForLevel(1) = 60 é o total
// pra sair do nível 1 e chegar no nível 2). O custo de cada nível sobe 20 a mais que o anterior:
// nível 1→2 = 60, nível 2→3 = 80, nível 3→4 = 100, etc. (custo(n) = 40 + 20n)
function cumulativeXpForLevel(n){ return 10*n*n + 50*n; }

function levelFromXp(xp){
  if(xp <= 0) return 1;
  // acha o maior n tal que cumulativeXpForLevel(n) <= xp; o nível é n+1
  let n = Math.max(0, Math.floor((-5 + Math.sqrt(25 + 0.4*xp)) / 2));
  while(cumulativeXpForLevel(n+1) <= xp) n++;
  while(n > 0 && cumulativeXpForLevel(n) > xp) n--;
  return n + 1;
}
function xpForNextLevel(level){ return level*60; }
function dominantStat(s){
  const st = s.stats;
  return Object.keys(st).reduce((a,b)=> st[a] >= st[b] ? a : b);
}

/* =========================================================
   RENDER: BLOB SVG (nível 1, forma simples tipo Jigglypuff)
========================================================= */
let _blobInstanceCounter = 0;
const DUEL_SPRITES_BACK = {
  agua:  'https://i.imgur.com/o6wLngm.png',
  ar:    'https://i.imgur.com/Tn3ny0H.png',
  fogo:  'https://i.imgur.com/UHfjILk.png',
  terra: 'https://i.imgur.com/dPPVqFG.png',
};
const DUEL_SPRITES_FRONT = {
  agua:  'https://i.imgur.com/JgQ7e6i.png',
  ar:    'https://i.imgur.com/SI6SMe6.png',
  fogo:  'https://i.imgur.com/Y2cPmtf.png',
  terra: 'https://i.imgur.com/9xzCBhc.png',
};
// GIF que toca só no instante em que o bichinho daquele elemento leva dano no duelo.
// Depois de HIT_ANIM_MS ele volta pra imagem estática normal.
const DUEL_HIT_GIFS = {
  fogo: 'https://i.imgur.com/aHenwY8.gif',
};
const HIT_ANIM_MS = 800;
const _hitAnimTimers = { self: null, opp: null };
const _hitAnimActive = { self: false, opp: false };
