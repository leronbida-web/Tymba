// Catálogo de itens do inventário do mundo. Pra adicionar um item novo no futuro
// (ex: picareta), basta acrescentar uma entrada aqui — o painel se atualiza sozinho.
// get(w) retorna a quantidade (ou 1/0 pra itens únicos tipo ferramentas via 'owned').
// 'resource' = bloqueia que podem ser colocados no chão (build mode). 'tool' = equipamento
// (hand tool vai pra equippedTool; armadura/vela são toggles separados).
const WORLD_INVENTORY_ITEMS = [
  // recursos básicos
  { key:'wood',    icon:'🪵', label:'Madeira',         type:'resource', get:(w) => w.wood    || 0 },
  { key:'stone',   icon:'🪨', label:'Pedra',            type:'resource', get:(w) => w.stone   || 0 },
  // materiais dropados por Tymbas selvagens (viraram 'resource' porque agora entram em receita de craft)
  { key:'ironOre', icon:'⛓️', label:'Minério de Ferro', type:'resource', get:(w) => w.ironOre || 0 },
  { key:'cotton',  icon:'🧶', label:'Algodão',         type:'resource', get:(w) => w.cotton  || 0 },
  { key:'match',   icon:'🔥', label:'Fósforo',         type:'resource', get:(w) => w.match   || 0 },
  { key:'wax',     icon:'🕯️', label:'Cera',            type:'resource', get:(w) => w.wax     || 0 },
  // ferramentas (mão direita)
  { key:'axe',     icon:'🪓', label:'Machado',         type:'tool', owned:(w) => !!w.hasAxe,     slot:'hand' },
  { key:'pickaxe', icon:'⛏️', label:'Picareta',        type:'tool', owned:(w) => !!w.hasPickaxe, slot:'hand' },
  { key:'sword',   icon:'🗡️', label:'Espada',          type:'tool', owned:(w) => !!w.hasSword,   slot:'hand' },
  // equipamentos (corpo / mão esquerda)
  { key:'armor',   icon:'🛡️', label:'Armadura',        type:'tool', owned:(w) => !!w.hasArmor,   slot:'armor' },
  { key:'candle',  icon:'🔥', label:'Vela',            type:'tool', owned:(w) => !!w.hasCandle,  slot:'candle' },
];

// Tabela de drops por elemento: cada Tymba selvagem abatido com a espada dropa 1
// material de acordo com o elemento dele. As chaves batem com `e.element` (fogo/agua/ar/terra).
// O label aqui é só pro toast — o item em si já vem do WORLD_INVENTORY_ITEMS.
const WORLD_ENEMY_DROPS = {
  fogo:  { invKey:'match',   label:'Fósforo' },
  agua:  { invKey:'wax',     label:'Cera' },
  ar:    { invKey:'cotton',  label:'Algodão' },
  terra: { invKey:'ironOre', label:'Minério de Ferro' },
};

function renderWorldInventory(){
  const grid = document.getElementById('worldInventoryGrid');
  if(!grid) return;
  const w = state.world;
  if(!w){ grid.innerHTML = ''; return; }
  const cards = WORLD_INVENTORY_ITEMS.map(item => {
    const isTool = item.type === 'tool';
    const owned = isTool ? item.owned(w) : (item.get(w) > 0);
    const countHtml = isTool
      ? (owned ? '✓' : '—')
      : String(item.get(w));
    const isSelected = isTool ? (w.equippedTool === item.key) : (worldBuildMode === item.key);
    const classes = 'world-inventory-item' + (owned ? '' : ' is-empty') + (isSelected ? ' is-selected' : '');
    return '<div class="' + classes + '" onclick="selectWorldInventoryItem(\'' + item.key + '\')">' +
      '<div class="world-inventory-item-icon">' + item.icon + '</div>' +
      '<div class="world-inventory-item-count">' + countHtml + '</div>' +
      '<div class="world-inventory-item-label">' + item.label + '</div>' +
    '</div>';
  }).join('');
  grid.innerHTML = cards || '<div class="world-inventory-empty-msg">Nenhum item ainda. Explore o mundo pra coletar!</div>';
}

// chamada ao tocar num item do inventário: ferramenta vai pra mão do player
// (substitui a que já estava equipada) e recurso (madeira/pedra) ativa o modo
// de construção com aquele material — sempre fecha o inventário em seguida.
function selectWorldInventoryItem(key){
  const w = state.world;
  if(!w) return;
  const item = WORLD_INVENTORY_ITEMS.find(i => i.key === key);
  if(!item) return;

  if(item.type === 'tool'){
    if(!item.owned(w)){ toast('Você ainda não construiu esse item.'); return; }
    if(item.slot === 'armor'){
      // armadura: toggle on/off. Fica no corpo, então é independente da ferramenta em mãos
      w.wearingArmor = !w.wearingArmor;
      toast(w.wearingArmor ? '🛡️ Armadura vestida!' : '🛡️ Armadura guardada.');
    } else if(item.slot === 'candle'){
      // vela: toggle on/off. Fica na outra mão, também independente
      w.equippedCandle = !w.equippedCandle;
      toast(w.equippedCandle ? '🔥 Vela acesa!' : '🔥 Vela guardada.');
    } else {
      // hand tool (machado/picareta/espada) — equipa na mão direita
      w.equippedTool = key;
      toggleBuildMode(null);
      toast(item.icon + ' ' + item.label + ' equipada!');
    }
  } else {
    if(item.get(w) <= 0){ toast('Sem ' + item.label.toLowerCase() + ' suficiente.'); return; }
    w.equippedTool = null; // solta a ferramenta pra segurar o material de construção
    toggleBuildMode(key);
    toast(item.icon + ' ' + item.label + ' selecionada! Toque no chão pra construir.');
  }
  saveState();
  updateWorldAxeVisual();
  updateWorldPickaxeVisual();
  updateWorldSwordVisual();
  updateWorldArmorVisual();
  updateWorldCandleVisual();
  updateWorldHandPill();
  toggleWorldInventory(false);
}

function toggleWorldInventory(force){
  const overlay = document.getElementById('worldInventoryOverlay');
  if(!overlay) return;
  const shouldOpen = (force === undefined) ? !overlay.classList.contains('open') : !!force;
  overlay.classList.toggle('open', shouldOpen);
  if(shouldOpen) renderWorldInventory();
}

// Catálogo do guia de construções. Pra adicionar um item novo no futuro, basta
// acrescentar uma entrada aqui apontando pro padrão (cells) já usado no craft —
// o desenho da mini-grade é gerado sozinho a partir dele.
const WORLD_BUILD_GUIDE = [
  { key:'axe', icon:'🪓', label:'Machado', desc:'2 pedras lado a lado em cima + 2 madeiras empilhadas embaixo.',
    cells: WORLD_AXE_PATTERN },
  { key:'pickaxe', icon:'⛏️', label:'Picareta', desc:'3 pedras lado a lado em cima + 2 madeiras empilhadas embaixo.',
    cells: WORLD_PICKAXE_PATTERN },
  { key:'sword', icon:'🗡️', label:'Espada', desc:'2 pedras + 1 madeira empilhados numa coluna só.',
    cells: WORLD_SWORD_PATTERN },
  { key:'armor', icon:'🛡️', label:'Armadura', desc:'4 minérios de ferro em cima + 2 minérios no meio + 2 algodões embaixo.',
    cells: WORLD_ARMOR_PATTERN },
  { key:'candle', icon:'🔥', label:'Vela', desc:'1 fósforo em cima + 2 ceras empilhadas embaixo (coluna de 3).',
    cells: WORLD_CANDLE_PATTERN },
  { key:'house-wood', icon:'🏠', label:'Casa de Madeira', desc:'8 madeiras em formato de portal (o vão do meio fica livre). Dura 5 dias do mundo.',
    cells: WORLD_HOUSE_PATTERN.map(([dx, dy]) => ({ dx, dy, type:'wood' })), gate: WORLD_HOUSE_GATE_CELLS },
  { key:'house-stone', icon:'🪨🏠', label:'Casa de Pedra', desc:'8 pedras em formato de portal (o vão do meio fica livre). Dura 30 dias do mundo.',
    cells: WORLD_HOUSE_PATTERN.map(([dx, dy]) => ({ dx, dy, type:'stone' })), gate: WORLD_HOUSE_GATE_CELLS },
];

// desenha a mini-grade de um padrão de construção: cada célula preenchida mostra
// o material exigido naquela posição; células do "gate" (vão livre da casa) aparecem
// tracejadas; o resto fica em branco só pra dar noção do formato geral
function worldGuideGridHtml(cells, gate){
  gate = gate || [];
  const allDx = cells.map(c => c.dx).concat(gate.map(([dx]) => dx));
  const allDy = cells.map(c => c.dy).concat(gate.map(([, dy]) => dy));
  const minDx = Math.min(...allDx), maxDx = Math.max(...allDx);
  const minDy = Math.min(...allDy), maxDy = Math.max(...allDy);
  const cols = maxDx - minDx + 1, rows = maxDy - minDy + 1;
  // mapa tipo→ícone pra todos os materiais do mundo (recurso ou tool)
  const iconByType = {
    wood:'🪵', stone:'🪨',
    ironOre:'⛓️', cotton:'🧶', match:'🔥', wax:'🕯️',
  };
  let html = '<div class="world-guide-grid" style="grid-template-columns:repeat(' + cols + ',26px); grid-template-rows:repeat(' + rows + ',26px);">';
  for(let gy = minDy; gy <= maxDy; gy++){
    for(let gx = minDx; gx <= maxDx; gx++){
      const cell = cells.find(c => c.dx === gx && c.dy === gy);
      if(cell){
        html += '<div class="world-guide-cell filled" data-type="' + cell.type + '">' + (iconByType[cell.type] || '·') + '</div>';
      } else if(gate.some(([dx, dy]) => dx === gx && dy === gy)){
        html += '<div class="world-guide-cell gate"></div>';
      } else {
        html += '<div class="world-guide-cell"></div>';
      }
    }
  }
  html += '</div>';
  return html;
}

