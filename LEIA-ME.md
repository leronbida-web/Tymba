# Bichinho Elemental — versão modular (pra economizar tokens no Claude)

## O que mudou
O jogo era 1 arquivo HTML de 225 KB / 5.299 linhas. Agora é uma pasta com
vários arquivos pequenos. **O jogo funciona exatamente igual** — só dividi
o código, não mudei nenhuma linha de lógica (conferi caractere por
caractere que ficou idêntico ao original).

Isso funciona porque `<script src="...">` sem `type="module"` compartilha
o mesmo escopo global do navegador — é como se fosse tudo colado num
arquivo só, só que carregado em pedaços, na ordem certa.

## Estrutura

```
bichinho/
├── index.html                 (esqueleto: head, HTML dos telas, <script src> em ordem)
├── css/
│   └── style.css              (todo o CSS)
└── js/
    ├── 01-core-state.js        estado, save/load, elementos, catálogo de poderes
    ├── 02-pet-interactions.js  animação de hit, tap no bichinho
    ├── 03-world.js             mundo aberto (árvores, pedras, casas, inimigos, joystick)
    ├── 04-render-core.js       sprites SVG do bichinho, telas home/stage
    ├── 05-minigame-mira.js     minigame de mira
    ├── 06-evolution-training.js  evolução + resultado de treinos
    ├── 07-minigame-defesa.js   minigame defesa (canhão)
    ├── 08-minigame-especial.js minigame especial
    ├── 09-minigame-corrida.js  minigame corrida
    ├── 10-minigame-pulo.js     minigame pulo
    ├── 11-minigame-cores2048.js minigame 2048
    ├── 12-poderes-status.js   menu de poderes/status
    ├── 13-duel-core.js         duelo PvE/PvP (regras, combate, UI de arena)
    ├── 14-duel-online.js       duelo online (PeerJS, QR code)
    └── 15-dev-tools.js         modo dev (editor de layout, ticker do mundo)
```

## Por que isso economiza tokens
Antes, qualquer edição (ex: "ajusta o dano do Círculo de Fogo") exigia eu
ler/reenviar o arquivo de 225 KB inteiro (ou uma boa fatia dele) pra
localizar o trecho certo. Agora eu abro só o arquivo do sistema em
questão (`13-duel-core.js`, por exemplo, tem ~700 linhas em vez de 5.300)
e edito só ele. Isso reduz muito o contexto usado por pedido.

## Como pedir edições daqui pra frente
Pode continuar falando normalmente ("aumenta o dano do Golpe Certeiro",
"corrige bug na Voz do minigame Pulo"...) — eu já sei em qual arquivo
cada sistema mora graças a essa organização e vou direto nele. Se quiser
acelerar ainda mais, pode citar o arquivo (ex: "no 07-minigame-defesa.js,
aumenta a velocidade base").

## Rodando o jogo
Simplesmente abra `index.html` no navegador (funciona local, via
`file://`, sem precisar de servidor — os `<script src>` locais carregam
normalmente). Se quiser subir pra web, suba a pasta inteira mantendo essa
estrutura de subpastas.

## Se quiser voltar a 1 arquivo só (pra distribuir, por exemplo)
Também dá — é só eu colar o CSS e os JS de volta dentro de um único HTML
na hora de gerar a versão "final" pra você compartilhar ou publicar. Mas
pro dia a dia de edição comigo, o modo modular é bem melhor.
