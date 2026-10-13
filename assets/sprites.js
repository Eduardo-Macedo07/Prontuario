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
  mago:     { file: 'mago.png', frames: 4, fps: 8, scale: 1.013, anchorY: 0.888 },
  maniaco:  { file: 'maniaco.png', frames: 4, fps: 10, scale: 1.069, anchorY: 0.891 },
  golem:    { file: 'golem.png', frames: 4, fps: 6, scale: 0.789, anchorY: 0.874 },
  mercenario: { file: 'mercenario.png', frames: 4, fps: 9, scale: 0.997, anchorY: 0.891 },
  berserker:  { file: 'berserker.png', frames: 4, fps: 7, scale: 1.1, anchorY: 0.891 },
  // arqueira:   { file: 'arqueira.png', frames: 4, fps: 9 },
  // necromante: { file: 'necromante.png', frames: 4, fps: 7 },

  // ---------- Inimigos ----------
  skeleton:   { file: 'esqueleto.png', frames: 4, fps: 8, scale: 0.61, anchorY: 0.609 },
  skelknight: { file: 'cavaleiro.png', frames: 4, fps: 6, scale: 0.67, anchorY: 0.636 },
  mummy:      { file: 'mumia.png', frames: 4, fps: 5, scale: 0.551, anchorY: 0.578 },
  ghost:      { file: 'ceifador.png', frames: 4, fps: 6, scale: 0.786, anchorY: 0.695 },
  werewolf:   { file: 'lobisomem.png', frames: 4, fps: 10, scale: 0.623, anchorY: 0.609 },
  robo:       { file: 'robo.png', frames: 4, fps: 6, scale: 0.557, anchorY: 0.572 },
  boss:       { file: 'rei-ogro.png', frames: 4, fps: 6, scale: 0.535, anchorY: 0.556 },
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
