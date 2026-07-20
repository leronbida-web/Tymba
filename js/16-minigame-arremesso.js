/* =========================================================
   MINIGAME: ARREMESSO DE PESO (treina Força)
   — 3 passos por tentativa: trava o ÂNGULO (seta oscilando, toque trava),
     depois carrega a FORÇA (pressiona e arrasta pra trás, igual taco de
     sinuca — solta pra arremessar), depois a física 2D simples joga a
     pedra por cima do MURO. O alvo é a ZONA ENTRE o muro e a bandeira:
     basta a pedra tocar o chão em qualquer ponto desse intervalo pra
     contar ponto e subir de nível — não precisa mais acertar a altura
     exata da bandeira. Bater no muro, cair antes dele ou passar da
     bandeira continuam sendo falha.
   — SEM teto de dificuldade de propósito (mesma filosofia aplicada nos
     outros minigames de vida/colisão nesta sessão): o muro sobe pra
     sempre e vira o próprio limite natural da sessão. O teto de
     recompensa (abaixo) continua como rede de segurança.
========================================================= */
let arremessoCtx, arremessoCanvas, arremessoActive = false;
let arremessoRaf = null, arremessoLastTime = 0;
let arremessoPhase = 'angle'; // 'angle' | 'power' | 'flight' | 'result'
let arremessoScore = 0, arremessoVidas = 3, arremessoWallLevel = 1;
let arremessoAngle = 0, arremessoLockedAngle = 0, arremessoAngleStartTime = 0;
let arremessoPower = 0, arremessoDragging = false, arremessoDragStartY = 0;
let arremessoStone = null; // { x, y, vx, vy, wallChecked, hitWall }
let arremessoResultTimer = null;
let arremessoEnding = false; // trava re-entrada quando o botão Voltar ou o fim natural já disparou finishTraining

// geometria/física da cena — calculadas em pxs relativos ao canvas, então
// funcionam do mesmo jeito em qualquer tamanho de tela (ver startArremesso)
let arremessoGroundY = 0, arremessoWallX = 0, arremessoStoneRestX = 0, arremessoStoneRestY = 0;
let arremessoGravity = 0, arremessoMinSpeed = 0, arremessoMaxSpeed = 0;
let arremessoWallBaseH = 0, arremessoWallStepH = 0, arremessoStoneR = 0, arremessoCanvasTopOffset = 0;
// geometria/alvo da bandeira (o mesmo desenho decorativo de antes, agora também é o alvo)
let arremessoFlagX = 0, arremessoFlagPoleH = 0, arremessoFlagTopY = 0;

const ARREMESSO_MIN_ANGLE = 20 * Math.PI / 180;
const ARREMESSO_MAX_ANGLE = 90 * Math.PI / 180;
const ARREMESSO_ANGLE_PERIOD_MS = 1300; // 1 ciclo completo (min→max→min) da seta
const ARREMESSO_MAX_DRAG_PX = 130;      // arrastar essa distância pra trás = força máxima
const ARREMESSO_RESULT_PAUSE_MS = 950;  // pausa mostrando o resultado antes da próxima tentativa
// ajuste fino: empurra o bichinho pra baixo (valor positivo) ou pra cima (negativo),
// caso a arte dentro do svg tenha respiro embaixo e os "pés" não batam certinho no chão
const ARREMESSO_PET_FOOT_OFFSET_PX = 50; // empurrado mais pra baixo (ajuste solicitado)

// teto de recompensa por sessão — rede de segurança, já que o muro sem teto
// deve derrubar o jogador bem antes disso na prática
const ARREMESSO_MAX_STAT_GAIN = 25;
const ARREMESSO_MAX_COIN_GAIN = 20;