function renderWorldGuide(){
  const list = document.getElementById('worldGuideList');
  if(!list) return;
  list.innerHTML = WORLD_BUILD_GUIDE.map(item => {
    return '<div class="world-guide-item">' +
      '<div class="world-guide-item-header">' + item.icon + ' <strong>' + item.label + '</strong></div>' +
      worldGuideGridHtml(item.cells, item.gate) +
      '<div class="world-guide-item-desc">' + item.desc + '</div>' +
    '</div>';
  }).join('');
}

function toggleWorldGuide(force){
  const overlay = document.getElementById('worldGuideOverlay');
  if(!overlay) return;
  const shouldOpen = (force === undefined) ? !overlay.classList.contains('open') : !!force;
  overlay.classList.toggle('open', shouldOpen);
  if(shouldOpen) renderWorldGuide();
}

// clique no ancião: só abre o diálogo se o player estiver perto o suficiente.
// se a casa já foi construída e o jogador ainda não viu o aviso sobre os perigos
// mais fortes, marca como visto e mostra a segunda fala (em vez da de boas-vindas).
function tapWorldElder(){
  const w = state.world;
  if(!w) return;
  if(Math.hypot(w.x - WORLD_ELDER_POS.x, w.y - WORLD_ELDER_POS.y) > WORLD_ELDER_TALK_RADIUS){
    toast('Chegue mais perto do ancião!');
    return;
  }
  w.hasMetElder = true;
  // decide ANTES de mutar o estado qual fala mostrar — se marcasse hasSeenElderSecondMessage=true
  // antes do render, o renderizador leria o flag já alterado e cairia no "else" (boas-vindas) de novo
  const showDanger = !!(w.hasBuiltHouse && !w.hasSeenElderSecondMessage);
  if(showDanger){
    w.hasSeenElderSecondMessage = true;
  }
  saveState();
  renderElderDialog(showDanger);
  toggleWorldElderDialog(true);
}

function toggleWorldElderDialog(force){
  const overlay = document.getElementById('worldElderOverlay');
  if(!overlay) return;
  const shouldOpen = (force === undefined) ? !overlay.classList.contains('open') : !!force;
  overlay.classList.toggle('open', shouldOpen);
}

// textos das duas falas do ancião. Centralizados aqui pra ficar fácil ajustar a redação sem
// ter que caçar em HTML/JS espalhado.
const ELDER_WELCOME_TEXT = 'Bem vindo jovem, que bom vê-lo por aqui. Essas terras são lindas essa época do ano, mas muito cuidado à noite os Tymbas ficam agressivos, construa uma casa para se proteger. Ferramentas serão muito úteis, pegue esse pergaminho:';
const ELDER_DANGER_TEXT = 'Muito bem, mas tem coisas muito mais perigosas que Tymbas selvagens por aqui, faça uma espada e uma armadura para se defender e um pouco de luz para a noite seria muito útil também';

// troca o conteúdo do diálogo do ancião de acordo com o estado do mundo.
// aceita `forceDanger` (opcional) pra forçar uma das falas sem depender do estado — útil
// quando o caller já sabe qual fala quer mostrar e acabou de mutar flags que confundiriam a leitura.
// - antes da 1ª casa construída (ou depois do 2º aviso já lido): mensagem de boas-vindas + botão "Abrir guia"
// - depois da 1ª casa construída e antes do 2º aviso ter sido lido: aviso sobre perigos + botão "Vou me preparar" (só fecha)
function renderElderDialog(forceDanger){
  const w = state.world;
  const text = document.getElementById('worldElderText');
  const btn = document.getElementById('worldElderBtn');
  if(!text || !btn) return;
  const showDanger = forceDanger !== undefined
    ? !!forceDanger
    : !!(w && w.hasBuiltHouse && !w.hasSeenElderSecondMessage);
  const icon = btn.querySelector('.icon');
  const label = btn.querySelector('.label');
  if(showDanger){
    text.textContent = ELDER_DANGER_TEXT;
    if(icon) icon.textContent = '💪';
    if(label) label.textContent = 'Vou me preparar';
    btn.onclick = () => toggleWorldElderDialog(false);
  } else {
    text.textContent = ELDER_WELCOME_TEXT;
    if(icon) icon.textContent = '📜';
    if(label) label.textContent = 'Abrir guia';
    btn.onclick = () => { toggleWorldElderDialog(false); toggleWorldGuide(true); };
  }
}

function worldGridKey(gx, gy){ return gx + '_' + gy; }
function worldBlocksGridMap(blocks){
  const map = {};
  blocks.forEach(b => { map[worldGridKey(b.gx, b.gy)] = b; });
  return map;
}
function worldHouseCenter(h){
  return {
    x: h.originX + (WORLD_HOUSE_COLS * WORLD_GRID) / 2,
    y: h.originY + (WORLD_HOUSE_ROWS * WORLD_GRID) / 2,
  };
}
function isNearAnyHouse(w, x, y, extraRadius){
  extraRadius = extraRadius || 0;
  if(!w.houses || !w.houses.length) return false;
  return w.houses.some(h => {
    const c = worldHouseCenter(h);
    return Math.hypot(x - c.x, y - c.y) <= (WORLD_HOUSE_SAFE_RADIUS + extraRadius);
  });
}
function worldRandomSpotAwayFromHouses(margin){
  const w = state.world;
  let spot = worldRandomSpot(margin);
  if(!w || !w.houses || !w.houses.length) return spot;
  for(let tries = 0; tries < 20 && isNearAnyHouse(w, spot.x, spot.y); tries++){
    spot = worldRandomSpot(margin);
  }
  return spot;
}

function worldRandomSpot(margin){
  return {
    x: Math.round(margin + Math.random() * (WORLD_WIDTH - margin*2)),
    y: Math.round(margin + Math.random() * (WORLD_HEIGHT - margin*2)),
  };
}

function genWorldTrees(){
  const trees = [];
  const cols = 6, rows = 5;
  const cellW = WORLD_WIDTH / cols, cellH = WORLD_HEIGHT / rows;
  let i = 0;
  for(let r = 0; r < rows && i < WORLD_TREE_COUNT; r++){
    for(let c = 0; c < cols && i < WORLD_TREE_COUNT; c++){
      if(Math.random() < 0.18) continue; // deixa alguns buracos, não é uma grade perfeita
      const x = Math.round(cellW*c + cellW*0.25 + Math.random()*cellW*0.5);
      const y = Math.round(cellH*r + cellH*0.25 + Math.random()*cellH*0.5);
      trees.push({ id:'t'+i, x, y, alive:true, respawnAt:0, hits:0 });
      i++;
    }
  }
  return trees;
}

function genWorldRocks(){
  const rocks = [];
  for(let i = 0; i < WORLD_ROCK_COUNT; i++){
    const spot = worldRandomSpot(120);
    rocks.push({ id:'r'+i, x: spot.x, y: spot.y, alive:true, respawnAt:0 });
  }
  return rocks;
}

function genWorldEnemies(count, idPrefix){
  const n = count === undefined ? WORLD_ENEMY_COUNT : count;
  const prefix = idPrefix || 'e';
  const enemies = [];
  for(let i = 0; i < n; i++){
    const spot = worldRandomSpotAwayFromHouses(140);
    const target = worldRandomSpotAwayFromHouses(140);
    enemies.push({
      id: prefix + Date.now() + '_' + i, x: spot.x, y: spot.y,
      tx: target.x, ty: target.y,
      element: randomElement(), alive:true,
      facing:'front', flip:false,
    });
  }
  return enemies;
}

