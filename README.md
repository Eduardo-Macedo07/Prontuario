# Survivor Browser

Jogo de navegador no estilo *roguelite* com visão de cima (inspirado em Megabonk e Vampire Survivors).
Sobreviva às hordas, colete gemas de XP, suba de nível e escolha recompensas. Se morrer, começa de novo,
mas as moedas ganhas ficam para comprar personagens e espaços na Loja.

## Como jogar

- **PC:** abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox). Não precisa instalar nada.
- **Celular:** abra o link do GitHub Pages (https://eduardo-macedo07.github.io/Prontuario/) e toque e arraste
  em qualquer lugar da tela para mover. Dá para usar "Adicionar à tela inicial" para abrir como um app.

| Controle | Ação |
| --- | --- |
| `W` `A` `S` `D`, setas ou tocar/clicar e arrastar | Mover |
| Mouse, toque ou `1` `2` `3` `4` | Escolher personagem e recompensas |
| `Esc`, `P` ou botão ❚❚ | Pausar (mostra seus atributos) |

Todas as armas atacam e miram sozinhas.

## Progressão

- **Espaços:** cada partida começa com 3 espaços de arma (a inicial + 2) e 2 de passiva.
  A Loja libera até 5 de arma e 4 de passiva.
- **Subir de nível:** armas e passivas aparecem misturadas e aleatórias. Cada arma tem **10 níveis** e cada
  passiva 5 (Projéteis, 3). A **raridade da carta multiplica o bônus** daquele nível:
  Comum 1×, Raro 1,67×, Épico 2,67×, Lendário 3,83× (ex.: Chance de Crítico +6% / +10% / +16% / +23%).
  Projéteis usa 1 / 1,5 / 2 / 4, e as frações somam até virar um projétil inteiro.
- **Sorte:** aumenta a chance das raridades altas (sorte 0: 82% comum e 0,5% lendário; sorte 5: 48% comum
  e 6% lendário) e às vezes dá uma 4ª opção.
- **Fogueiras:** fique perto para escolher 1 de 3 bênçãos (não ocupam espaço). Elas vão de fraca a lendária,
  e quanto mais Sorte, mais fortes.
- **Altares:** invocam um chefão. Todo chefão deixa um baú com recompensas raras.
- **Moedas:** caem dos inimigos e somam bônus por tempo, chefões e abates ao fim da partida.

## Loja

| Item | Preço | Objetivo |
| --- | --- | --- |
| Maníaco | 250 | — |
| Golem de Pedra | 400 | Derrotar 1 chefão |
| Espaço de arma (4º) | 200 | Sobreviver 5 minutos |
| Espaço de arma (5º) | 600 | Derrotar 3 chefões no total |
| Espaço de passiva (3º) | 150 | Alcançar o nível 15 |
| Espaço de passiva (4º) | 500 | Sobreviver 10 minutos |

## Inimigos

Todos andam um pouco mais devagar que o seu personagem.

- **Esqueleto** (com espada e escudo) e **Cavaleiro Esqueleto** (armadura, elmo com pluma, mais resistente)
- **Múmia**: lenta e resistente
- **Ceifador**: fantasma de manto e foice que flutua em zigue-zague
- **Lobisomem**: agacha (aviso) e dá um bote rápido
- **Chefões** (revezam): **Robô Destruidor** (marca áreas vermelhas no chão e lança mísseis; saia da marca),
  **Rei Ogro** e **Lich** (invoca esqueletos)

## Personagens

| Personagem | Características | Passiva |
| --- | --- | --- |
| **Rei Gelado** (mago, padrão) | Equilibrado, começa com Estilhaço de Gelo | +1 de Sorte a cada chefão derrotado |
| **Maníaco** (bobo da corte) | Muito rápido e frágil, começa com Facas | +1% de crítico a cada nível |
| **Golem de Pedra** | Muita vida e armadura, lento, começa com Tremor | Mais dano quanto menor a vida (até +120%) |

## Passivas

Vida Máxima, Velocidade de Movimento, Dano, Velocidade de Ataque, Alcance de Coleta, Regeneração, Armadura,
Projéteis, Chance de Crítico, Área e Sorte.

## Arsenal (cada arma até o nível 10)

Estilhaço de Gelo, Arco Caçador (flechas teleguiadas que perfuram), Facas (teleguiadas), Raio em Cadeia
(ricocheteia), Bola de Fogo (explosão em área), Lâminas Orbitais (reduzem o dano recebido), Aura Sagrada e
Tremor de Pedra.

## Mapa

Gerado sem fim: trilhas de terra contínuas, cemitérios com lápides, cruzes, velas e lanternas acesas,
árvores, árvores secas, cercas quebradas, abóboras, crânios, pedras, névoa e vagalumes.
Objetos altos ficam transparentes quando você passa atrás deles.

## Som

Música e efeitos sonoros gerados na hora pelo navegador (sem arquivos de áudio): música calma nos menus,
mais rápida na partida e mais intensa quando há um chefão; sons para cada arma, golpes, explosões, itens,
subir de nível, fogueiras, altares, aviso dos mísseis do robô e rosnado do lobisomem.

## Arte em imagens

Qualquer personagem, inimigo ou objeto pode ser trocado por um PNG. Os modelos ficam em `assets/modelos/`
e o passo a passo em [`assets/LEIA-ME.md`](assets/LEIA-ME.md).

## Configurações

Qualidade gráfica (automática, alta ou baixa), tremor de tela, números de dano, volume da música,
volume dos efeitos e apagar progresso.
O progresso fica salvo no navegador.

## Estrutura

```
index.html   telas (inicial, personagens, loja, configurações, HUD, recompensas, pausa, fim de jogo)
style.css    visual das telas
js/art.js    desenhos: personagens, inimigos, fogueiras, altar, itens, chão e ícones
js/audio.js  sons e música
assets/      arte opcional em imagens (sprites.js, modelos/ e sprites/)
js/game.js   lógica do jogo (laço, armas, inimigos, loja, progresso, efeitos e interface)
```