function startArremesso(){
  hideAllScreens();
  document.getElementById('screen-arremesso').classList.add('active');

  arremessoCanvas = document.getElementById('arremessoCanvas');
  const wrap = arremessoCanvas.parentElement;
  arremessoCanvas.width = wrap.clientWidth;
  arremessoCanvas.height = wrap.clientHeight - 50;

  const el = ELEMENTS[state.element];
  arremessoCanvas.style.background = `linear-gradient(180deg, ${el.c1}, ${el.dark})`;
  // sem isso, arrastar o dedo pra baixo pra carregar a força é interpretado
  // pelo navegador como um gesto de rolagem da página, que CANCELA o toque
  // no meio do caminho (dispara pointercancel) — daí a pedra saindo com
  // força baixa antes do jogador soltar o dedo de propósito.
  arremessoCanvas.style.touchAction = 'none';

  arremessoCtx = arremessoCanvas.getContext('2d');
  const w = arremessoCanvas.width, h = arremessoCanvas.height;

  // física escalada pelo tamanho do canvas, pra ficar consistente em qualquer tela
  arremessoGroundY = h - h*0.12;
  arremessoWallX = w * 0.55;
  arremessoStoneRestX = w * 0.20;
  arremessoStoneRestY = arremessoGroundY - h*0.32;
  arremessoGravity = h * 3.6;
  arremessoMinSpeed = h * 0.95;
  arremessoMaxSpeed = h * 2.15;
  arremessoWallBaseH = h * 0.11;
  arremessoWallStepH = h * 0.05;
  arremessoStoneR = Math.max(7, w * 0.022);
  arremessoCanvasTopOffset = arremessoCanvas.offsetTop;

  // geometria da bandeira-alvo (mesma posição/formato decorativo de sempre,
  // agora usada também como zona de acerto — ver drawArremessoScene)
  arremessoFlagX = w * 0.90;
  arremessoFlagPoleH = h * 0.18;
  arremessoFlagTopY = arremessoGroundY - arremessoFlagPoleH;

  arremessoScore = 0;
  arremessoVidas = 3;
  arremessoWallLevel = 1;
  arremessoActive = true;
  arremessoEnding = false;
  arremessoLastTime = 0;
  clearTimeout(arremessoResultTimer);

  document.getElementById('arremessoScore').textContent = arremessoScore;
  document.getElementById('arremessoVidas').textContent = arremessoVidas;
  document.getElementById('arremessoLevelLbl').textContent = arremessoWallLevel;
  const arremessoPetEl = document.getElementById('arremessoPetSvg');
  arremessoPetEl.innerHTML = blobSvg(state.element, { evolved: state.evolved, wobble: true });

  // posiciona o bichinho primeiro (aproximação inicial, mesma conta de antes)...
  arremessoPetEl.style.left = arremessoStoneRestX - w*0.05 + 'px';
  arremessoPetEl.style.top = arremessoGroundY + arremessoCanvasTopOffset + ARREMESSO_PET_FOOT_OFFSET_PX + 'px';

  // ...e então mede onde ele REALMENTE caiu na tela (depende do tamanho do
  // sprite renderizado, que não controlamos aqui), pra ancorar a pedra
  // exatamente ali — assim ela sempre sai visualmente do corpo do
  // bichinho, e não de um ponto solto do cenário que só coincide às vezes.
  const arremessoCanvasRect = arremessoCanvas.getBoundingClientRect();
  const arremessoPetRect = arremessoPetEl.getBoundingClientRect();
  arremessoStoneRestX = (arremessoPetRect.left + arremessoPetRect.width * 0.5) - arremessoCanvasRect.left;
  arremessoStoneRestY = (arremessoPetRect.top + arremessoPetRect.height * 0.38) - arremessoCanvasRect.top;

  arremessoCanvas.onpointerdown = handleArremessoPointerDown;
  arremessoCanvas.onpointermove = handleArremessoPointerMove;
  arremessoCanvas.onpointerup = handleArremessoPointerUp;
  arremessoCanvas.onpointercancel = handleArremessoPointerUp;

  beginArremessoAngleStep();
  requestAnimationFrame(arremessoLoop);
}

function beginArremessoAngleStep(){
  arremessoPhase = 'angle';
  arremessoAngleStartTime = performance.now();
  arremessoStone = null;
  arremessoPower = 0;
  arremessoDragging = false;
  setArremessoInstructions('Toque na tela quando o ângulo estiver bom, pra travar!');
}