function ensureWorldState(){
  if(!state.world){
    state.world = {
      x: Math.round(WORLD_WIDTH/2), y: Math.round(WORLD_HEIGHT/2),
      wood: 0, stone: 0,
      hasAxe: false,
      hasPickaxe: false,
      hasSword: false,
      equippedTool: null, // 'axe' | 'pickaxe' | 'sword' | null — ferramenta atualmente na mão do player
      hasMetElder: false, // controla se o diálogo de boas-vindas do ancião já abriu sozinho uma vez
      hasBuiltHouse: false, // quando vira true, a ponta do cajado do ancião passa a brilhar (sinaliza que tem mais conversa)
      hasSeenElderSecondMessage: false, // one-shot: marca se o ancião já deu o aviso sobre os perigos mais fortes
      // materiais dropados por Tymbas selvagens quando abatidos com a espada
      cotton: 0,  // ar
      match: 0,   // fogo
      wax: 0,     // água
      ironOre: 0, // terra
      // equipamentos novos (craftados via padrão de blocos)
      hasArmor: false, wearingArmor: false,   // corpo
      hasCandle: false, equippedCandle: false, // mão esquerda / slot secundário
      trees: genWorldTrees(),
      rocks: genWorldRocks(),
      blocks: [],
      houses: [],
      cycleStart: Date.now(),
      elapsedMs: 0, // tempo do ciclo dia/noite — só avança enquanto o jogo está aberto
      nightIndex: -1,
      nightBoosted: false,
      enemies: [],
    };
    saveState();
    return;
  }
  const w = state.world;
  let migrated = false;
  if(w.elapsedMs === undefined){
    // migração: converte o tempo de relógio real já passado pra "tempo ativo" acumulado,
    // preservando a fase atual de dia/noite — só cresce a partir de agora enquanto o jogo estiver aberto
    w.elapsedMs = Date.now() - w.cycleStart;
    migrated = true;
  }
  if(w.y === undefined){
    // migração de saves antigos (mundo só horizontal) pra mundo livre em 2D
    w.y = Math.round(WORLD_HEIGHT/2);
    w.trees = genWorldTrees();
    w.rocks = genWorldRocks();
    w.enemies = [];
    migrated = true;
  }
  if(w.rocks === undefined){
    // migração de saves que ainda não tinham rochas
    w.rocks = genWorldRocks();
    migrated = true;
  }
  if(w.trees.length && w.trees[0].hits === undefined){
    // migração: árvores antigas não tinham contador de golpes
    w.trees.forEach(t => { t.hits = 0; });
    migrated = true;
  }
  if(w.rocks.length && w.rocks[0].hits === undefined){
    // migração: rochas antigas não tinham contador de golpes
    w.rocks.forEach(r => { r.hits = 0; });
    migrated = true;
  }
  if(w.houses === undefined){
    // migração de saves que ainda não tinham o sistema de casas
    w.houses = [];
    migrated = true;
  }
  if(w.blocks.some(b => b.gx === undefined)){
    // migração: blocos antigos não estavam alinhados numa grade — realinha pra grade mais próxima
    w.blocks.forEach(b => {
      if(b.gx === undefined){
        b.gx = Math.round(b.x / WORLD_GRID);
        b.gy = Math.round(b.y / WORLD_GRID);
        b.x = b.gx * WORLD_GRID;
        b.y = b.gy * WORLD_GRID;
      }
    });
    migrated = true;
  }
  if(w.hasAxe === undefined){
    // migração de saves que ainda não tinham o sistema de machado
    w.hasAxe = false;
    migrated = true;
  }
  if(w.hasPickaxe === undefined){
    // migração de saves que ainda não tinham o sistema de picareta
    w.hasPickaxe = false;
    migrated = true;
  }
  if(w.hasSword === undefined){
    // migração de saves que ainda não tinham o sistema de espada
    w.hasSword = false;
    migrated = true;
  }
  if(w.equippedTool === undefined){
    // migração: saves antigos já com machado craftado continuam com ele equipado na mão
    w.equippedTool = w.hasAxe ? 'axe' : null;
    migrated = true;
  }
  if(w.hasMetElder === undefined){
    // migração: saves antigos já exploraram o mundo, então não precisam ver o
    // diálogo de boas-vindas abrir sozinho (mas o ancião continua clicável)
    w.hasMetElder = true;
    migrated = true;
  }
  if(w.hasBuiltHouse === undefined){
    // migração: quem já jogou antes e construiu casa liga o brilho do cajado direto
    w.hasBuiltHouse = !!(w.houses && w.houses.length);
    migrated = true;
  }
  if(w.hasSeenElderSecondMessage === undefined){
    // migração: o aviso novo do ancião ainda não foi lido por ninguém (entra como false pra permitir a 1ª vez)
    w.hasSeenElderSecondMessage = false;
    migrated = true;
  }
  // migração: materiais dropados por Tymbas selvagens. Quem jogou antes não dropou nada,
  // então entram zerados (o player vai ter que caçar pra acumular)
  ['cotton','match','wax','ironOre'].forEach(k => {
    if(w[k] === undefined){ w[k] = 0; migrated = true; }
  });
  // migração: equipamentos novos (armadura/vela). Quem não tem, entra sem ter
  if(w.hasArmor === undefined){ w.hasArmor = false; migrated = true; }
  if(w.wearingArmor === undefined){ w.wearingArmor = false; migrated = true; }
  if(w.hasCandle === undefined){ w.hasCandle = false; migrated = true; }
  if(w.equippedCandle === undefined){ w.equippedCandle = false; migrated = true; }
  if(migrated) saveState();
}

function worldEnemyCoinReward(level){
  return 10 + level * 4; // quanto maior o nível do jogador, mais moedas o inimigo dá
}

function worldCycleInfo(){
  const w = state.world;
  const fullCycle = WORLD_CYCLE_MS * 2;
  // usa o tempo acumulado só enquanto o jogo esteve aberto (não o relógio real),
  // assim fechar o jogo por dias não gera uma recompensa gigante acumulada ao voltar
  const elapsed = w.elapsedMs || 0;
  const cyclePos = ((elapsed % fullCycle) + fullCycle) % fullCycle;
  const isDay = cyclePos < WORLD_CYCLE_MS;
  const nightIndex = Math.floor(elapsed / fullCycle);
  const phaseElapsed = isDay ? cyclePos : cyclePos - WORLD_CYCLE_MS;
  const phaseRemainMs = WORLD_CYCLE_MS - phaseElapsed;
  return { isDay, nightIndex, phaseRemainMs };
}

function worldTreeSvg(){
  return '<img src="https://i.imgur.com/9Gb9fZs.png" style="width:100%; height:100%; object-fit:contain; pointer-events:none;" draggable="false">';
}

function worldRockSvg(){
  return '<img src="https://i.imgur.com/XSMTZnJ.png" style="width:100%; height:100%; object-fit:contain; pointer-events:none;" draggable="false">';
}

// Sprites das casas por tipo de material + nível. Adicione novos casos (nível 2, 3...)
// trocando/acrescentando o src. Hospede cada sprite no Imgur e cole a URL direta aqui.
const WORLD_HOUSE_SPRITES = {
  wood: {
    1: 'https://i.imgur.com/E3K1nra.png',
    // 2: 'https://i.imgur.com/sua-imagem-nivel-2.png',
  },
  stone: {
    1: 'https://i.imgur.com/W2Ps6yY.png',
  },
};
function worldHouseSvg(type, level){
  type = type || 'wood';
  level = level || 1;
  // cada tipo/nível pode ter sua própria sprite
  const src = (WORLD_HOUSE_SPRITES[type] || {})[level];
  if(src){
    return '<img src="' + src + '" alt="Casa ' + type + ' nível ' + level + '" ' +
      'style="width:100%;height:100%;display:block;object-fit:contain;image-rendering:auto;" />';
  }
  // fallback genérico: moldura de madeira em formato de portal (mesma do nível 1 original)
  return '<svg viewBox="0 0 176 132" width="100%" height="100%">' +
    '<rect x="3" y="3" width="170" height="38" rx="12" fill="#A9713F" stroke="#5F3D1C" stroke-width="4"/>' +
    '<rect x="3" y="41" width="38" height="88" rx="12" fill="#A9713F" stroke="#5F3D1C" stroke-width="4"/>' +
    '<rect x="135" y="41" width="38" height="88" rx="12" fill="#A9713F" stroke="#5F3D1C" stroke-width="4"/>' +
    '<rect x="14" y="15" width="148" height="7" rx="3.5" fill="#8A5A2E" opacity="0.55"/>' +
    '<rect x="12" y="55" width="14" height="60" rx="4" fill="#8A5A2E" opacity="0.4"/>' +
    '<rect x="150" y="55" width="14" height="60" rx="4" fill="#8A5A2E" opacity="0.4"/>' +
    '<polygon points="70,8 88,-2 106,8 106,18 88,10 70,18" fill="#FFD65C" stroke="#B98A1F" stroke-width="2"/>' +
    '</svg>';
}

let worldEnemyEls = {};
let worldTreeEls = {};
function renderWorldStatic(){
  const layer = document.getElementById('worldLayer');
  const entities = document.getElementById('worldEntities');
  if(!layer || !entities) return;
  layer.style.width = WORLD_WIDTH + 'px';
  layer.style.height = WORLD_HEIGHT + 'px';
  entities.innerHTML = '';
  worldEnemyEls = {};
  worldTreeEls = {};
  const w = state.world;

  // árvores, rochas, blocos, casas e inimigos usam z-index = posição Y (profundidade),
  // assim o player (que também recebe z-index = sua posição Y) passa por trás
  // ou na frente deles dependendo de quem está "mais embaixo" na tela
  w.trees.forEach(t => {
    const el = document.createElement('div');
    el.className = 'world-tree' + (t.alive ? '' : ' chopped');
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    el.style.zIndex = Math.round(t.y);
    el.innerHTML = worldTreeSvg();
    el.onclick = (ev) => { ev.stopPropagation(); chopTree(t.id); };
    entities.appendChild(el);
    worldTreeEls[t.id] = el;
  });

  w.rocks.forEach(r => {
    const el = document.createElement('div');
    el.className = 'world-rock' + (r.alive ? '' : ' chopped');
    if(!r.alive) el.style.display = 'none';
    el.style.left = r.x + 'px';
    el.style.top = r.y + 'px';
    el.style.zIndex = Math.round(r.y);
    el.innerHTML = worldRockSvg();
    el.onclick = (ev) => { ev.stopPropagation(); tapRock(r.id); };
    entities.appendChild(el);
  });

  w.blocks.forEach(b => {
    const el = document.createElement('div');
    el.className = 'world-block ' + b.type;
    el.style.left = b.x + 'px';
    el.style.top = b.y + 'px';
    el.style.zIndex = Math.round(b.y);
    el.onclick = (ev) => { ev.stopPropagation(); removeLooseBlock(b.id); };
    entities.appendChild(el);
  });

  w.houses.forEach(h => {
    const el = document.createElement('div');
    el.className = 'world-house';
    el.style.left = h.originX + 'px';
    el.style.top = h.originY + 'px';
    el.style.width = (WORLD_HOUSE_COLS * WORLD_GRID) + 'px';
    el.style.height = (WORLD_HOUSE_ROWS * WORLD_GRID) + 'px';
    el.style.zIndex = Math.round(h.originY + WORLD_HOUSE_ROWS * WORLD_GRID);
    el.innerHTML = worldHouseSvg(h.type, h.level);
    entities.appendChild(el);
  });

  const elderEl = document.createElement('div');
  elderEl.className = 'world-elder';
  elderEl.style.left = WORLD_ELDER_POS.x + 'px';
  elderEl.style.top = WORLD_ELDER_POS.y + 'px';
  elderEl.style.zIndex = Math.round(WORLD_ELDER_POS.y);
  // a div do brilho da ponta do cajado fica sempre no DOM (display:none por padrão no CSS),
  // e a classe .on é adicionada quando a casa já foi construída — assim o brilho aparece na hora
  // logo depois do build, sem precisar esperar o próximo re-render completo do mundo
  const staffGlow = '<div class="world-elder-staff-glow' + (w.hasBuiltHouse ? ' on' : '') + '"></div>';
  elderEl.innerHTML = '<img src="' + WORLD_ELDER_SPRITE + '" alt="Ancião"><div class="world-elder-glow"></div>' + staffGlow;
  elderEl.onclick = (ev) => { ev.stopPropagation(); tapWorldElder(); };
  entities.appendChild(elderEl);

  w.enemies.filter(e => e.alive).forEach(e => {
    const el = document.createElement('div');
    el.className = 'world-enemy';
    el.style.left = e.x + 'px';
    el.style.top = e.y + 'px';
    el.style.zIndex = Math.round(e.y);
    const flipClass = e.flip ? ' flip' : '';
    el.innerHTML = '<div class="world-enemy-sprite' + flipClass + '"><div class="world-enemy-sprite-inner" style="background-image:url(\'' + (e.facing === 'back' ? DUEL_SPRITES_BACK : DUEL_SPRITES_FRONT)[e.element] + '\');"></div></div>';
    el.onclick = (ev) => { ev.stopPropagation(); tapWorldEnemy(e.id); };
    entities.appendChild(el);
    worldEnemyEls[e.id] = el;
  });

  const playerImg = document.getElementById('worldPlayerImgInner');
  if(playerImg) playerImg.style.backgroundImage = "url('" + DUEL_SPRITES_FRONT[state.element] + "')";
  worldFacing = 'front';
  worldFlipped = false;
  updateWorldAxeVisual();
  updateWorldPickaxeVisual();
  updateWorldSwordVisual();
  updateWorldArmorVisual();
  updateWorldCandleVisual();
  updateWorldHandPill();
}

