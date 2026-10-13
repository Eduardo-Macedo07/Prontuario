# Survivor Browser

Jogo de navegador no estilo *roguelite* com visão de cima (inspirado em Megabonk e Vampire Survivors).
Sobreviva às hordas, colete gemas de XP, suba de nível e escolha recompensas. Se morrer, começa de novo,
mas as moedas douradas ganhas ficam para comprar personagens, armas, passivas e mais na Loja.

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

## Fases e dificuldades

Escolha a fase antes do personagem. Aos **7 minutos** chega o **chefão final**, e derrotá-lo conclui a fase
(enquanto ele vive, a horda fica ainda mais intensa). **A partida não acaba aí:** o tempo continua e o medidor
de **Ameaça** sobe 1 nível a cada 30 segundos. Cada nível dá aos inimigos +20% de vida e +12% de dano, faz os
chefões atacarem mais rápido e traz mais inimigos; a cada minuto volta um chefão (inclusive o final), cada vez
mais forte. Sobreviva o quanto conseguir. Se quiser enfrentá-lo antes, fique no centro do
**Altar Maior** (o altar roxo com obelisco e cristal, sempre presente no mapa). A vida e o dano dos inimigos
crescem com o tempo (aos 7 minutos têm cerca de 8x a vida do começo).

| Fase | Inimigos | Chefão final |
| --- | --- | --- |
| **Cemitério Sombrio** (floresta) | Esqueletos, múmias, ceifadores, lobisomens, cavaleiros | Ceifador Ancestral: 5 ondas de alma em leque e invoca ceifadores |
| **Vulcão Ardente** (lava) | Slime flamejante (pode deixar o chão em chamas), esqueleto negro (rápido), bombardeiro (para perto de você e explode: saia do círculo), golem de cinzas | Titã de Magma: chuva de meteoros marcados e 3 faixas de fogo |
| **Picos Gelados** (neve) | Iaque das neves (investida), abominável (arremessa bolas de neve), troll gelado (regenera), guarda cristalino (armadura, atira cristais) | Rainha do Gelo: estrela de 6 faixas de gelo e estacas caindo em volta de você |

Depois de vencer o chefão final aparece um **portal** para a dificuldade seguinte da mesma fase: fique dentro
dele e você muda de dificuldade na hora, **mantendo armas, passivas, bênçãos e nível**. O relógio do chefão
final recomeça (7 minutos ou Altar Maior).

Cada dificuldade muda a cara da fase: **Normal** com as cores originais e a música de sempre; **Difícil** com
tudo puxado para o roxo, mais névoa, almas subindo e uma música lenta e sombria (órgão, sino e batida de
coração); **Pesadelo** em vermelho sangue, cinzas caindo e rock pesado com guitarra distorcida e bumbo duplo.

Cada fase tem 3 dificuldades: **Normal**, **Difícil** (1,6x vida, 1,35x dano, mais inimigos, 1,6x chance de moedas) e
**Pesadelo** (2,5x vida, 1,75x dano, 2,4x chance de moedas). Vencer uma dificuldade libera a seguinte; vencer o Normal
libera a próxima fase.

## Progressão

- **Espaços:** cada partida começa com 3 espaços de arma (a inicial + 2) e 2 de passiva.
  A Loja libera até 5 de arma e 4 de passiva.
- **Subir de nível:** armas e passivas aparecem misturadas e aleatórias. Cada arma tem **10 níveis** e cada
  passiva 5 (Projéteis, 3). A **raridade da carta multiplica o bônus** daquele nível:
  Comum 1×, Raro 1,67×, Épico 2,67×, Lendário 3,83× (ex.: Chance de Crítico +6% / +10% / +16% / +23%).
  Cartas de **arma** raras ainda trazem **bônus extras** de outros atributos da arma: Raro +1, Épico +2,
  Lendário +3.
  Projéteis usa 1 / 1,5 / 2 / 4, e as frações somam até virar um projétil inteiro.
- **Sorte:** aumenta a chance das raridades altas (sorte 0: 82% comum e 0,5% lendário; sorte 5: 48% comum
  e 6% lendário) e às vezes dá uma 4ª opção.
- **Fogueiras:** fique perto para escolher 1 de 3 bênçãos (não ocupam espaço). Elas vão de fraca a lendária,
  e quanto mais Sorte, mais fortes.
- **Altares:** invocam um chefão, que aparece 2 segundos depois (dá tempo de se posicionar). Todo chefão
  deixa um baú com recompensas raras.
- **Corações e ímãs:** corações caem raramente dos inimigos; o **ímã** é bem mais raro e puxa todo o XP do
  mapa de uma vez.
- **Moeda dourada (única moeda do jogo):** rara e grande, com um facho de luz para ser vista de longe.
  Cai dos chefões (1; o chefão final dá 2 + 1 por dificuldade), às vezes dos mini-chefes e muito raramente
  dos inimigos comuns. Uma partida completa rende umas 9; uma muito boa, umas 14. Dificuldade alta, Sorte e a
  bênção Ganância aumentam a chance. Desafios também dão moedas.
- **Sem limite de nível do personagem.** O limite é das cartas: cada arma vai até o nível 10 e cada passiva
  até o 5 (Projéteis, 3). Com tudo no máximo, as cartas viram cura ou +5% de dano.
- **Alcance:** cada arma só ataca quando há um inimigo dentro do alcance dela.

## Loja

