function blobSvg(elKey, opts={}){
  const el = ELEMENTS[elKey];
  const evolved = opts.evolved;
  const dom = opts.dominant;
  const wobble = opts.wobble !== false;
  const back = !!opts.back;
  const instanceId = ++_blobInstanceCounter;

  // corpo base: elipse fofa com curva de antena (estilo Jigglybuff)
  let bodyPath;
  let extra = '';

  if(!evolved){
    bodyPath = `M100,40
      C 145,40 168,78 168,118
      C 168,158 138,182 100,182
      C 62,182 32,158 32,118
      C 32,78 55,40 100,40 Z`;
  } else if(dom === 'forca'){
    // corpo mais largo, "ombros"
    bodyPath = `M100,42
      C 155,42 182,74 182,116
      C 182,160 144,186 100,186
      C 56,186 18,160 18,116
      C 18,74 45,42 100,42 Z`;
    extra += `<ellipse cx="46" cy="108" rx="16" ry="20" fill="${el.c2}"/>
               <ellipse cx="154" cy="108" rx="16" ry="20" fill="${el.c2}"/>`;
  } else if(dom === 'velocidade'){
    // corpo mais esguio e alto
    bodyPath = `M100,30
      C 134,30 150,66 150,112
      C 150,164 128,192 100,192
      C 72,192 50,164 50,112
      C 50,66 66,30 100,30 Z`;
    extra += `<path d="M50,120 Q20,110 15,90" stroke="${el.dark}" stroke-width="6" fill="none" stroke-linecap="round"/>
               <path d="M150,120 Q180,110 185,90" stroke="${el.dark}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  } else { // defesa
    // corpo bem redondo e robusto
    bodyPath = `M100,36
      C 152,36 178,80 178,122
      C 178,166 144,190 100,190
      C 56,190 22,166 22,122
      C 22,80 48,36 100,36 Z`;
    extra += `<path d="M40,110 Q100,95 160,110" stroke="${el.dark}" stroke-width="4" fill="none" opacity="0.35"/>
               <path d="M35,140 Q100,128 165,140" stroke="${el.dark}" stroke-width="4" fill="none" opacity="0.35"/>`;
  }

  const uid = elKey + '-' + (evolved ? dom : 'base') + (back ? '-back' : '') + '-' + instanceId;
  const bellyBand = (elKey === 'terra' && !back)
    ? `<ellipse cx="100" cy="168" rx="95" ry="42" fill="${el.belly}" clip-path="url(#clip-${uid})"/>`
    : '';

  const face = back ? `
      <!-- costas: sem rosto, leve sombreado central sugerindo coluna -->
      <path d="M100,80 Q106,116 100,150" stroke="${el.dark}" stroke-width="4" fill="none" opacity="0.22" stroke-linecap="round"/>
      <ellipse cx="100" cy="92" rx="34" ry="18" fill="#fff" opacity="0.12"/>
      <ellipse cx="72" cy="118" rx="10" ry="16" fill="${el.dark}" opacity="0.12"/>
      <ellipse cx="128" cy="118" rx="10" ry="16" fill="${el.dark}" opacity="0.12"/>
  ` : `
      <!-- brilho -->
      <ellipse cx="72" cy="76" rx="20" ry="13" fill="#fff" opacity="0.35"/>
      ${elementTopper(elKey)}
      <!-- eyes -->
      <circle cx="80" cy="108" r="11" fill="#2E1F3B"/>
      <circle cx="124" cy="108" r="11" fill="#2E1F3B"/>
      <circle cx="83" cy="104" r="3.5" fill="#fff"/>
      <circle cx="127" cy="104" r="3.5" fill="#fff"/>
      <!-- blush -->
      <ellipse cx="64" cy="128" rx="9" ry="5.5" fill="${el.c2}" opacity="0.55"/>
      <ellipse cx="140" cy="128" rx="9" ry="5.5" fill="${el.c2}" opacity="0.55"/>
      <!-- mouth -->
      <path d="M92,132 Q100,140 108,132" stroke="#2E1F3B" stroke-width="4" fill="none" stroke-linecap="round"/>
  `;

  return `
    <defs>
      <radialGradient id="grad-${uid}" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="${el.c1}"/>
        <stop offset="100%" stop-color="${el.c2}"/>
      </radialGradient>
      <clipPath id="clip-${uid}"><path d="${bodyPath}"/></clipPath>
    </defs>
    <g class="${wobble ? 'blob-wobble' : ''}">
      <ellipse cx="100" cy="196" rx="52" ry="10" fill="rgba(46,31,59,0.08)"/>
      <!-- perninhas -->
      <ellipse cx="70" cy="190" rx="16" ry="11" fill="${el.c2}"/>
      <ellipse cx="130" cy="190" rx="16" ry="11" fill="${el.c2}"/>
      <path d="${bodyPath}" fill="url(#grad-${uid})"/>
      ${bellyBand}
      ${extra}
      ${back ? elementTopper(elKey) : ''}
      ${face}
    </g>
  `;
}

/* "Chapéu" temático no topo da cabeça, substitui a antena genérica */
function elementTopper(elKey){
  const el = ELEMENTS[elKey];
  if(elKey === 'fogo'){
    return `
      <path d="M92,44 Q78,22 96,4 Q100,18 112,13 Q120,28 104,37 Q114,42 102,49 Q90,52 92,44 Z" fill="${el.c1}"/>
      <path d="M96,42 Q88,26 100,13 Q102,23 109,21 Q111,30 101,36 Q106,40 100,44 Q95,46 96,42 Z" fill="#FFE59A"/>
    `;
  }
  if(elKey === 'agua'){
    return `
      <path d="M100,4 C113,21 119,33 119,43 C119,56 111,64 100,64 C89,64 81,56 81,43 C81,33 87,21 100,4 Z" fill="${el.c1}"/>
      <ellipse cx="92" cy="38" rx="5" ry="8" fill="#fff" opacity="0.7"/>
    `;
  }
  if(elKey === 'ar'){
    return `
      <path d="M100,46 C86,44 74,34 76,20 C77,9 90,4 100,11 C110,4 123,9 124,20 C126,34 114,44 100,46 Z" fill="${el.c1}"/>
      <path d="M100,40 C92,37 85,29 88,19" stroke="${el.dark}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>
    `;
  }
  // terra: pedrinhas + folhas
  return `
    <ellipse cx="80" cy="37" rx="10" ry="8" fill="#ACA495"/>
    <ellipse cx="100" cy="27" rx="13" ry="10" fill="#CFC6B2"/>
    <ellipse cx="120" cy="38" rx="9" ry="7" fill="#8F8778"/>
    <path d="M120,40 Q133,27 129,14" stroke="#6E8C4E" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M127,38 Q138,29 137,18" stroke="#87A85E" stroke-width="4" fill="none" stroke-linecap="round"/>
  `;
}

/* Ambient particles per element, drawn on stage canvas behind/around svg is complex;
   for simplicity we animate small CSS/SVG particles inline in the stage svg itself. */
function particlesSvg(elKey){
  const el = ELEMENTS[elKey];
  const kinds = {
    fogo: ['🔥','✨'],
    terra: ['🍃','🌰'],
    ar: ['☁️','💫'],
    agua: ['💧','❄️'],
  };
  const icons = kinds[elKey];
  let out = '';
  for(let i=0;i<4;i++){
    const x = 30 + Math.random()*260;
    const delay = (Math.random()*4).toFixed(2);
    const dur = (4+Math.random()*3).toFixed(2);
    out += `<text x="${x}" y="205" font-size="16" class="particle" style="animation-delay:${delay}s; animation-duration:${dur}s;">${icons[i%2]}</text>`;
  }
  return out;
}

function hexToRgba(hex, alpha){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderStage(){
  const el = ELEMENTS[state.element];
  document.getElementById('elementBadge').textContent = el.label;
  document.getElementById('elementBadge').style.background = el.dark;
  document.getElementById('elementBadge').style.boxShadow =
    '0 0 0 7px ' + hexToRgba(el.dark, 0.14) + ', 0 8px 18px ' + hexToRgba(el.dark, 0.45);
  document.getElementById('specialTitle').textContent = el.special;

  const dom = dominantStat(state);
  const svg = document.getElementById('stageSvg');
  const spriteBox = document.getElementById('petStageCenter');

  // Todos os 4 elementos agora usam sprite estática com respiração (.pet-sprite)
  const SPRITE_ELEMENTS = ['terra','fogo','agua','ar'];
  if(SPRITE_ELEMENTS.includes(state.element)){
    if(svg) svg.style.display = 'none';
    if(spriteBox){
      spriteBox.style.display = 'flex';
      const petSpriteEl = spriteBox.querySelector('.pet-sprite');
      if(petSpriteEl) petSpriteEl.setAttribute('data-element', state.element);
    }
    return;
  }

  // Fallback (elemento sem sprite ainda): SVG procedural (como era antes)
  if(svg) svg.style.display = '';
  if(spriteBox) spriteBox.style.display = 'none';

  // O bichinho é desenhado num viewBox interno 0..200 (conteúdo real vai de y≈4,
  // topo dos "toppers", até y≈206, base da sombra). O stage agora usa viewBox
  // 0..320 x 0..230, dimensionado pra caber o bichinho com folga simétrica.
  //   X: centro do bichinho (x=100) em x=160 → translateX = 60
  //   Y: translateY = 10 → conteúdo fica entre y=14 e y=216, com ~14px de
  //      margem em cima e embaixo dentro do viewBox de 230 → centralizado.
  svg.innerHTML = `
    <style>
      .blob-wobble{ transform-origin: 100px 120px; animation: wobble 3.2s ease-in-out infinite; }
      @keyframes wobble{
        0%,100%{ transform: translateY(0) scale(1,1); }
        50%{ transform: translateY(-6px) scale(1.02,0.97); }
      }
      .particle{ opacity:0; animation-name: floatUp; animation-iteration-count:infinite; animation-timing-function:ease-out; }
      @keyframes floatUp{
        0%{ opacity:0; transform:translateY(0); }
        15%{ opacity:0.8; }
        100%{ opacity:0; transform:translateY(-140px); }
      }
    </style>
    <g transform="translate(60,10)">${blobSvg(state.element, {evolved: state.evolved, dominant: dom})}</g>
    ${particlesSvg(state.element)}
  `;
}

/* =========================================================
   RENDER: HOME UI
========================================================= */
function renderHome(){
  const level = levelFromXp(state.xp);
  document.getElementById('homeName').textContent = state.name;
  document.getElementById('homeLevel').textContent = 'NÍVEL ' + level;
  document.getElementById('homeCoins').textContent = state.coins;

  ['forca','velocidade','precisao','resistencia','inteligencia','energia','especial'].forEach(stat=>{
    const v = Math.round(state.stats[stat]);
    document.getElementById('val'+cap(stat)).textContent = v;
    document.getElementById('bar'+cap(stat)).style.width = Math.min(100, v) + '%';
  });
  document.getElementById('especialLabel').textContent = ELEMENTS[state.element].special;

  const equippedCount = (state.equippedPowers.livre.length + state.equippedPowers.especial.length);
  // (botão de Poderes não está mais no HTML; a função é acessada pelo ícone de círculos no canto)
  renderStage();
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

/* =========================================================
   SETUP / CRIAÇÃO DO BICHINHO
========================================================= */
function randomElement(){
  const keys = Object.keys(ELEMENTS);
  return keys[Math.floor(Math.random()*keys.length)];
}

let setupElement = randomElement();
function renderSetupPreview(){
  const svg = document.getElementById('setupBlobPreview');
  svg.innerHTML = `
    <style>.blob-wobble{ transform-origin:100px 120px; animation: wobble 3.2s ease-in-out infinite;} @keyframes wobble{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}</style>
    ${blobSvg(setupElement, {evolved:false})}
  `;
}

function createPet(){
  const input = document.getElementById('nameInput');
  const name = input.value.trim() || 'Bichinho';
  state = defaultState(name, setupElement);
  saveState();
  goHome();
  startWorldTimeTicker();
}

function goHome(){
  document.getElementById('screen-setup').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  renderHome();
}

/* =========================================================
   MINIGAME: MIRA
========================================================= */
let miraCtx, miraCanvas, miraBalls=[], miraScore=0, miraTimeLeft=30, miraInterval=null, miraActive=false;
let miraTarget=null, miraSpeedLevel=1, miraXpMultiplier=1, miraHits=0;