function chopTree(id){
  const w = state.world;
  const t = w.trees.find(t => t.id === id);
  if(!t || !t.alive) return;
  if(Math.hypot(w.x - t.x, w.y - t.y) > WORLD_CHOP_RADIUS){ toast('Chegue mais perto da árvore!'); return; }

  t.hits = (t.hits || 0) + 1;
  const hitsNeeded = w.equippedTool === 'axe' ? WORLD_TREE_HITS_NEEDED_AXE : WORLD_TREE_HITS_NEEDED;

  const el = worldTreeEls[id];
  if(el){
    el.classList.remove('hit-shake');
    void el.offsetWidth; // reinicia a animação mesmo em golpes seguidos
    el.classList.add('hit-shake');
  }
  if(w.equippedTool === 'axe') swingPlayerAxe();

  if(t.hits >= hitsNeeded){
    t.alive = false;
    t.hits = 0;
    t.respawnAt = Date.now() + WORLD_TREE_RESPAWN_MS;
    w.wood += 1;
    toast('🪵 Madeira coletada!');
    saveState();
    renderWorldStatic();
  } else {
    toast('Golpe ' + t.hits + '/' + hitsNeeded);
    saveState();
  }
}

// balança o machado na mão do player (feedback visual de cada golpe de corte)
function swingPlayerAxe(){
  const axeEl = document.getElementById('worldPlayerAxe');
  if(!axeEl) return;
  axeEl.classList.remove('swing');
  void axeEl.offsetWidth; // reinicia a animação mesmo em golpes seguidos
  axeEl.classList.add('swing');
}

// mostra/esconde o machado na mão do player, conforme a ferramenta equipada
// (o indicador único do HUD é atualizado à parte por updateWorldHandPill())
function updateWorldAxeVisual(){
  const w = state.world;
  const has = !!(w && w.equippedTool === 'axe');
  const axeEl = document.getElementById('worldPlayerAxe');
  if(axeEl) axeEl.classList.toggle('show', has);
}

// balança a picareta na mão do player (feedback visual de cada golpe na rocha)
function swingPlayerPickaxe(){
  const pickEl = document.getElementById('worldPlayerPickaxe');
  if(!pickEl) return;
  pickEl.classList.remove('swing');
  void pickEl.offsetWidth; // reinicia a animação mesmo em golpes seguidos
  pickEl.classList.add('swing');
}

// mostra/esconde a picareta na mão do player, conforme a ferramenta equipada
function updateWorldPickaxeVisual(){
  const w = state.world;
  const has = !!(w && w.equippedTool === 'pickaxe');
  const pickEl = document.getElementById('worldPlayerPickaxe');
  if(pickEl) pickEl.classList.toggle('show', has);
}

// balança a espada na mão do player (feedback visual de cada abate)
function swingPlayerSword(){
  const swordEl = document.getElementById('worldPlayerSword');
  if(!swordEl) return;
  swordEl.classList.remove('swing');
  void swordEl.offsetWidth; // reinicia a animação mesmo em abates seguidos
  swordEl.classList.add('swing');
}

// mostra/esconde a espada na mão do player, conforme a ferramenta equipada
function updateWorldSwordVisual(){
  const w = state.world;
  const has = !!(w && w.equippedTool === 'sword');
  const swordEl = document.getElementById('worldPlayerSword');
  if(swordEl) swordEl.classList.toggle('show', has);
}

// mostra/esconde a armadura no corpo do player. Aparece se o player já craftou E está vestindo
function updateWorldArmorVisual(){
  const w = state.world;
  const has = !!(w && w.hasArmor && w.wearingArmor);
  const armorEl = document.getElementById('worldPlayerArmor');
  if(armorEl) armorEl.classList.toggle('show', has);
}

// mostra/esconde a vela na mão esquerda do player. Aparece se o player já craftou E está com ela acesa
function updateWorldCandleVisual(){
  const w = state.world;
  const has = !!(w && w.hasCandle && w.equippedCandle);
  const candleEl = document.getElementById('worldPlayerCandle');
  if(candleEl) candleEl.classList.toggle('show', has);
  // halo de luz alaranjada: aparece quando a vela está acesa. A opacidade/intensidade
  // é controlada pela classe 'night' (toggle separada em updateWorldGlowDayNight()).
  const glowEl = document.getElementById('worldPlayerGlow');
  if(glowEl){
    glowEl.classList.toggle('show', has);
    if(has) updateWorldGlowDayNight();  // garante que dia/noite bate com o estado atual
  }
}

// atualiza o estado dia/noite do halo de luz da vela. Chamado toda vez que o ciclo
// dia/noite muda (no worldLoop, junto com a atualização do night-overlay).
function updateWorldGlowDayNight(){
  const glowEl = document.getElementById('worldPlayerGlow');
  if(!glowEl) return;
  const cyc = worldCycleInfo();
  glowEl.classList.toggle('night', !cyc.isDay);
}

// reposiciona o halo de luz da vela em coordenadas de TELA a cada frame.
// A div do glow vive FORA do worldLayer (depois do night-overlay), então não recebe
// o transform da câmera — precisa calcular a posição na tela manualmente:
// tela = mundo - câmera. O anchor do player usa transform translate(-50%, -60%) na
// .world-player, então replicamos o mesmo offset pra centralizar o glow no bichinho.
function positionWorldGlow(){
  const glowEl = document.getElementById('worldPlayerGlow');
  if(!glowEl) return;
  const w = state.world;
  const viewport = document.getElementById('worldViewport');
  const vw = viewport ? viewport.clientWidth : 360;
  const vh = viewport ? viewport.clientHeight : 640;
  const camera = worldCamera(vw, vh);
  // centro do player na tela: posição do player (já com anchor -50%, -60%) menos câmera,
  // depois somamos metade da altura/largura do bichinho (64/2 = 32) pra pegar o CENTRO
  const screenX = w.x - camera.x + 32;
  const screenY = w.y - camera.y + 32 - (64 * 0.1);  // -60% da altura pra alinhar com o anchor do .world-player
  glowEl.style.left = screenX + 'px';
  glowEl.style.top  = screenY + 'px';
}

function tapRock(id){
  const w = state.world;
  const r = w.rocks.find(r => r.id === id);
  if(!r || !r.alive) return;
  if(Math.hypot(w.x - r.x, w.y - r.y) > WORLD_ROCK_RADIUS){ toast('Chegue mais perto da rocha!'); return; }
  r.hits = (r.hits || 0) + 1;
  const hitsNeeded = w.equippedTool === 'pickaxe' ? WORLD_ROCK_HITS_NEEDED_PICKAXE : WORLD_ROCK_HITS_NEEDED;
  if(w.equippedTool === 'pickaxe') swingPlayerPickaxe();
  if(r.hits >= hitsNeeded){
    r.alive = false;
    r.hits = 0;
    r.respawnAt = Date.now() + WORLD_ROCK_RESPAWN_MS;
    w.stone += 1;
    toast('🪨 Pedra coletada!');
  } else {
    toast('🪨 Golpe ' + r.hits + '/' + hitsNeeded);
  }
  saveState();
  renderWorldStatic();
}

let worldPendingEnemyId = null;
// bichinhos selvagens não entram mais em duelo sozinhos por proximidade — o player
// precisa chegar bem perto E clicar em cima do bichinho pra desafiá-lo
function tapWorldEnemy(id){
  const w = state.world;
  const e = w.enemies.find(e => e.id === id);
  if(!e || !e.alive) return;
  if(Math.hypot(w.x - e.x, w.y - e.y) > WORLD_ENEMY_RADIUS){ toast('Chegue bem perto do bichinho selvagem!'); return; }
  if(w.equippedTool === 'sword'){ slayWorldEnemyWithSword(id); return; }
  engageWorldEnemy(id);
}

