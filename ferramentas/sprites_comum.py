"""Lista de sprites do jogo, usada pelas ferramentas de PDF."""

# código no PDF / nome do arquivo -> (id no jogo, nome amigável, tipo, quadros, tamanho do quadro em px)
SPRITES = [
    ("mago", "mago", "Rei Gelado", "personagem", 4, (160, 160)),
    ("maniaco", "maniaco", "Maníaco", "personagem", 4, (160, 160)),
    ("golem", "golem", "Golem de Pedra", "personagem", 4, (160, 160)),
    ("esqueleto", "skeleton", "Esqueleto", "inimigo", 4, (72, 72)),
    ("cavaleiro", "skelknight", "Cavaleiro Esqueleto", "inimigo", 4, (102, 102)),
    ("mumia", "mummy", "Múmia", "inimigo", 4, (84, 84)),
    ("ceifador", "ghost", "Ceifador", "inimigo", 4, (66, 66)),
    ("lobisomem", "werewolf", "Lobisomem", "inimigo", 4, (90, 90)),
    ("robo", "robo", "Robô Destruidor", "chefão", 4, (252, 252)),
    ("rei-ogro", "boss", "Rei Ogro", "chefão", 4, (240, 240)),
    ("lich", "lich", "Lich", "chefão", 4, (204, 204)),
    ("lapide", "tomb", "Lápide", "cenário", 1, (160, 170)),
    ("cruz", "cross", "Cruz", "cenário", 1, (160, 170)),
    ("arvore-seca", "deadtree", "Árvore seca", "cenário", 1, (160, 170)),
    ("arvore", "tree", "Árvore", "cenário", 1, (160, 170)),
    ("cerca", "fence", "Cerca", "cenário", 1, (160, 170)),
    ("lanterna", "lantern", "Lanterna", "cenário", 1, (160, 170)),
    ("velas", "candles", "Velas", "cenário", 1, (160, 170)),
    ("abobora", "pumpkin", "Abóbora", "cenário", 1, (160, 170)),
    ("cranios", "skulls", "Crânios", "cenário", 1, (160, 170)),
    ("pedra", "rock", "Pedra", "cenário", 1, (160, 170)),
]

# Para achar o código no título da página, os mais longos primeiro ("arvore-seca" antes de "arvore").
CODES_BY_LENGTH = sorted(SPRITES, key=lambda s: -len(s[0]))
