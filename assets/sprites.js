// Arte em imagens (opcional).
//
// Para trocar o desenho de algo por uma imagem, coloque o PNG em assets/sprites/
// e tire o "//" da linha correspondente abaixo. Tudo que não estiver listado
// continua com o desenho feito por código. Veja assets/LEIA-ME.md.
//
// file:    nome do arquivo dentro de assets/sprites/
// frames:  quantos quadros de animação lado a lado (1 se for imagem parada)
// fps:     velocidade da animação
// scale:   aumenta ou diminui a imagem no jogo (opcional; 1 = tamanho do modelo)
// anchorY: altura do ponto de apoio, de 0 (topo) a 1 (base) da imagem (opcional)

window.SPRITES = {
  // ---------- Personagens ----------
  // mago:     { file: 'mago.png', frames: 4, fps: 8 },
  // maniaco:  { file: 'maniaco.png', frames: 4, fps: 10 },
  // golem:    { file: 'golem.png', frames: 4, fps: 6 },

  // ---------- Inimigos ----------
  // skeleton:   { file: 'esqueleto.png', frames: 4, fps: 8 },
  // skelknight: { file: 'cavaleiro.png', frames: 4, fps: 6 },
  // mummy:      { file: 'mumia.png', frames: 4, fps: 5 },
  // ghost:      { file: 'ceifador.png', frames: 4, fps: 6 },
  // werewolf:   { file: 'lobisomem.png', frames: 4, fps: 10 },
  // robo:       { file: 'robo.png', frames: 4, fps: 6 },
  // boss:       { file: 'rei-ogro.png', frames: 4, fps: 6 },
  // lich:       { file: 'lich.png', frames: 4, fps: 6 },

  // ---------- Cenário ----------
  // tomb:     { file: 'lapide.png' },
  // cross:    { file: 'cruz.png' },
  // tree:     { file: 'arvore.png' },
  // deadtree: { file: 'arvore-seca.png' },
  // fence:    { file: 'cerca.png' },
  // lantern:  { file: 'lanterna.png' },
  // candles:  { file: 'velas.png' },
  // pumpkin:  { file: 'abobora.png' },
  // skulls:   { file: 'cranios.png' },
  // rock:     { file: 'pedra.png' },
};