// com a espada em mãos, matar um bichinho selvagem não entra em duelo: dá 100 moedas
// na hora e o bichinho "renasce" em outro ponto aleatório do mapa (nunca acaba)
function slayWorldEnemyWithSword(id){
  const w = state.world;
  const e = w.enemies.find(e => e.id === id);
  if(!e || !e.alive) return;

  swingPlayerSword();
  state.coins = (state.coins || 0) + WORLD_ENEMY_KILL_COINS;

  // dropa 1 material baseado no elemento do bichinho abatido (antes de sortear o novo elemento!)
  const drop = WORLD_ENEMY_DROPS[e.element];
  let dropLabel = null;
  if(drop){
    w[drop.invKey] = (w[drop.invKey] || 0) + 1;
    dropLabel = drop.label;
  }
  const dropSuffix = dropLabel ? ' +1 ' + dropLabel : '';
  toast('🗡️ Bichinho selvagem abatido! +' + WORLD_ENEMY_KILL_COINS + ' moedas' + dropSuffix);

  const spot = worldRandomSpotAwayFromHouses(140);
  const target = worldRandomSpotAwayFromHouses(140);
  e.x = spot.x; e.y = spot.y;
  e.tx = target.x; e.ty = target.y;
  e.element = randomElement(); // "novo" bichinho selvagem, então sorteia elemento de novo
  e.facing = 'front'; e.flip = false;

  updateEnemyVisualState(e, false); // move o bichinho na tela pro novo ponto imediatamente
  saveState();
}
// ---- Ataque noturno: bichinhos selvagens atiram bolinhas da cor do elemento no player ----
function spawnEnemyBall(e, w){
  const dx = w.x - e.x, dy = w.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const el = ELEMENTS[e.element];
  worldBalls.push({
    id: 'ball' + (worldBallSeq++),
    x: e.x, y: e.y,
    vx: dx / dist * WORLD_NIGHT_BALL_SPEED,
    vy: dy / dist * WORLD_NIGHT_BALL_SPEED,
    color: el.c2, border: el.dark,
  });
}

