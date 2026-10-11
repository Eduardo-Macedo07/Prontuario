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
- **Subir de nível:** armas e passivas aparecem misturadas e aleatórias. A Sorte faz cartas raras (+2 níveis)
  e épicas (+3) aparecerem mais, e às vezes dá uma 4ª opção.
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

## Personagens

| Personagem | Características | Passiva |
| --- | --- | --- |
| **Rei Gelado** (mago, padrão) | Equilibrado, começa com Estilhaço de Gelo | +1 de Sorte a cada chefão derrotado |
| **Maníaco** (bobo da corte) | Muito rápido e frágil, começa com Facas | +1% de crítico a cada nível |
| **Golem de Pedra** | Muita vida e armadura, lento, começa com Tremor | Mais dano quanto menor a vida (até +120%) |

## Arsenal (cada arma até o nível 6)

Estilhaço de Gelo, Arco Caçador (flechas teleguiadas que perfuram), Facas (teleguiadas), Raio em Cadeia
(ricocheteia), Bola de Fogo (explosão em área), Lâminas Orbitais (reduzem o dano recebido), Aura Sagrada e
Tremor de Pedra.

## Configurações

Qualidade gráfica (automática, alta ou baixa), tremor de tela, números de dano e apagar progresso.
O progresso fica salvo no navegador.

## Estrutura

```
index.html   telas (inicial, personagens, loja, configurações, HUD, recompensas, pausa, fim de jogo)
style.css    visual das telas
js/art.js    desenhos: personagens, inimigos, fogueiras, altar, itens, chão e ícones
js/game.js   lógica do jogo (laço, armas, inimigos, loja, progresso, efeitos e interface)
```