function setArremessoInstructions(text){
  const instr = document.getElementById('arremessoInstructions');
  if(instr) instr.textContent = text;
}

function handleArremessoPointerDown(e){
  if(!arremessoActive) return;
  e.preventDefault();
  // trava o toque no canvas: sem isso, arrastar o dedo pra baixo (carregar força)
  // costuma sair da área pequena do canvas e o navegador solta o toque antes da hora
  try{ arremessoCanvas.setPointerCapture(e.pointerId); }catch(err){}
  if(arremessoPhase === 'angle'){
    arremessoLockedAngle = arremessoAngle;
    arremessoPhase = 'power';
    setArremessoInstructions('Segure e arraste pra trás (pra baixo) pra carregar a força!');
    return;
  }
  if(arremessoPhase === 'power'){
    arremessoDragging = true;
    arremessoDragStartY = e.clientY;
    arremessoPower = 0;
  }
}

function handleArremessoPointerMove(e){
  if(!arremessoActive || arremessoPhase !== 'power' || !arremessoDragging) return;
  e.preventDefault();
  const dy = e.clientY - arremessoDragStartY; // arrastar pra baixo = puxando o "taco" pra trás
  arremessoPower = Math.max(0, Math.min(1, dy / ARREMESSO_MAX_DRAG_PX));
}

function handleArremessoPointerUp(){
  if(!arremessoActive || arremessoPhase !== 'power' || !arremessoDragging) return;
  arremessoDragging = false;
  launchArremessoStone();
}

function launchArremessoStone(){
  const speed = arremessoMinSpeed + (arremessoMaxSpeed - arremessoMinSpeed) * arremessoPower;
  arremessoStone = {
    x: arremessoStoneRestX,
    y: arremessoStoneRestY,
    vx: speed * Math.cos(arremessoLockedAngle),
    vy: -speed * Math.sin(arremessoLockedAngle),
    wallChecked: false,
    hitWall: false,
  };
  arremessoPhase = 'flight';
  setArremessoInstructions('Lá vai a pedra...');
}

function currentArremessoWallHeight(){
  return arremessoWallBaseH + (arremessoWallLevel - 1) * arremessoWallStepH;
}

function resolveArremessoAttempt(success, reason){
  arremessoPhase = 'result';
  if(success){
    arremessoScore++;
    arremessoWallLevel++;
    document.getElementById('arremessoScore').textContent = arremessoScore;
    document.getElementById('arremessoLevelLbl').textContent = arremessoWallLevel;
    setArremessoInstructions('Acertou entre o muro e a bandeira! 🚩 O muro subiu');
    spawnMiraLevelUpPop(arremessoWallLevel, 'screen-arremesso');
  } else {
    arremessoVidas--;
    document.getElementById('arremessoVidas').textContent = arremessoVidas;
    const msg = reason === 'muro' ? 'Bateu no muro!'
      : reason === 'curto' ? 'Caiu antes do muro...'
      : 'Passou da bandeira, foi longe demais...';
    setArremessoInstructions(msg);
  }

  if(arremessoVidas <= 0){
    arremessoResultTimer = setTimeout(() => endArremesso(), ARREMESSO_RESULT_PAUSE_MS);
  } else {
    arremessoResultTimer = setTimeout(beginArremessoAngleStep, ARREMESSO_RESULT_PAUSE_MS);
  }
}

