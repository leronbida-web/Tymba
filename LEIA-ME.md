# Tymba — status do projeto (leia isto primeiro)

> Este arquivo existe pra qualquer IA (ou eu mesmo, numa conversa nova sem
> memória da anterior) conseguir se situar rápido no projeto sem precisar
> reler o código inteiro. Atualizo ele sempre que fechamos uma parte
> importante. Se você é uma IA lendo isso pela primeira vez: comece por
> aqui antes de mexer em qualquer arquivo.

## O que é o jogo
"Tymba" é um jogo de bichinho virtual (tipo Tamagotchi) com elementos
(Fogo/Água/Ar/Terra), minigames de treino, duelos 1v1 (local e online via
PeerJS/QR code), e um modo mundo aberto em tempo real onde o player
coleta recursos, crafta ferramentas e constrói.

## Onde o jogo está publicado
- **Repositório**: `https://github.com/leronbida-web/Tymba`
- **Jogável em**: `https://leronbida-web.github.io/Tymba/` (GitHub Pages,
  atualiza sozinho ~1-2 min depois de um push na branch `main`)
- Existe um `.nojekyll` na raiz — **não apague**. Sem ele o GitHub Pages
  tenta processar o site com Jekyll e quebra o carregamento dos scripts.

## Como o Leron edita o código no dia a dia
1. Pede a mudança aqui no chat.
2. Eu (Claude) edito o(s) arquivo(s) certo(s) dentro da estrutura modular
   e devolvo só os arquivos que mudaram (não o projeto inteiro).
3. Leron abre o **GitHub Desktop** (já instalado, repositório `Tymba`
   clonado localmente no PC Windows), substitui os arquivos baixados na
   pasta local, escreve um resumo e clica **Commit to main → Push origin**.
4. Espera 1-2 min e testa no link do GitHub Pages.

⚠️ **Cache no celular**: o Chrome mobile costuma guardar `css/style.css` e
os `js/*.js` em cache e não pega a versão nova sozinho. Por isso o
`index.html` usa cache-busting (`?v=4` no final de cada `<script src>` e
do `<link rel="stylesheet">`). **Toda vez que eu mudar um arquivo `.js` ou
`.css` local, preciso bumpar esse número de versão no `index.html`**, ou o
celular vai continuar mostrando a versão antiga mesmo depois do push.

## Estrutura dos arquivos

```
Tymba/
├── index.html                 esqueleto: telas em HTML, <script src> em ordem, cache-busting ?v=N
├── .nojekyll                  desliga o processamento Jekyll do GitHub Pages (não apagar)
├── css/
│   └── style.css              todo o CSS
└── js/
    ├── 01-core-state.js        estado global, save/load (localStorage), elementos, catálogo de poderes
    ├── 02-pet-interactions.js  animação de hit, tap no bichinho, PADRÕES DE CONSTRUÇÃO e constantes do
    │                           modo mundo (WORLD_GRID, WORLD_DAY_MS, WORLD_HOUSE_SAFE_RADIUS, etc)
    ├── 03-world.js             modo mundo aberto: árvores, pedras, casas, inimigos, joystick, inventário,
    │                           guia de construções, HUD do mundo — é o maior arquivo, ~1270 linhas
    ├── 04-render-core.js       sprites SVG do bichinho, telas home/stage, init do app (setup vs home)
    ├── 05-minigame-mira.js     minigame de mira
    ├── 06-evolution-training.js  evolução + resultado de treinos
    ├── 07-minigame-defesa.js   minigame defesa (canhão)
    ├── 08-minigame-especial.js minigame especial
    ├── 09-minigame-corrida.js  minigame corrida
    ├── 10-minigame-pulo.js     minigame pulo
    ├── 11-minigame-cores2048.js minigame 2048
    ├── 12-poderes-status.js   menu de poderes/status
    ├── 13-duel-core.js         duelo PvE/PvP (regras, combate, UI de arena, host roda a lógica completa)
    ├── 14-duel-online.js       duelo online (PeerJS, QR code) — host/guest, host manda o estado pro guest
    └── 15-dev-tools.js         modo dev (editor de layout, ticker do mundo, INIT do jogo ao carregar)
```

