function playHitAnimation(side, element){
  const gif = DUEL_HIT_GIFS[element];
  if(!gif) return;
  const el = document.getElementById(side === 'self' ? 'duelSelfSvg' : 'duelOppSvg');
  if(!el) return;
  el.style.backgroundImage = "url('" + gif + "')";
  _hitAnimActive[side] = true;
  clearTimeout(_hitAnimTimers[side]);
  _hitAnimTimers[side] = setTimeout(()=>{
    _hitAnimActive[side] = false;
    const staticUrl = side === 'self' ? DUEL_SPRITES_BACK[element] : DUEL_SPRITES_FRONT[element];
    el.style.backgroundImage = "url('" + staticUrl + "')";
  }, HIT_ANIM_MS);
}

/* ---------- Tela inicial: toque no bichinho troca a imagem por uma reação, por elemento ---------- */
const TAP_REACTIONS = {
  terra: ['https://i.imgur.com/I6znDjW.gif', 'https://i.imgur.com/5FSfiYc.gif'],
  fogo:  ['https://i.imgur.com/tMrawn5.gif'],
  agua:  ['https://i.imgur.com/AiXQ7u8.gif'],
  ar:    ['https://i.imgur.com/sL5Q7Zr.gif'],
};
const TAP_ANIM_MS = 1500;
const _tapIndexByElement = {};
let _tapAnimTimer = null;
function onPetTap(){
  if(!state) return;
  const reactions = TAP_REACTIONS[state.element];
  if(!reactions || !reactions.length) return;
  const imgEl = document.querySelector('#petStageCenter .pet-sprite-img');
  if(!imgEl) return;
  const i = _tapIndexByElement[state.element] || 0;
  const img = reactions[i % reactions.length];
  _tapIndexByElement[state.element] = i + 1;
  imgEl.style.backgroundImage = "url('" + img + "')";
  clearTimeout(_tapAnimTimer);
  _tapAnimTimer = setTimeout(()=>{
    imgEl.style.backgroundImage = '';
  }, TAP_ANIM_MS);
}



/* =========================================================
   MUNDO — overworld livre (movimento em todas as direções),
   com árvores, construção simples, montanhas geradas por CSS/SVG
   (sem imagem hospedada) e inimigos noturnos (reaproveita o
   duelo contra IA já existente)
========================================================= */
const WORLD_MOUNTAIN_FAR = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20500%20260%22%20preserveAspectRatio%3D%22none%22%3E%0A%3Cpath%20d%3D%22M%200%2C190%20L%200.0%2C154.0%20L%20104.2%2C72.9%20L%20197.6%2C44.5%20L%20306.1%2C69.5%20L%20400.8%2C88.9%20L%20500.0%2C154.0%20L%20500%2C190%20L%20500%2C260%20L%200%2C260%20Z%22%20fill%3D%22%23B7C6EC%22/%3E%0A%3C/svg%3E";
const WORLD_MOUNTAIN_NEAR = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20500%20260%22%20preserveAspectRatio%3D%22none%22%3E%0A%3Cpath%20d%3D%22M%200%2C210%20L%200.0%2C186.0%20L%2093.5%2C102.1%20L%20293.6%2C148.8%20L%20341.8%2C140.8%20L%20500.0%2C186.0%20L%20500%2C210%20L%20500%2C260%20L%200%2C260%20Z%22%20fill%3D%22%2393A7D9%22/%3E%0A%3C/svg%3E";
const WORLD_WIDTH = 2800;
const WORLD_HEIGHT = 1500;
const WORLD_TREE_COUNT = 26;
const WORLD_CHOP_RADIUS = 90;
const WORLD_TREE_RESPAWN_MS = 45000;
const WORLD_TREE_HITS_NEEDED = 5;
const WORLD_ROCK_HITS_NEEDED = 20; // mãos vazias: precisa de 20 toques pra quebrar a rocha
const WORLD_ROCK_COUNT = 16;
const WORLD_ROCK_RADIUS = 70;
const WORLD_ROCK_RESPAWN_MS = 30000;
const WORLD_ENEMY_COUNT = 6;
const WORLD_ENEMY_RADIUS = 55; // distância máxima pra conseguir clicar e entrar em duelo
const WORLD_ENEMY_FLEE_RADIUS = 190; // distância em que o bichinho selvagem percebe o player e foge
const WORLD_ENEMY_SPEED = 80; // px/s — mais lento que o player (velocidade normal, vagando)
const WORLD_ENEMY_FLEE_SPEED = 130; // px/s — mais rápido quando está fugindo do player
const WORLD_CYCLE_MS = 7 * 60 * 1000; // dia e noite duram 7 minutos cada
const WORLD_DAY_MS = WORLD_CYCLE_MS * 2; // 1 "dia do mundo" = 1 ciclo dia+noite completo
const WORLD_MOVE_SPEED = 220; // px/s
const WORLD_PLAYER_MARGIN = 45; // barreira invisível: mantém o player longe o bastante da borda do mapa pra não ficar cortado pela viewport