function arremessoLoop(ts){
  if(!arremessoActive) return;
  if(!arremessoLastTime) arremessoLastTime = ts;
  const dt = Math.min(0.033, (ts - arremessoLastTime) / 1000);
  arremessoLastTime = ts;

  if(arremessoPhase === 'angle'){
    const span = ARREMESSO_MAX_ANGLE - ARREMESSO_MIN_ANGLE;
    const mid = ARREMESSO_MIN_ANGLE + span / 2;
    const phase01 = ((ts - arremessoAngleStartTime) / ARREMESSO_ANGLE_PERIOD_MS) * Math.PI * 2;
    arremessoAngle = mid + Math.sin(phase01) * (span / 2);
  }

  if(arremessoPhase === 'flight' && arremessoStone){
    const s = arremessoStone;
    const prevX = s.x, prevY = s.y;
    s.x += s.vx * dt;
    s.vy += arremessoGravity * dt;
    s.y += s.vy * dt;

    // cruzou o X do muro nesse frame? checa a altura exata da pedra ali (interpolada)
    if(!s.wallChecked && prevX < arremessoWallX && s.x >= arremessoWallX){
      s.wallChecked = true;
      const frac = (arremessoWallX - prevX) / (s.x - prevX || 1);
      const yAtWall = prevY + (s.y - prevY) * frac;
      const wallTopY = arremessoGroundY - currentArremessoWallHeight();
      if(yAtWall > wallTopY){
        // bateu no muro: trava a pedra ali e cai reto
        s.x = arremessoWallX;
        s.y = yAtWall;
        s.vx = 0;
        s.hitWall = true;
      }
    }

    // cruzou o X da bandeira nesse frame? só serve pro visual (a pedra
    // some no chão depois) — o julgamento de acerto é feito abaixo, pelo
    // ponto exato em que ela toca o chão.

    if(s.y >= arremessoGroundY){
      // interpola o ponto exato em que a pedra cruza a linha do chão, pra
      // julgar a zona de pouso com precisão (não só o pixel do frame em
      // que percebemos que já passou)
      const fracG = (arremessoGroundY - prevY) / (s.y - prevY || 1);
      const landX = s.hitWall ? s.x : prevX + (s.x - prevX) * fracG;
      s.y = arremessoGroundY;

      let reason = null;
      let success = false;
      if(s.hitWall){
        reason = 'muro';
      } else if(landX < arremessoWallX){
        reason = 'curto'; // caiu antes de sequer alcançar o muro
      } else if(landX > arremessoFlagX){
        reason = 'longe'; // passou da bandeira
      } else {
        success = true; // pousou exatamente entre o muro e a bandeira
      }
      resolveArremessoAttempt(success, reason);
    }
  }

  drawArremessoScene(arremessoCanvas.width, arremessoCanvas.height);
  arremessoRaf = requestAnimationFrame(arremessoLoop);
}

function drawArremessoScene(w, h){
  const ctx = arremessoCtx;
  ctx.clearRect(0, 0, w, h);

  // chão
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(0, arremessoGroundY, w, h - arremessoGroundY);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, arremessoGroundY);
  ctx.lineTo(w, arremessoGroundY);
  ctx.stroke();

  // bandeira-alvo: pousada na mesma posição decorativa de antes, agora é
  // o alvo de verdade (acertar aqui = ponto). Um leve brilho na base do
  // mastro reforça que é o objetivo, não só cenário.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(arremessoFlagX, arremessoGroundY);
  ctx.lineTo(arremessoFlagX, arremessoFlagTopY);
  ctx.stroke();
  ctx.fillStyle = '#F2762E';
  ctx.beginPath();
  ctx.moveTo(arremessoFlagX, arremessoFlagTopY);
  ctx.lineTo(arremessoFlagX + w*0.05, arremessoFlagTopY + h*0.025);
  ctx.lineTo(arremessoFlagX, arremessoFlagTopY + h*0.05);
  ctx.closePath();
  ctx.fill();

  // muro (tijolos simples)
  const wallH = currentArremessoWallHeight();
  const wallTopY = arremessoGroundY - wallH;
  const wallHalfW = Math.max(10, w * 0.022);
  const wallGrad = ctx.createLinearGradient(arremessoWallX - wallHalfW, 0, arremessoWallX + wallHalfW, 0);
  wallGrad.addColorStop(0, '#8A6A50');
  wallGrad.addColorStop(0.5, '#B08560');
  wallGrad.addColorStop(1, '#6E5038');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(arremessoWallX - wallHalfW, wallTopY, wallHalfW*2, wallH);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  const brickRows = Math.max(1, Math.floor(wallH / (h*0.05)));
  for(let i=1;i<brickRows;i++){
    const y = wallTopY + (wallH/brickRows)*i;
    ctx.beginPath();
    ctx.moveTo(arremessoWallX - wallHalfW, y);
    ctx.lineTo(arremessoWallX + wallHalfW, y);
    ctx.stroke();
  }
  ctx.strokeRect(arremessoWallX - wallHalfW, wallTopY, wallHalfW*2, wallH);

  // seta de ângulo / mira de arremesso, só nas fases de mira e força
  if(arremessoPhase === 'angle' || arremessoPhase === 'power'){
    const ang = arremessoPhase === 'angle' ? arremessoAngle : arremessoLockedAngle;
    drawArremessoAngleArrow(ctx, arremessoStoneRestX, arremessoStoneRestY, ang, w*0.16);
  }

  // pedra: parada (pré-arremesso) ou voando
  if(arremessoStone){
    drawArremessoStone(ctx, arremessoStone.x, arremessoStone.y);
  } else {
    drawArremessoStone(ctx, arremessoStoneRestX, arremessoStoneRestY);
  }

  // barra de força (estilo sinuca), só durante a fase de força
  if(arremessoPhase === 'power'){
    drawArremessoPowerBar(ctx, w, h);
  }

  // bichinho: já foi posicionado uma vez em startArremesso (é onde a pedra
  // foi ancorada), não precisa reposicionar a cada frame.
}

