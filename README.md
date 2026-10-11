# Jogo Teste

Jogo de navegador no estilo *roguelite* com visão de cima (inspirado em Megabonk e Vampire Survivors).
Sobreviva às hordas, colete gemas de XP, suba de nível e escolha recompensas. Se morrer, começa de novo.

## Como jogar

Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox no PC). Não precisa instalar nada.

| Tecla | Ação |
| --- | --- |
| `W` `A` `S` `D` ou setas | Mover |
| `1` `2` `3` `4` ou clique | Escolher personagem (no menu) e recompensa |
| `Esc` ou `P` | Pausar (mostra seus atributos) |
| `R` | Recomeçar depois de morrer |

Os ataques são automáticos.

## Personagens

| Personagem | Características | Passiva |
| --- | --- | --- |
| **Mago** (padrão) | Equilibrado, começa com Míssil Arcano | +1 de Sorte a cada chefão derrotado |
| **Maníaco** | Muito rápido e frágil, começa com Facas | +1% de crítico a cada nível |
| **Golem de Pedra** | Muita vida e armadura, lento, começa com Tremor | Mais dano quanto menor a vida (até +120%) |

## Arsenal (até 6 armas, cada uma até o nível 6)

- **Míssil Arcano**: dispara no inimigo mais próximo.
- **Arco Caçador**: flechas teleguiadas que perfuram e seguem para os inimigos de trás.
- **Facas**: arremessadas na direção em que você anda.
- **Raio em Cadeia**: ricocheteia de inimigo em inimigo.
- **Bola de Fogo**: explode em área; no nível 6 deixa o chão em chamas.
- **Lâminas Orbitais**: giram ao seu redor e reduzem 6% do dano recebido por nível (até 36%).
- **Aura Sagrada**: fere inimigos próximos.
- **Tremor de Pedra**: onda de choque que empurra.

## Passivas

Vitalidade, Botas Ágeis, Força, Pressa, Ímã, Regeneração, Armadura, **Projéteis** (+1 projétil em todas as armas),
**Precisão** (chance de crítico), **Área de Acerto** (aumenta aura, explosões, lâminas e ondas) e **Sorte**.

**Sorte** aumenta a chance de recompensas raras (+2 níveis de uma vez) e épicas (+3), a chance de aparecer uma
4ª opção e a chance de cair coração dos inimigos.

## Mapa

- **Totens**: fique parado no círculo para ganhar um buff (Fúria, Vento, Vida, Ímã ou Sorte).
- **Altares**: fique parado no altar para invocar um chefão.
- Setas na borda da tela apontam para totens e altares fora de vista.
- Todo chefão derrotado deixa um **baú** com recompensas raras garantidas.
- Enxames a cada 50 segundos e um chefão a cada 3 minutos (Rei Ogro ou Lich, que invoca esqueletos).

## Estrutura

```
index.html   telas (menu, HUD, recompensas, pausa, fim de jogo)
style.css    visual das telas
js/game.js   todo o jogo (laço, armas, inimigos, estruturas, desenho no canvas)
```