`<script src="...">` sem `type="module"` compartilha o mesmo escopo
global — é como se fosse tudo colado num arquivo só, carregado em pedaços
na ordem certa. Isso é o que permite editar só um arquivo pequeno em vez
do projeto inteiro a cada pedido, economizando tokens.

## Convenções do projeto (seguir sempre)
- **Todo texto do jogo, nomes de variável, comentários e logs em
  português do Brasil.**
- Arquitetura **host/guest**: no duelo online, o host roda toda a lógica
  do jogo e sincroniza o estado pro guest (o guest não decide nada
  sozinho).
- Constantes importantes: `FREEZE_DURATION_MS`, `FLY_DURATION_MS`,
  `especial_agua`, `especial_ar`, `especial_terra` (poderes especiais por
  elemento).
- Constantes do modo mundo (em `02-pet-interactions.js`):
  `WORLD_GRID = 44` (tamanho de um bloco/célula da grade),
  `WORLD_DAY_MS` (duração de 1 dia do mundo), `WORLD_HOUSE_SAFE_RADIUS =
  260` (raio em que bichinhos selvagens evitam uma casa).

## Estado atual — o que já funciona
- **Modo mundo**: joystick, coleta de madeira/pedra, dia/noite, bichinhos
  selvagens que fogem de dia e atacam à noite (bolinhas do elemento).
- **Crafting por padrão na grade** (madeira/pedra colocadas em formato
  específico): machado, picareta, espada, casa de madeira, casa de pedra.
  Padrões ficam em `WORLD_AXE_PATTERN`, `WORLD_PICKAXE_PATTERN`,
  `WORLD_SWORD_PATTERN`, `WORLD_HOUSE_PATTERN` (`02-pet-interactions.js`).
- **Espada**: clicar num bichinho selvagem com ela equipada mata na hora
  (sem entrar em duelo), dá 100 moedas, o bichinho reaparece em outro
  ponto do mapa.
- **Inventário** (🎒 no HUD do mundo): clique num item pra equipar
  ferramenta ou selecionar madeira/pedra pra construir — não crafta mais
  equipando automaticamente.
- **Guia de construções** (📜 no HUD do mundo): mostra visualmente o
  padrão de cada item craftável.
- **Casas**: madeira dura 5 dias do mundo, pedra dura 30 dias. Bichinhos
  selvagens evitam a área e não conseguem atacar o player enquanto ele
  estiver dentro do raio seguro de uma casa, de noite.
- **Blocos soltos no chão**: clicar devolve o recurso pro inventário; se
  não forem recolhidos até a noite chegar, somem sozinhos.

## Pendências conhecidas (retomar quando der)
- **Congelador (freeze), Voo, Muro de Terra**: mecânicas especiais que
  quebraram na transição de turnos pra tempo real — ainda precisam ser
  restauradas no sistema de duelo.
- **Guest não recebe animações**: no duelo online, o cliente guest não
  recebe a lógica de animação de `fireCard()` (esquiva, escudo, ataque),
  então ele não vê essas animações — só o host vê. Gap arquitetural
  conhecido, ainda não resolvido.

## Se os créditos acabarem no meio de uma conversa
Abra uma conversa nova e mande o link do repositório
(`https://github.com/leronbida-web/Tymba`) pedindo pra ler este
`LEIA-ME.md` primeiro. Se a IA não tiver acesso à internet, baixe o
`.zip` do repositório (botão verde "Code → Download ZIP" no GitHub) e
suba os arquivos direto no chat.

## Se quiser voltar a 1 arquivo HTML só (pra testar rápido sem GitHub)
Também dá — é só pedir "gera o bundle" que eu colo o CSS e os JS de volta
dentro de um único HTML. Mas pro dia a dia de edição, o modo modular +
GitHub Pages é bem melhor (edita só o arquivo certo, sem gastar tokens
reenviando tudo).