/* ---- Construção: casas feitas de blocos de madeira em grade ---- */
const WORLD_GRID = 44; // mesmo tamanho de um bloco (world-block), usado pra alinhar construções numa grade
const WORLD_HOUSE_COLS = 4;
const WORLD_HOUSE_ROWS = 3;
// padrão "casa nível 1": moldura em formato de portal (topo cheio + pilares laterais),
// deixando os 2x2 do meio livres pra o bichinho ficar "dentro" — usa exatamente 8 madeiras
const WORLD_HOUSE_PATTERN = [ [0,0],[1,0],[2,0],[3,0], [0,1],[3,1], [0,2],[3,2] ];
const WORLD_HOUSE_GATE_CELLS = [ [1,1],[2,1],[1,2],[2,2] ];
// padrão "machado": 2 pedras lado a lado em cima (a lâmina) + 2 madeiras empilhadas
// embaixo à esquerda (o cabo) — usa exatamente 2 madeiras e 2 pedras
const WORLD_AXE_PATTERN = [
  { dx:0, dy:0, type:'stone' },
  { dx:1, dy:0, type:'stone' },
  { dx:0, dy:1, type:'wood'  },
  { dx:0, dy:2, type:'wood'  },
];
const WORLD_TREE_HITS_NEEDED_AXE = 2; // com machado em mãos, só precisa de 2 golpes na árvore
// padrão "picareta": 3 pedras lado a lado em cima (a cabeça) + 2 madeiras empilhadas
// embaixo à esquerda (o cabo) — usa exatamente 3 pedras e 2 madeiras
const WORLD_PICKAXE_PATTERN = [
  { dx:0, dy:0, type:'stone' },
  { dx:1, dy:0, type:'stone' },
  { dx:2, dy:0, type:'stone' },
  { dx:0, dy:1, type:'wood'  },
  { dx:0, dy:2, type:'wood'  },
];
const WORLD_ROCK_HITS_NEEDED_PICKAXE = 5; // com picareta em mãos, só precisa de 5 toques pra quebrar a rocha
// padrão "espada": 2 pedras lado a lado em cima (a lâmina) + 1 madeira embaixo
// à esquerda (o cabo) — usa exatamente 1 madeira e 2 pedras
const WORLD_SWORD_PATTERN = [
  { dx:0, dy:0, type:'stone' },
  { dx:1, dy:0, type:'stone' },
  { dx:0, dy:1, type:'wood'  },
];
const WORLD_ENEMY_KILL_COINS = 100; // moedas ganhas ao matar um bichinho selvagem com a espada
// raios de colisão física (bloqueiam o movimento do player, obrigando a desviar)
const WORLD_PLAYER_COLLISION_RADIUS = 14;
const WORLD_ROCK_COLLISION_RADIUS = 22;
const WORLD_TREE_TRUNK_COLLISION_RADIUS = 14; // só o tronco na base da árvore, não a copa inteira
const WORLD_BLOCK_COLLISION_RADIUS = 18;
const WORLD_HOUSE_LIFETIME_DAYS = { 1: 5 }; // casa nível 1 dura 5 dias do mundo
const WORLD_HOUSE_SAFE_RADIUS = 260; // bichinhos selvagens não chegam perto de uma casa dentro desse raio

// recompensa por permanecer no mundo: cada "dia do mundo" (dia+noite) completo dá moedas e XP
const WORLD_DAILY_COINS = 500; // valor provisório, revisaremos os ganhos depois
const WORLD_DAILY_XP = 120;    // valor provisório, revisaremos os ganhos depois

// à noite os bichinhos selvagens ficam violentos e atacam com bolinhas da cor do elemento
const WORLD_NIGHT_SIGHT_RADIUS = 210; // distância em que percebem o player e passam a atacar
const WORLD_NIGHT_ENEMY_BONUS_RATIO = 0.5; // à noite tem 50% a mais de bichinhos selvagens que de dia
const WORLD_NIGHT_ATTACK_COOLDOWN_MS = 800; // intervalo entre ataques
const WORLD_NIGHT_ENEMY_SPEED_MULT = 2.0; // à noite os bichinhos andam 2x mais rápido
const WORLD_NIGHT_ATTACK_SPEED_MULT = 0.5; // à noite o cooldown de ataque cai pela metade (50% mais rápido)
const WORLD_NIGHT_BALL_SPEED = 150; // px/s — dá pra desviar andando
const WORLD_PLAYER_HIT_RADIUS = 20; // raio de colisão da bolinha com o player
const WORLD_PLAYER_MAX_HITS = 10; // quantidade de bolinhas até "morrer"

