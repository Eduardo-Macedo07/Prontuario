# Jogo Teste

Jogo de navegador no estilo *roguelite* com visão de cima (inspirado em Megabonk e Vampire Survivors).
Sobreviva às hordas, colete gemas de XP, suba de nível e escolha recompensas. Se morrer, começa de novo.

## Como jogar

Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox no PC). Não precisa instalar nada.

| Tecla | Ação |
| --- | --- |
| `W` `A` `S` `D` ou setas | Mover |
| `1` `2` `3` ou clique | Escolher recompensa ao subir de nível |
| `Esc` ou `P` | Pausar |
| `R` | Recomeçar depois de morrer |

Os ataques são automáticos.

## Conteúdo

- **5 armas** (até nível 6): Míssil Arcano, Lâminas Orbitais, Aura Sagrada, Explosão de Fogo e Raio.
- **10 passivas**: Vitalidade, Botas Ágeis, Força, Pressa, Ímã, Regeneração, Armadura, Amplitude, Duplicador e Sorte.
- **Inimigos**: gosmas, morcegos, esqueletos e brutos, que ficam mais fortes com o tempo.
- **Enxames** a cada 50 segundos e um **chefe** a cada 3 minutos.
- O recorde de tempo fica salvo no navegador.

## Estrutura

```
index.html   telas (menu, HUD, subir de nível, pausa, fim de jogo)
style.css    visual das telas
js/game.js   todo o jogo (laço, armas, inimigos, desenho no canvas)
```