Uma loja só, tudo em moedas douradas. O que é mais forte custa mais.

| Item | Preço | Objetivo |
| --- | --- | --- |
| Maníaco / Golem de Pedra / Mercenário / Berserker | 6 / 9 / 11 / 14 | — / 1 chefão / nível 12 / concluir o Cemitério |
| Armas: Aura Sagrada, Bumerangue, Bola de Fogo, Bombardeio, Raio em Cadeia, Chuva de Meteoros | 3, 4, 7, 7, 8, 9 | — |
| Passivas: Regeneração, Sabedoria, Vampirismo, Dano Crítico, Projéteis | 2, 3, 5, 7, 12 | — |
| Pular (pula a escolha) | 2, 3, 4, 6, 8 (5 níveis) | alcançar o nível 8 |
| Atualizar (troca as opções) | 3, 4, 6, 8, 10 (5 níveis) | sobreviver 3 minutos |
| Banir (remove uma arma ou passiva da partida) | 4, 6, 8, 10, 12 (5 níveis) | derrotar 1 chefão |
| Espaço de arma (4º / 5º) | 5 / 12 | sobreviver 5 min / 3 chefões no total |
| Espaço de passiva (3º / 4º) | 4 / 10 | nível 15 / sobreviver 7 min |

As opções de nível ficam com cadeado até cumprir o objetivo. Cada nível comprado dá +1 uso por partida e o
próximo nível fica mais caro. Na tela de subir de nível, os botões **Atualizar** (tecla `R`), **Banir** (clique
em Banir e depois na carta) e **Pular** aparecem depois de comprados.

## Desafios

Cada desafio concluído dá moedas douradas na hora.

| Desafio | Moedas |
| --- | --- |
| Intocável: sobreviver 2 minutos seguidos sem levar dano | 2 |
| Massacre: derrotar 2.000 inimigos no total | 3 |
| Fúria: derrotar 500 inimigos numa partida | 2 |
| Sobrevivente: sobreviver 7 minutos | 3 |
| Veterano: alcançar o nível 20 | 2 |
| Caçador de Elites: derrotar 15 mini-chefes | 2 |
| Mata-Gigantes: derrotar o Rei Ogro em menos de 30 s | 3 |
| Desviador: derrotar o Robô sem levar míssil | 2 |
| Caça-Lich: derrotar o Lich em menos de 40 s | 3 |
| Trinca de Chefões: 3 chefões numa partida | 3 |
| Lendário: escolher uma carta lendária | 1 |
| Mestre de Armas: levar uma arma ao nível 10 | 2 |
| Concluir o Cemitério / o Vulcão / os Picos Gelados | 3 / 3 / 4 |
| Concluir qualquer fase no Pesadelo | 5 |

## Inimigos

Todos andam um pouco mais devagar que o seu personagem.

- **Esqueleto** (com espada e escudo) e **Cavaleiro Esqueleto** (armadura, elmo com pluma, mais resistente)
- **Múmia**: lenta e resistente
- **Ceifador**: fantasma de manto e foice que flutua em zigue-zague
- **Lobisomem**: agacha (aviso) e dá um bote rápido
- **Mini-chefes**: a cada 15 inimigos nasce um elite (coroa e brilho dourado), maior, com 5x a vida e
  recompensas melhores
- **Chefões** (revezam, com pouca vida mas ataques perigosos e sempre avisados no chão):
  - **Robô Destruidor**: marca áreas vermelhas e lança mísseis; saia da marca
  - **Rei Ogro**: para, marca uma faixa na sua direção e solta uma onda de choque por ela (depois, três em leque)
  - **Lich**: marca 3 colunas na sua direção e ateia fogo nelas; saia ou fique no vão entre elas.
    Também invoca esqueletos

## Personagens

| Personagem | Características | Passiva |
| --- | --- | --- |
| **Rei Gelado** (mago, padrão) | Equilibrado, começa com Estilhaço de Gelo | +1 de Sorte a cada chefão derrotado |
| **Maníaco** (bobo da corte) | Muito rápido e frágil, começa com Facas | +1% de crítico a cada nível |
| **Golem de Pedra** | Muita vida e armadura, lento, começa com Tremor | Mais dano quanto menor a vida (até +120%) |
| **Mercenário** | Ágil, começa com a Metralhadora (balas que ricocheteiam) | +10% de dano a cada chefão derrotado |
| **Berserker** (bárbaro) | Resistente e lento, começa com o Espadão (giro de dano altíssimo) | Cada nível aumenta em 5% toda a cura |

## Passivas

Vida Máxima, Velocidade de Movimento, Dano, Velocidade de Ataque, Alcance de Coleta, Regeneração, Armadura,
Projéteis, Chance de Crítico, Área e Sorte. Compradas na Loja: Regeneração, Sabedoria, Vampirismo, Dano
Crítico e Projéteis.

## Arsenal (cada arma até o nível 10)

Estilhaço de Gelo, Arco Caçador (flechas teleguiadas que perfuram), Facas (teleguiadas), Raio em Cadeia
(ricocheteia), Bola de Fogo (explosão em área), Lâminas Orbitais (reduzem o dano recebido), Aura Sagrada e
Tremor de Pedra. Também: Metralhadora e Espadão. Compradas na Loja: Aura Sagrada, Bumerangue, Bola de
Fogo, Bombardeio, Raio em Cadeia e Chuva de Meteoros.

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
