# Arte em imagens

Hoje tudo no jogo é desenhado por código. Qualquer personagem, inimigo ou objeto do cenário
pode ser trocado por uma imagem PNG, sem mexer no código.

## Enviando por PDF

O jeito mais fácil: use o [`modelo-sprites.pdf`](modelo-sprites.pdf) (uma página por sprite, com a arte atual
como referência e as regras na capa). Monte um PDF igual, com a sua imagem PNG transparente em cada página
e o código do sprite no começo do título. Depois rode:

```
python3 ferramentas/pdf_para_sprites.py seu-arquivo.pdf
```

A ferramenta salva cada imagem em `assets/sprites/` e ativa a linha certa em `assets/sprites.js`.
Para refazer o modelo depois de mudar a arte: `python3 ferramentas/gerar_pdf_modelo.py`.

## Passo a passo (sem PDF)

1. Abra o modelo correspondente em `assets/modelos/` (ex.: `mago.png`).
2. Desenhe a sua versão **no mesmo tamanho de imagem**, com fundo transparente, por cima do modelo
   ou usando ele de referência. Mantenha o personagem no mesmo lugar dentro de cada quadro
   (os pés na mesma altura) e olhando para a **direita** (o jogo espelha sozinho).
3. Salve em `assets/sprites/` (ex.: `assets/sprites/mago.png`).
4. Em `assets/sprites.js`, apague o `//` do começo da linha desse item.
5. Recarregue o jogo. O que não estiver na lista continua com o desenho por código.

## Formato

| Tipo | Quadros | Tamanho de cada quadro |
| --- | --- | --- |
| Personagens (mago, maniaco, golem, mercenario, berserker) | 4, lado a lado (ciclo de caminhada) | 160 × 160 |
| Inimigos | 4, lado a lado | o mesmo do modelo (varia com o tamanho do inimigo) |
| Objetos do cenário | 1 | 160 × 170 |

- Visão de cima em 3/4 (vemos o topo da cabeça e a frente do corpo), como os desenhos atuais.
- O quadro 1 é usado com o personagem parado; os 4 em sequência, andando.
- Se a imagem ficar grande ou pequena demais no jogo, ajuste `scale` no `sprites.js`
  (ex.: `scale: 1.2`).

## Como conseguir a arte

- **Ferramentas de IA de imagem** (ex.: PixelLab, Scenario, Leonardo, Midjourney): peça
  "top-down 3/4 view, cartoon, thick dark outline, transparent background, sprite sheet,
  4 walking frames" junto com a descrição do personagem, e ajuste o resultado ao tamanho do modelo.
- **Artistas** (itch.io, Fiverr, ArtStation): envie o modelo e esta página.
- **Pacotes gratuitos** (Kenney.nl, OpenGameArt): confira a licença antes de usar
  (CC0 pode ser usado livremente).

> Ao abrir o `index.html` direto do computador, alguns navegadores bloqueiam a leitura das imagens
> para os ícones da loja; nesse caso a loja mostra o desenho por código. Pelo link do GitHub Pages
> funciona normalmente.