function drawArremessoAngleArrow(ctx, x, y, angle, len){
  const tx = x + Math.cos(angle) * len;
  const ty = y - Math.sin(angle) * len;
  ctx.strokeStyle = '#FFE9A8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  // ponta da seta
  const headLen = len * 0.16;
  const a1 = angle + Math.PI * 0.82, a2 = angle - Math.PI * 0.82;
  ctx.fillStyle = '#FFE9A8';
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + Math.cos(a1)*headLen, ty - Math.sin(a1)*headLen);
  ctx.lineTo(tx + Math.cos(a2)*headLen, ty - Math.sin(a2)*headLen);
  ctx.closePath();
  ctx.fill();
}

function drawArremessoStone(ctx, x, y){
  const r = arremessoStoneR;
  const grad = ctx.createRadialGradient(x - r*0.35, y - r*0.35, r*0.15, x, y, r);
  grad.addColorStop(0, '#9A9A9A');
  grad.addColorStop(0.6, '#5C5C5C');
  grad.addColorStop(1, '#2E2E2E');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawArremessoPowerBar(ctx, w, h){
  const barW = w * 0.07, barH = h * 0.45;
  const barX = w * 0.06, barY = h * 0.10;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(barX, barY, barW, barH);
  const fillH = barH * arremessoPower;
  const el = ELEMENTS[state.element];
  ctx.fillStyle = el.c2;
  ctx.fillRect(barX, barY + (barH - fillH), barW, fillH);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);
}

function endArremesso(forcedTitle){
  arremessoActive = false;
  arremessoEnding = true;
  cancelAnimationFrame(arremessoRaf);
  clearTimeout(arremessoResultTimer);
  arremessoCanvas.onpointerdown = null;
  arremessoCanvas.onpointermove = null;
  arremessoCanvas.onpointerup = null;
  arremessoCanvas.onpointercancel = null;

  const statGain = Math.min(ARREMESSO_MAX_STAT_GAIN, Math.max(1, Math.round(arremessoScore*0.6 + 1)));
  const coinGain = Math.min(ARREMESSO_MAX_COIN_GAIN, Math.max(1, Math.round(arremessoScore/2)));
  const title = forcedTitle || (arremessoScore >= 12 ? 'Braço de ferro!' : 'Treino concluído!');
  finishTraining('screen-arremesso', 'forca', statGain, coinGain, title,
    `Você acertou a bandeira ${arremessoScore} vezes, chegando no nível ${arremessoWallLevel}.`);
}

// botão Voltar: sai do arremesso a qualquer momento, levando o XP / força / moedas
// já conquistados até aqui (mesma ideia do botão Voltar do cores2048).
function arremessoBack(){
  if(!arremessoActive || arremessoEnding) return;
  endArremesso('Voltou pra casa!');
}