function updateWorldBalls(dt){
  const w = state.world;
  for(let i = worldBalls.length - 1; i >= 0; i--){
    const b = worldBalls[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if(Math.hypot(w.x - b.x, w.y - b.y) < WORLD_PLAYER_HIT_RADIUS){
      worldBalls.splice(i, 1);
      registerWorldPlayerHit();
      continue;
    }
    if(b.x < -40 || b.x > WORLD_WIDTH + 40 || b.y < -40 || b.y > WORLD_HEIGHT + 40){
      worldBalls.splice(i, 1);
    }
  }
  const container = document.getElementById('worldBallsLayer');
  if(!container) return;
  container.innerHTML = '';
  worldBalls.forEach(b => {
    const el = document.createElement('div');
    el.className = 'world-ball';
    el.style.left = b.x + 'px';
    el.style.top = b.y + 'px';
    el.style.background = b.color;
    el.style.borderColor = b.border;
    el.style.zIndex = 500;
    container.appendChild(el);
  });
}

function flashWorldHitFeedback(){
  const flash = document.getElementById('worldHitFlash');
  if(!flash) return;
  flash.style.opacity = 0.35;
  clearTimeout(flash._hideTimeout);
  flash._hideTimeout = setTimeout(() => { flash.style.opacity = 0; }, 150);
}

function registerWorldPlayerHit(){
  worldPlayerHits++;
  flashWorldHitFeedback();
  const countEl = document.getElementById('worldHitsCount');
  if(countEl) countEl.textContent = worldPlayerHits;
  if(worldPlayerHits >= WORLD_PLAYER_MAX_HITS){
    worldPlayerDeath();
  }
}

// morte à noite: não ganha moedas nem XP — volta pros valores de quando entrou no mundo
function worldPlayerDeath(){
  cancelAnimationFrame(worldRAF);
  worldRAF = null;
  worldBalls = [];
  worldPlayerHits = 0;
  if(worldEntrySnapshot){
    state.coins = worldEntrySnapshot.coins;
    state.xp = worldEntrySnapshot.xp;
  }
  saveState();
  document.getElementById('screen-world').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  renderHome();
  toast('💀 Seu bichinho foi derrotado pelos selvagens da noite! Nenhuma moeda ou XP ganha.');
}

// atualiza posição/z-index/sprite (frente-costas + espelho + bounce de caminhada) de um inimigo em tela
function updateEnemyVisualState(e, moving){
  const el = worldEnemyEls[e.id];
  if(!el) return;
  el.style.left = e.x + 'px'; el.style.top = e.y + 'px'; el.style.zIndex = Math.round(e.y);
  const spriteEl = el.querySelector('.world-enemy-sprite');
  const innerEl = el.querySelector('.world-enemy-sprite-inner');
  if(spriteEl){
    const invert = !!WORLD_SPRITE_FLIP_INVERT[e.element];
    spriteEl.classList.toggle('flip', invert ? !e.flip : !!e.flip);
  }
  if(innerEl){
    innerEl.style.backgroundImage = "url('" + (e.facing === 'back' ? DUEL_SPRITES_BACK : DUEL_SPRITES_FRONT)[e.element] + "')";
    innerEl.classList.toggle('walking', moving);
  }
}

function engageWorldEnemy(id){
  const w = state.world;
  const e = w.enemies.find(e => e.id === id);
  if(!e || !e.alive) return;
  worldPendingEnemyId = e.id;
  cancelAnimationFrame(worldRAF);
  worldRAF = null;
  saveState();
  document.getElementById('screen-world').classList.remove('active');
  document.getElementById('screen-duelo').classList.add('active');
  document.getElementById('duelSetup').style.display = 'none';
  document.getElementById('duelOnlineChoice').style.display = 'none';
  document.getElementById('duelOnlineHostScreen').style.display = 'none';
  document.getElementById('duelOnlineJoinScreen').style.display = 'none';
  startAiDuel({ source:'world' });
}

let worldBuildMode = null;
// define o modo de construção atual ('wood' | 'stone' | null). Chamada pelo
// inventário quando o player toca em madeira/pedra pra usar, ou com null pra soltar.
function toggleBuildMode(type){
  worldBuildMode = type;
  updateWorldHandPill();
}

// atualiza o indicador único do HUD que mostra o que está na mão do player
// (ferramenta equipada ou material selecionado pra construção)
function updateWorldHandPill(){
  const w = state.world;
  const iconEl = document.getElementById('worldHandIcon');
  if(!iconEl || !w) return;
  const toolItem = WORLD_INVENTORY_ITEMS.find(i => i.type === 'tool' && i.key === w.equippedTool);
  const resourceItem = WORLD_INVENTORY_ITEMS.find(i => i.type === 'resource' && i.key === worldBuildMode);
  const active = toolItem || resourceItem;
  iconEl.textContent = active ? active.icon : 'vazio';
}

function isCellInsideAnyHouse(w, gx, gy){
  return w.houses.some(h => {
    const hgx = Math.round(h.originX / WORLD_GRID), hgy = Math.round(h.originY / WORLD_GRID);
    return gx >= hgx && gx < hgx + WORLD_HOUSE_COLS && gy >= hgy && gy < hgy + WORLD_HOUSE_ROWS;
  });
}

function setupWorldGroundTap(){
  const viewport = document.getElementById('worldViewport');
  if(viewport._wired) return;
  viewport._wired = true;
  viewport.addEventListener('click', (e) => {
    if(!worldBuildMode) return;
    const w = state.world;
    // generaliza o custo de qualquer material 'resource' (madeira/pedra/minério/algodão/fósforo/cera)
    if(w[worldBuildMode] === undefined || w[worldBuildMode] <= 0){
      const lbl = WORLD_INVENTORY_ITEMS.find(i => i.key === worldBuildMode);
      toast('Sem ' + (lbl ? lbl.label.toLowerCase() : worldBuildMode) + ' suficiente');
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const vw = rect.width, vh = rect.height;
    const camera = worldCamera(vw, vh);
    const rawX = camera.x + (e.clientX - rect.left);
    const rawY = camera.y + (e.clientY - rect.top);
    // alinha o toque na grade de construção (mesma medida de um bloco), pra dar pra formar padrões como a casa
    const gx = Math.round(rawX / WORLD_GRID);
    const gy = Math.round(rawY / WORLD_GRID);
    const worldX = gx * WORLD_GRID;
    const worldY = gy * WORLD_GRID;
    if(worldX < 15 || worldX > WORLD_WIDTH - 15 || worldY < 15 || worldY > WORLD_HEIGHT - 15) return;
    if(w.blocks.some(b => b.gx === gx && b.gy === gy) || isCellInsideAnyHouse(w, gx, gy)){
      toast('Já tem uma construção aqui!');
      return;
    }
    w[worldBuildMode] -= 1;
    w.blocks.push({ id:'b'+Date.now(), x: worldX, y: worldY, gx, gy, type: worldBuildMode });
    const housesBefore = w.houses.length;
    if(worldBuildMode === 'wood') tryBuildHouse(w, gx, gy);
    if(worldBuildMode === 'stone') tryBuildStoneHouse(w, gx, gy);
    // 1ª casa construída do save: marca o flag pra acender o brilho do cajado do ancião.
    // (o flag persiste, então o brilho continua valendo mesmo se a casa desmoronar depois)
    if(w.houses.length > housesBefore && !w.hasBuiltHouse){ w.hasBuiltHouse = true; }
    if(!w.hasAxe) tryBuildAxe(w, gx, gy);
    if(!w.hasPickaxe) tryBuildPickaxe(w, gx, gy);
    if(!w.hasSword) tryBuildSword(w, gx, gy);
    if(!w.hasArmor) tryBuildArmor(w, gx, gy);
    if(!w.hasCandle) tryBuildCandle(w, gx, gy);
    saveState();
    renderWorldStatic();
    updateWorldAxeVisual();
    updateWorldPickaxeVisual();
    updateWorldSwordVisual();
    updateWorldArmorVisual();
    updateWorldCandleVisual();
  });
}

// pega de volta um bloco de madeira/pedra solto no mapa (que ainda não virou uma
// casa/ferramenta) ao ser tocado — devolve o recurso pro inventário. Blocos soltos
// que não forem recolhidos até a próxima noite somem sozinhos (ver worldLoop).
function removeLooseBlock(id){
  const w = state.world;
  const block = w.blocks.find(b => b.id === id);
  if(!block) return;
  w.blocks = w.blocks.filter(b => b.id !== id);
  if(block.type === 'wood') w.wood += 1; else w.stone += 1;
  toast((block.type === 'wood' ? '🪵 Madeira' : '🪨 Pedra') + ' recolhida de volta pro inventário!');
  saveState();
  renderWorldStatic();
}

function tryBuildHouse(w, placedGx, placedGy){
  // tenta encaixar o padrão da casa nível 1 (8 madeiras em formato de portal) usando
  // o bloco recém colocado como qualquer uma das 8 posições do padrão
  for(const [ox, oy] of WORLD_HOUSE_PATTERN){
    const originGx = placedGx - ox, originGy = placedGy - oy;
    const allWood = WORLD_HOUSE_PATTERN.every(([dx, dy]) => {
      const b = w.blocks.find(b => b.gx === originGx + dx && b.gy === originGy + dy);
      return b && b.type === 'wood';
    });
    if(!allWood) continue;
    const gateFree = WORLD_HOUSE_GATE_CELLS.every(([dx, dy]) => {
      return !w.blocks.some(b => b.gx === originGx + dx && b.gy === originGy + dy);
    });
    if(!gateFree) continue;

    // padrão completo! remove os 8 blocos de madeira usados e cria a casa nível 1
    WORLD_HOUSE_PATTERN.forEach(([dx, dy]) => {
      const gx = originGx + dx, gy = originGy + dy;
      w.blocks = w.blocks.filter(b => !(b.gx === gx && b.gy === gy));
    });
    w.houses.push({
      id: 'h' + Date.now(),
      type: 'wood',
      level: 1,
      // os blocos são centralizados no ponto (gx*GRID, gy*GRID) via transform -50%,-50%,
      // então a borda visual da casa começa meio bloco antes da célula de origem
      originX: originGx * WORLD_GRID - WORLD_GRID / 2,
      originY: originGy * WORLD_GRID - WORLD_GRID / 2,
      builtAt: Date.now(),
      expiresAt: Date.now() + WORLD_HOUSE_LIFETIME_DAYS.wood[1] * WORLD_DAY_MS,
    });
    toast('🏠 Casa de madeira construída! Os bichinhos selvagens vão evitar essa área.');
    return;
  }
}

// tenta encaixar o mesmo padrão da casa (formato de portal), mas usando pedra em vez
// de madeira — usa o bloco recém colocado como qualquer uma das 8 posições do padrão
function tryBuildStoneHouse(w, placedGx, placedGy){
  for(const [ox, oy] of WORLD_HOUSE_PATTERN){
    const originGx = placedGx - ox, originGy = placedGy - oy;
    const allStone = WORLD_HOUSE_PATTERN.every(([dx, dy]) => {
      const b = w.blocks.find(b => b.gx === originGx + dx && b.gy === originGy + dy);
      return b && b.type === 'stone';
    });
    if(!allStone) continue;
    const gateFree = WORLD_HOUSE_GATE_CELLS.every(([dx, dy]) => {
      return !w.blocks.some(b => b.gx === originGx + dx && b.gy === originGy + dy);
    });
    if(!gateFree) continue;

    // padrão completo! remove os 8 blocos de pedra usados e cria a casa de pedra
    WORLD_HOUSE_PATTERN.forEach(([dx, dy]) => {
      const gx = originGx + dx, gy = originGy + dy;
      w.blocks = w.blocks.filter(b => !(b.gx === gx && b.gy === gy));
    });
    w.houses.push({
      id: 'h' + Date.now(),
      type: 'stone',
      level: 1,
      originX: originGx * WORLD_GRID - WORLD_GRID / 2,
      originY: originGy * WORLD_GRID - WORLD_GRID / 2,
      builtAt: Date.now(),
      expiresAt: Date.now() + WORLD_HOUSE_LIFETIME_DAYS.stone[1] * WORLD_DAY_MS,
    });
    toast('🪨🏠 Casa de pedra construída! Bem mais resistente que a de madeira.');
    return;
  }
}

// tenta encaixar o padrão do machado (2 pedras em cima + 2 madeiras empilhadas embaixo
// à esquerda) usando o bloco recém colocado como qualquer uma das 4 posições do padrão
function tryBuildAxe(w, placedGx, placedGy){
  if(w.hasAxe) return; // já tem machado, não precisa checar de novo
  const placedBlock = w.blocks.find(b => b.gx === placedGx && b.gy === placedGy);
  if(!placedBlock) return;

  for(const cell of WORLD_AXE_PATTERN){
    if(placedBlock.type !== cell.type) continue; // o bloco recém colocado precisa bater com o tipo exigido nessa posição do padrão
    const originGx = placedGx - cell.dx, originGy = placedGy - cell.dy;
    const allMatch = WORLD_AXE_PATTERN.every(c => {
      const b = w.blocks.find(b => b.gx === originGx + c.dx && b.gy === originGy + c.dy);
      return b && b.type === c.type;
    });
    if(!allMatch) continue;

    // padrão completo! remove os 4 blocos usados e crafta o machado
    WORLD_AXE_PATTERN.forEach(c => {
      const gx = originGx + c.dx, gy = originGy + c.dy;
      w.blocks = w.blocks.filter(b => !(b.gx === gx && b.gy === gy));
    });
    w.hasAxe = true;
    toast('🪓 Machado criado! Abra o inventário 🎒 pra equipar.');
    return;
  }
}

// tenta encaixar o padrão da picareta (3 pedras lado a lado em cima + 2 madeiras
// empilhadas embaixo à esquerda) usando o bloco recém colocado como qualquer uma
// das 5 posições do padrão
function tryBuildPickaxe(w, placedGx, placedGy){
  if(w.hasPickaxe) return; // já tem picareta, não precisa checar de novo
  const placedBlock = w.blocks.find(b => b.gx === placedGx && b.gy === placedGy);
  if(!placedBlock) return;

  for(const cell of WORLD_PICKAXE_PATTERN){
    if(placedBlock.type !== cell.type) continue; // o bloco recém colocado precisa bater com o tipo exigido nessa posição do padrão
    const originGx = placedGx - cell.dx, originGy = placedGy - cell.dy;
    const allMatch = WORLD_PICKAXE_PATTERN.every(c => {
      const b = w.blocks.find(b => b.gx === originGx + c.dx && b.gy === originGy + c.dy);
      return b && b.type === c.type;
    });
    if(!allMatch) continue;

    // padrão completo! remove os 5 blocos usados e crafta a picareta
    WORLD_PICKAXE_PATTERN.forEach(c => {
      const gx = originGx + c.dx, gy = originGy + c.dy;
      w.blocks = w.blocks.filter(b => !(b.gx === gx && b.gy === gy));
    });
    w.hasPickaxe = true;
    toast('⛏️ Picareta criada! Abra o inventário 🎒 pra equipar.');
    return;
  }
}

// tenta encaixar o padrão da espada (2 pedras lado a lado em cima + 1 madeira
// embaixo à esquerda) usando o bloco recém colocado como qualquer uma das 3
// posições do padrão
function tryBuildSword(w, placedGx, placedGy){
  if(w.hasSword) return; // já tem espada, não precisa checar de novo
  const placedBlock = w.blocks.find(b => b.gx === placedGx && b.gy === placedGy);
  if(!placedBlock) return;

  for(const cell of WORLD_SWORD_PATTERN){
    if(placedBlock.type !== cell.type) continue; // o bloco recém colocado precisa bater com o tipo exigido nessa posição do padrão
    const originGx = placedGx - cell.dx, originGy = placedGy - cell.dy;
    const allMatch = WORLD_SWORD_PATTERN.every(c => {
      const b = w.blocks.find(b => b.gx === originGx + c.dx && b.gy === originGy + c.dy);
      return b && b.type === c.type;
    });
    if(!allMatch) continue;

    // padrão completo! remove os 3 blocos usados e crafta a espada
    WORLD_SWORD_PATTERN.forEach(c => {
      const gx = originGx + c.dx, gy = originGy + c.dy;
      w.blocks = w.blocks.filter(b => !(b.gx === gx && b.gy === gy));
    });
    w.hasSword = true;
    toast('🗡️ Espada criada! Abra o inventário 🎒 pra equipar.');
    return;
  }
}

// tenta encaixar o padrão da armadura (6 minérios em cima+meio + 2 algodões embaixo) usando
// o bloco recém colocado como qualquer uma das 8 posições do padrão
function tryBuildArmor(w, placedGx, placedGy){
  if(w.hasArmor) return; // já tem armadura, não precisa checar de novo
  const placedBlock = w.blocks.find(b => b.gx === placedGx && b.gy === placedGy);
  if(!placedBlock) return;

  for(const cell of WORLD_ARMOR_PATTERN){
    if(placedBlock.type !== cell.type) continue;
    const originGx = placedGx - cell.dx, originGy = placedGy - cell.dy;
    const allMatch = WORLD_ARMOR_PATTERN.every(c => {
      const b = w.blocks.find(b => b.gx === originGx + c.dx && b.gy === originGy + c.dy);
      return b && b.type === c.type;
    });
    if(!allMatch) continue;

    // padrão completo! remove os 8 blocos usados e crafta a armadura
    WORLD_ARMOR_PATTERN.forEach(c => {
      const gx = originGx + c.dx, gy = originGy + c.dy;
      w.blocks = w.blocks.filter(b => !(b.gx === gx && b.gy === gy));
    });
    w.hasArmor = true;
    w.wearingArmor = true; // ao craftar, veste direto (faz sentido pra um item de defesa)
    toast('🛡️ Armadura criada e vestida! Você está protegido.');
    return;
  }
}

// tenta encaixar o padrão da vela (1 fósforo em cima + 2 ceras embaixo, coluna de 3)
// usando o bloco recém colocado como qualquer uma das 3 posições do padrão
function tryBuildCandle(w, placedGx, placedGy){
  if(w.hasCandle) return; // já tem vela, não precisa checar de novo
  const placedBlock = w.blocks.find(b => b.gx === placedGx && b.gy === placedGy);
  if(!placedBlock) return;

  for(const cell of WORLD_CANDLE_PATTERN){
    if(placedBlock.type !== cell.type) continue;
    const originGx = placedGx - cell.dx, originGy = placedGy - cell.dy;
    const allMatch = WORLD_CANDLE_PATTERN.every(c => {
      const b = w.blocks.find(b => b.gx === originGx + c.dx && b.gy === originGy + c.dy);
      return b && b.type === c.type;
    });
    if(!allMatch) continue;

    // padrão completo! remove os 3 blocos usados e crafta a vela
    WORLD_CANDLE_PATTERN.forEach(c => {
      const gx = originGx + c.dx, gy = originGy + c.dy;
      w.blocks = w.blocks.filter(b => !(b.gx === gx && b.gy === gy));
    });
    w.hasCandle = true;
    w.equippedCandle = true; // acende direto
    toast('🔥 Vela criada e acesa! Agora você tem luz.');
    return;
  }
}

// verifica se o ponto (x,y) colide com algum obstáculo sólido do mundo:
// rochas, o TRONCO da árvore (não a copa), blocos soltos de madeira/pedra, e as paredes das casas
function worldCollidesAt(w, x, y){
  for(const t of w.trees){
    if(!t.alive) continue;
    if(Math.hypot(x - t.x, y - t.y) < WORLD_PLAYER_COLLISION_RADIUS + WORLD_TREE_TRUNK_COLLISION_RADIUS) return true;
  }
  for(const r of w.rocks){
    if(!r.alive) continue;
    if(Math.hypot(x - r.x, y - r.y) < WORLD_PLAYER_COLLISION_RADIUS + WORLD_ROCK_COLLISION_RADIUS) return true;
  }
  for(const b of w.blocks){
    if(Math.hypot(x - b.x, y - b.y) < WORLD_PLAYER_COLLISION_RADIUS + WORLD_BLOCK_COLLISION_RADIUS) return true;
  }
  for(const h of w.houses){
    for(const [dx, dy] of WORLD_HOUSE_PATTERN){
      const cx = h.originX + WORLD_GRID / 2 + dx * WORLD_GRID;
      const cy = h.originY + WORLD_GRID / 2 + dy * WORLD_GRID;
      if(Math.hypot(x - cx, y - cy) < WORLD_PLAYER_COLLISION_RADIUS + WORLD_BLOCK_COLLISION_RADIUS) return true;
    }
  }
  return false;
}

let worldJoyVec = { x: 0, y: 0 };
let worldFacing = 'front';
let worldFlipped = false;
// alguns sprites de elemento já nascem "virados" ao contrário dos demais;
// essa lista inverte a lógica de espelhamento só pra esses casos.
const WORLD_SPRITE_FLIP_INVERT = { agua: true };
function setupWorldJoystick(){
  const zone = document.getElementById('worldJoystick');
  const thumb = document.getElementById('worldJoystickThumb');
  if(zone._wired) return;
  zone._wired = true;
  const radius = 30;
  let dragging = false;
  let originRect = null;

  function setThumb(dx, dy){ thumb.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
  function reset(){ dragging = false; worldJoyVec.x = 0; worldJoyVec.y = 0; setThumb(0,0); }
  function handleMove(clientX, clientY){
    if(!originRect) originRect = zone.getBoundingClientRect();
    const cx = originRect.left + originRect.width/2;
    const cy = originRect.top + originRect.height/2;
    let dx = clientX - cx, dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if(dist > radius){ dx = dx/dist*radius; dy = dy/dist*radius; }
    setThumb(dx, dy);
    worldJoyVec.x = dx / radius;
    worldJoyVec.y = dy / radius;
  }
  zone.addEventListener('pointerdown', (e) => {
    dragging = true;
    originRect = zone.getBoundingClientRect();
    zone.setPointerCapture(e.pointerId);
    handleMove(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', (e) => { if(dragging) handleMove(e.clientX, e.clientY); });
  zone.addEventListener('pointerup', reset);
  zone.addEventListener('pointercancel', reset);
}

let _worldBgReady = false;
function setupWorldBackgrounds(){
  if(_worldBgReady) return;
  document.getElementById('worldBgFar').style.backgroundImage = "url(\"" + WORLD_MOUNTAIN_FAR + "\")";
  document.getElementById('worldBgNear').style.backgroundImage = "url(\"" + WORLD_MOUNTAIN_NEAR + "\")";
  _worldBgReady = true;
}

function worldCamera(vw, vh){
  const w = state.world;
  return {
    x: Math.max(0, Math.min(WORLD_WIDTH - vw, w.x - vw/2)),
    y: Math.max(0, Math.min(WORLD_HEIGHT - vh, w.y - vh/2)),
  };
}

let worldRAF = null;
let worldLastFrameTs = 0;
let worldEntrySnapshot = null;
let worldBalls = [];
let worldBallSeq = 0;
let worldPlayerHits = 0;
function openWorld(){
  ensureWorldState();
  worldEntrySnapshot = { coins: state.coins, xp: state.xp };
  worldBalls = [];
  worldPlayerHits = 0;
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-world').classList.add('active');
  setupWorldBackgrounds();
  setupWorldJoystick();
  setupWorldGroundTap();
  renderWorldStatic();
  worldLastFrameTs = performance.now();
  cancelAnimationFrame(worldRAF);
  worldRAF = requestAnimationFrame(worldLoop);
}

function closeWorld(){
  cancelAnimationFrame(worldRAF);
  worldRAF = null;
  saveState();
  toggleWorldInventory(false);
  toggleWorldElderDialog(false);
  document.getElementById('screen-world').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  renderHome();
}

function worldLoop(ts){
  const dt = Math.min(0.05, (ts - worldLastFrameTs) / 1000);
  worldLastFrameTs = ts;
  const w = state.world;
  if(!w){ worldRAF = null; return; }

  const mag = Math.hypot(worldJoyVec.x, worldJoyVec.y);
  const moving = mag > 0.05;
  if(moving){
    const nx = worldJoyVec.x / Math.max(1, mag);
    const ny = worldJoyVec.y / Math.max(1, mag);
    const targetX = Math.max(WORLD_PLAYER_MARGIN, Math.min(WORLD_WIDTH - WORLD_PLAYER_MARGIN, w.x + nx * mag * WORLD_MOVE_SPEED * dt));
    const targetY = Math.max(WORLD_PLAYER_MARGIN, Math.min(WORLD_HEIGHT - WORLD_PLAYER_MARGIN, w.y + ny * mag * WORLD_MOVE_SPEED * dt));
    // testa colisão nos dois eixos junto; se bloqueado, tenta cada eixo separado
    // (isso permite "deslizar" ao lado do obstáculo em vez de travar de vez, dando a sensação de desviar)
    if(!worldCollidesAt(w, targetX, targetY)){
      w.x = targetX; w.y = targetY;
    } else if(!worldCollidesAt(w, targetX, w.y)){
      w.x = targetX;
    } else if(!worldCollidesAt(w, w.x, targetY)){
      w.y = targetY;
    }

    // direção: costas quando anda pra cima (longe da câmera), frente quando desce ou anda de lado
    const newFacing = ny < -0.3 ? 'back' : 'front';
    if(newFacing !== worldFacing){
      worldFacing = newFacing;
      const img = document.getElementById('worldPlayerImgInner');
      if(img) img.style.backgroundImage = "url('" + (worldFacing === 'back' ? DUEL_SPRITES_BACK : DUEL_SPRITES_FRONT)[state.element] + "')";
    }
    if(nx > 0.15) worldFlipped = false;
    else if(nx < -0.15) worldFlipped = true;
    const invert = !!WORLD_SPRITE_FLIP_INVERT[state.element];
    const spriteEl = document.getElementById('worldPlayerImg');
    if(spriteEl) spriteEl.classList.toggle('flip', invert ? !worldFlipped : worldFlipped);
    const innerEl = document.getElementById('worldPlayerImgInner');
    if(innerEl) innerEl.classList.add('walking');
  } else {
    const innerEl = document.getElementById('worldPlayerImgInner');
    if(innerEl) innerEl.classList.remove('walking');
  }

  // ancião: na primeiríssima visita, o diálogo de boas-vindas abre sozinho
  // quando o player chega bem perto (depois disso só abre se ele clicar).
  // usa renderElderDialog() pra escolher entre boas-vindas e a 2ª fala (caso o save
  // já tenha casa construída e ainda não viu o aviso).
  if(!w.hasMetElder && Math.hypot(w.x - WORLD_ELDER_POS.x, w.y - WORLD_ELDER_POS.y) <= WORLD_ELDER_AUTO_RADIUS){
    w.hasMetElder = true;
    saveState();
    renderElderDialog();
    toggleWorldElderDialog(true);
  }

  const now = Date.now();
  let treesChanged = false;
  w.trees.forEach(t => {
    if(!t.alive && t.respawnAt && now >= t.respawnAt){
      const spot = worldRandomSpot(100);
      t.x = spot.x; t.y = spot.y;
      t.alive = true; t.respawnAt = 0; t.hits = 0; treesChanged = true;
    }
  });
  w.rocks.forEach(r => {
    if(!r.alive && r.respawnAt && now >= r.respawnAt){
      const spot = worldRandomSpot(120);
      r.x = spot.x; r.y = spot.y;
      r.alive = true; r.respawnAt = 0; r.hits = 0; treesChanged = true;
    }
  });

  // casas desmoronam quando o tempo de vida do material acaba (madeira: 5 dias, pedra: 30 dias)
  if(w.houses.length){
    const before = w.houses.length;
    const collapsed = w.houses.filter(h => now >= h.expiresAt);
    w.houses = w.houses.filter(h => now < h.expiresAt);
    if(w.houses.length !== before){
      const hadStone = collapsed.some(h => h.type === 'stone');
      const hadWood = collapsed.some(h => h.type !== 'stone');
      if(hadWood) toast('🏚️ Uma casa de madeira desmoronou depois de 5 dias.');
      if(hadStone) toast('🪨🏚️ Uma casa de pedra desmoronou depois de 30 dias.');
      treesChanged = true;
    }
  }

  const cyc = worldCycleInfo();
  const overlay = document.getElementById('worldNightOverlay');
  // sincroniza a classe dia/noite do halo de luz da vela com o estado atual do ciclo
  updateWorldGlowDayNight();
  if(cyc.isDay){
    overlay.style.opacity = 0;
    worldPlayerHits = 0; // de dia fica seguro de novo
    const hitsPill = document.getElementById('worldHitsPill');
    if(hitsPill) hitsPill.style.display = 'none';
    // bichinhos selvagens agora aparecem DE DIA (antes era de noite)
    if(w.nightIndex !== cyc.nightIndex){
      // recompensa por cada "dia do mundo" completo (dia+noite) que passou —
      // se for a primeira vez (nightIndex ainda -1), não conta como dia completo
      const daysPassed = w.nightIndex >= 0 ? (cyc.nightIndex - w.nightIndex) : 0;
      w.nightIndex = cyc.nightIndex;
      w.enemies = genWorldEnemies();
      w.nightBoosted = false; // permite reforçar de novo na próxima noite
      treesChanged = true;
      if(daysPassed > 0){
        const coinsGained = daysPassed * WORLD_DAILY_COINS;
        const xpGained = daysPassed * WORLD_DAILY_XP;
        state.coins += coinsGained;
        state.xp += xpGained;
        toast('☀️ Novo dia! +' + coinsGained + ' moedas e +' + xpGained + ' XP');
        saveState();
      }
    }
  } else {
    overlay.style.opacity = 0.55;
    // à noite os bichinhos selvagens não somem mais — ficam violentos, e chegam 50% a mais deles
    if(!w.nightBoosted){
      w.nightBoosted = true;
      const extra = Math.round(WORLD_ENEMY_COUNT * WORLD_NIGHT_ENEMY_BONUS_RATIO);
      w.enemies = w.enemies.concat(genWorldEnemies(extra, 'en'));
      // blocos soltos de madeira/pedra que não foram recolhidos até a noite somem —
      // casas e outras construções já viradas não são afetadas (não ficam em w.blocks)
      if(w.blocks.length > 0){
        w.blocks = [];
        toast('🌙 A noite chegou e os itens soltos no chão sumiram!');
      }
      treesChanged = true;
    }
  }
  if(treesChanged){ renderWorldStatic(); saveState(); }

  if(cyc.isDay){
    // DE DIA: inimigos vagam pelo mapa devagar; se o player chegar perto, fogem na direção
    // contrária. Pra desafiar, o player precisa chegar bem perto e CLICAR no bichinho —
    // não entra em duelo sozinho por proximidade.
    for(const e of w.enemies){
      if(!e.alive) continue;
      const distToPlayer = Math.hypot(w.x - e.x, w.y - e.y);
      let speed = WORLD_ENEMY_SPEED;
      if(distToPlayer < WORLD_ENEMY_FLEE_RADIUS){
        // assustado: mira num ponto na direção oposta ao player, dentro dos limites do mapa
        const awayX = e.x + (e.x - w.x);
        const awayY = e.y + (e.y - w.y);
        e.tx = Math.max(WORLD_PLAYER_MARGIN, Math.min(WORLD_WIDTH - WORLD_PLAYER_MARGIN, awayX));
        e.ty = Math.max(WORLD_PLAYER_MARGIN, Math.min(WORLD_HEIGHT - WORLD_PLAYER_MARGIN, awayY));
        speed = WORLD_ENEMY_FLEE_SPEED;
      } else if(isNearAnyHouse(w, e.x, e.y)){
        // bichinhos selvagens não chegam perto de casas: se estiverem entrando na área
        // de segurança, trocam de destino imediatamente pra um ponto longe delas
        const spot = worldRandomSpotAwayFromHouses(140);
        e.tx = spot.x; e.ty = spot.y;
      }
      const dToTarget = Math.hypot(e.tx - e.x, e.ty - e.y);
      let moving = false;
      if(dToTarget < 12 && distToPlayer >= WORLD_ENEMY_FLEE_RADIUS){
        const spot = worldRandomSpotAwayFromHouses(140);
        e.tx = spot.x; e.ty = spot.y;
      } else if(dToTarget > 1){
        const stepNx = (e.tx - e.x) / dToTarget;
        const stepNy = (e.ty - e.y) / dToTarget;
        e.x += stepNx * speed * dt;
        e.y += stepNy * speed * dt;
        moving = true;
        const newFacing = stepNy < -0.3 ? 'back' : 'front';
        e.facing = newFacing;
        if(stepNx > 0.15) e.flip = false;
        else if(stepNx < -0.15) e.flip = true;
      }
      updateEnemyVisualState(e, moving);
    }
  } else {
    // DE NOITE: inimigos vagam livremente e, se o player chegar perto, param e atacam
    // com bolinhas da cor do elemento, em vez de fugir — a menos que o player esteja
    // dentro da área segura de uma casa, aí eles não conseguem mirar nele
    const playerProtected = isNearAnyHouse(w, w.x, w.y);
    for(const e of w.enemies){
      if(!e.alive) continue;
      const distToPlayer = Math.hypot(w.x - e.x, w.y - e.y);
      const aggro = distToPlayer < WORLD_NIGHT_SIGHT_RADIUS && !playerProtected;
      let moving = false;
      if(aggro){
        // parado, encarando o player, atacando em intervalos
        const dx = w.x - e.x;
        if(dx > 8) e.flip = false;
        else if(dx < -8) e.flip = true;
        e.facing = (w.y < e.y - 20) ? 'back' : 'front';
        if(!e.nextAttackAt || now >= e.nextAttackAt){
          e.nextAttackAt = now + WORLD_NIGHT_ATTACK_COOLDOWN_MS * WORLD_NIGHT_ATTACK_SPEED_MULT;
          spawnEnemyBall(e, w);
        }
      } else {
        if(isNearAnyHouse(w, e.x, e.y)){
          const spot = worldRandomSpotAwayFromHouses(140);
          e.tx = spot.x; e.ty = spot.y;
        }
        const dToTarget = Math.hypot(e.tx - e.x, e.ty - e.y);
        if(dToTarget < 12){
          const spot = worldRandomSpotAwayFromHouses(140);
          e.tx = spot.x; e.ty = spot.y;
        } else {
          const stepNx = (e.tx - e.x) / dToTarget;
          const stepNy = (e.ty - e.y) / dToTarget;
          e.x += stepNx * WORLD_ENEMY_SPEED * WORLD_NIGHT_ENEMY_SPEED_MULT * dt;
          e.y += stepNy * WORLD_ENEMY_SPEED * WORLD_NIGHT_ENEMY_SPEED_MULT * dt;
          moving = true;
          const newFacing = stepNy < -0.3 ? 'back' : 'front';
          e.facing = newFacing;
          if(stepNx > 0.15) e.flip = false;
          else if(stepNx < -0.15) e.flip = true;
        }
      }
      updateEnemyVisualState(e, moving);
    }
    updateWorldBalls(dt);
    const hitsPill = document.getElementById('worldHitsPill');
    const hitsCount = document.getElementById('worldHitsCount');
    if(hitsPill) hitsPill.style.display = w.enemies.some(e=>e.alive) ? 'flex' : 'none';
    if(hitsCount) hitsCount.textContent = worldPlayerHits;
    if(worldRAF === null) return; // morreu durante updateWorldBalls: worldPlayerDeath já cancelou o loop
  }

  const mins = Math.floor(cyc.phaseRemainMs / 60000);
  const secs = Math.floor((cyc.phaseRemainMs % 60000) / 1000);
  const pillEl = document.getElementById('worldCyclePill');
  if(pillEl) pillEl.textContent = (cyc.isDay ? '☀️ Dia · ' : '🌙 Noite · ') + mins + ':' + String(secs).padStart(2,'0');

  const viewport = document.getElementById('worldViewport');
  const vw = viewport.clientWidth || 360;
  const vh = viewport.clientHeight || 640;
  const camera = worldCamera(vw, vh);
  document.getElementById('worldLayer').style.transform = 'translate(' + (-camera.x) + 'px,' + (-camera.y) + 'px)';
  document.getElementById('worldBgFar').style.backgroundPositionX = (-camera.x * 0.12) + 'px';
  document.getElementById('worldBgFar').style.backgroundPositionY = 'calc(100% - ' + (camera.y * 0.03) + 'px)';
  document.getElementById('worldBgNear').style.backgroundPositionX = (-camera.x * 0.28) + 'px';
  document.getElementById('worldBgNear').style.backgroundPositionY = 'calc(100% - ' + (camera.y * 0.06) + 'px)';
  // o player agora vive dentro do worldLayer (mesmo container das árvores),
  // então usa coordenadas do mundo direto — o transform do layer cuida da câmera.
  // O z-index = posição Y faz o player passar por trás de árvores "mais baixas"
  // na tela e na frente das que estão mais acima, como num jogo top-down.
  const playerEl = document.getElementById('worldPlayer');
  playerEl.style.left = w.x + 'px';
  playerEl.style.top = w.y + 'px';
  playerEl.style.zIndex = Math.round(w.y);
  // halo da vela fica fora do worldLayer, então reposiciona em coordenadas de tela
  positionWorldGlow();

  document.getElementById('worldCoinsCount').textContent = state.coins;
  const invOverlay = document.getElementById('worldInventoryOverlay');
  if(invOverlay && invOverlay.classList.contains('open')) renderWorldInventory();

  worldRAF = requestAnimationFrame(worldLoop);
}

