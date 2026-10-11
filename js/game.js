'use strict';

(() => {
  // ============================================================
  // Configuração do canvas
  // ============================================================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  // W e H são o tamanho da área visível do mundo. Em telas pequenas (celular) a câmera
  // se afasta (zoom < 1) para o jogador continuar enxergando a horda chegando.
  let W = 0;
  let H = 0;
  let zoom = 1;
  let lowQuality = false;
  const isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  document.body.classList.toggle('touch', isTouch);

  function resize() {
    const maxDpr = lowQuality ? 1 : isTouch ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    zoom = Math.max(0.6, Math.min(1, Math.min(sw, sh) / 700));
    W = sw / zoom;
    H = sh / zoom;
    canvas.width = Math.floor(sw * dpr);
    canvas.height = Math.floor(sh * dpr);
    canvas.style.width = sw + 'px';
    canvas.style.height = sh + 'px';
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ============================================================
  // Utilidades
  // ============================================================
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const FONT = '"Nunito", "Segoe UI", sans-serif';
  const TITLE_FONT = '"Cinzel", Georgia, serif';
  const pct = (v) => Math.round(v * 100) + '%';

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  // ============================================================
  // Progresso salvo no navegador (moedas, compras, recordes e configurações)
  // ============================================================
  const SAVE_KEY = 'survivorbrowser.save';

  function defaultSave() {
    return {
      coins: 0,
      chars: { mago: true, maniaco: false, golem: false },
      bought: {},
      char: 'mago',
      stats: { bestTime: 0, bestLevel: 0, bestKills: 0, bosses: 0, kills: 0, runs: 0 },
      settings: { quality: 'auto', shake: true, numbers: true, music: 0.6, sfx: 0.8 },
    };
  }

  function merge(base, raw) {
    for (const k in raw) {
      if (base[k] && typeof base[k] === 'object' && raw[k] && typeof raw[k] === 'object') merge(base[k], raw[k]);
      else base[k] = raw[k];
    }
    return base;
  }

  function loadSave() {
    const s = defaultSave();
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (raw) return merge(s, raw);
      // traz o recorde da versão antiga do jogo
      const old = JSON.parse(localStorage.getItem('jogoteste.recorde'));
      if (old) {
        s.stats.bestTime = old.time || 0;
        s.stats.bestLevel = old.level || 0;
        s.stats.bestKills = old.kills || 0;
      }
    } catch (e) {
      // armazenamento indisponível: começa do zero
    }
    return s;
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      // sem armazenamento: o progresso vale só nesta sessão
    }
  }

  let save = loadSave();

  // ============================================================
  // Personagens
  // ============================================================
  const CHARACTERS = {
    mago: {
      name: 'Rei Gelado', title: 'O mago', r: 14,
      hp: 100, speed: 190, armor: 0, regen: 0, crit: 0.05, luck: 0,
      weapon: 'missil', theme: ['#1d3a66', '#07101f'], accent: '#5fe8ff',
      bars: { vida: 0.45, velocidade: 0.6, defesa: 0.3 },
      desc: 'Equilibrado. Começa com o Estilhaço de Gelo.',
      passive: 'Ganha +1 de Sorte a cada chefão derrotado.',
    },
    maniaco: {
      name: 'Maníaco', title: 'O bobo da corte', r: 13,
      hp: 75, speed: 255, armor: 0, regen: 0, crit: 0.1, luck: 0,
      weapon: 'facas', theme: ['#5a1430', '#14060c'], accent: '#ff4f6a',
      bars: { vida: 0.3, velocidade: 1, defesa: 0.15 },
      desc: 'Muito ágil e frágil. Começa com as Facas.',
      passive: 'Ganha +1% de chance de crítico a cada nível.',
    },
    golem: {
      name: 'Golem de Pedra', title: 'O colosso', r: 18,
      hp: 240, speed: 135, armor: 3, regen: 0.5, crit: 0.05, luck: 0,
      weapon: 'tremor', theme: ['#5a2a10', '#140a05'], accent: '#ff8a2a',
      bars: { vida: 1, velocidade: 0.3, defesa: 0.9 },
      desc: 'Extremamente resistente, mas lento. Começa com o Tremor.',
      passive: 'Causa mais dano quanto menor a vida (até +120%).',
    },
  };

  // ============================================================
  // Loja: personagens e espaços extras, com objetivos para liberar
  // ============================================================
  const SHOP = [
    { id: 'maniaco', kind: 'char', name: 'Maníaco', price: 250, desc: 'Desbloqueia o bobo da corte psicopata.' },
    { id: 'golem', kind: 'char', name: 'Golem de Pedra', price: 400, desc: 'Desbloqueia o colosso de pedra.', req: { type: 'bosses', n: 1, text: 'Derrote 1 chefão' } },
    { id: 'wslot1', kind: 'wslot', name: 'Espaço de arma', price: 200, desc: '+1 espaço de arma (4 no total).', req: { type: 'time', n: 300, text: 'Sobreviva 5 minutos' } },
    { id: 'wslot2', kind: 'wslot', name: 'Espaço de arma', price: 600, desc: '+1 espaço de arma (5 no total).', req: { type: 'bosses', n: 3, text: 'Derrote 3 chefões no total' }, needs: 'wslot1' },
    { id: 'pslot1', kind: 'pslot', name: 'Espaço de passiva', price: 150, desc: '+1 espaço de passiva (3 no total).', req: { type: 'level', n: 15, text: 'Alcance o nível 15' } },
    { id: 'pslot2', kind: 'pslot', name: 'Espaço de passiva', price: 500, desc: '+1 espaço de passiva (4 no total).', req: { type: 'time', n: 600, text: 'Sobreviva 10 minutos' }, needs: 'pslot1' },
  ];

  const BASE_WEAPON_SLOTS = 3; // a arma inicial + 2
  const BASE_PASSIVE_SLOTS = 2;
  const MAX_WEAPON_SLOTS = 5;
  const MAX_PASSIVE_SLOTS = 4;
  const weaponSlots = () => BASE_WEAPON_SLOTS + (save.bought.wslot1 ? 1 : 0) + (save.bought.wslot2 ? 1 : 0);
  const passiveSlots = () => BASE_PASSIVE_SLOTS + (save.bought.pslot1 ? 1 : 0) + (save.bought.pslot2 ? 1 : 0);

  function reqMet(r) {
    if (!r) return true;
    const st = save.stats;
    if (r.type === 'time') return st.bestTime >= r.n;
    if (r.type === 'bosses') return st.bosses >= r.n;
    if (r.type === 'level') return st.bestLevel >= r.n;
    return true;
  }

  function reqProgress(r) {
    const st = save.stats;
    if (r.type === 'time') return `${fmtTime(Math.min(st.bestTime, r.n))} / ${fmtTime(r.n)}`;
    if (r.type === 'bosses') return `${Math.min(st.bosses, r.n)} / ${r.n}`;
    return `${Math.min(st.bestLevel, r.n)} / ${r.n}`;
  }

  // ============================================================
  // Armas
  // ============================================================
  const WEAPONS = {
    missil: {
      name: 'Estilhaço de Gelo', color: '#5fe8ff', max: 6,
      desc: [
        'Dispara no inimigo mais próximo.',
        '+1 projétil.',
        '+Dano e dispara mais rápido.',
        '+1 projétil.',
        'Projéteis atravessam 2 inimigos.',
        '+1 projétil e +dano.',
      ],
    },
    arco: {
      name: 'Arco Caçador', color: '#d69a52', max: 6,
      desc: [
        'Flechas teleguiadas que perfuram e seguem para o inimigo de trás.',
        '+1 flecha.',
        '+1 perfuração e atira mais rápido.',
        '+1 flecha.',
        '+2 perfurações.',
        '+1 flecha e +dano.',
      ],
    },
    facas: {
      name: 'Facas', color: '#d8e0ea', max: 6,
      desc: [
        'Arremessa facas no inimigo mais próximo.',
        '+1 faca.',
        'Arremessa mais rápido.',
        '+1 faca.',
        'Facas perfuram 1 inimigo.',
        '+1 faca e +dano.',
      ],
    },
    raio: {
      name: 'Raio em Cadeia', color: '#ffd23f', max: 6,
      desc: [
        'Raio que ricocheteia entre 3 inimigos.',
        '+1 ricochete.',
        '+1 ricochete e +dano.',
        '+1 ricochete.',
        '+1 ricochete e recarrega mais rápido.',
        '+1 raio extra e +1 ricochete.',
      ],
    },
    fogo: {
      name: 'Bola de Fogo', color: '#ff7a1a', max: 6,
      desc: [
        'Bola de fogo que explode em área.',
        '+Raio da explosão.',
        'Recarrega mais rápido.',
        '+1 bola de fogo.',
        '+Raio e +dano.',
        'Deixa o chão em chamas.',
      ],
    },
    laminas: {
      name: 'Lâminas Orbitais', color: '#c9d6e6', max: 6,
      desc: [
        'Lâminas giram ao seu redor e reduzem 6% do dano recebido.',
        '+6% de redução de dano.',
        '+1 lâmina e +6% de redução.',
        '+6% de redução e +dano.',
        '+1 lâmina e +6% de redução.',
        '+6% de redução e giram mais rápido.',
      ],
    },
    aura: {
      name: 'Aura Sagrada', color: '#ffe27a', max: 6,
      desc: [
        'Campo que fere inimigos próximos.',
        '+Raio.',
        '+Dano.',
        '+Raio.',
        '+Dano e ritmo.',
        '+Raio e dano.',
      ],
    },
    tremor: {
      name: 'Tremor de Pedra', color: '#c8a878', max: 6,
      desc: [
        'Onda de choque que fere e empurra os inimigos.',
        '+Dano.',
        'Recarrega mais rápido.',
        '+Raio.',
        '+Dano e empurra mais.',
        'Onda dupla.',
      ],
    },
  };

  // ============================================================
  // Passivas (ocupam espaço)
  // ============================================================
  const PASSIVES = {
    vigor: { name: 'Vitalidade', max: 5, desc: '+20 de vida máxima e cura 20.', apply: () => { player.maxHp += 20; heal(20); } },
    boots: { name: 'Botas Ágeis', max: 5, desc: '+10% de velocidade.', apply: () => { player.speed *= 1.1; } },
    might: { name: 'Força', max: 5, desc: '+15% de dano.', apply: () => { player.dmgMul += 0.15; } },
    haste: { name: 'Pressa', max: 5, desc: 'Armas recarregam 8% mais rápido.', apply: () => { player.cdMul *= 0.92; } },
    magnet: { name: 'Ímã', max: 5, desc: '+35% de alcance para coletar XP.', apply: () => { player.magnet *= 1.35; } },
    regen: { name: 'Regeneração', max: 5, desc: '+0,6 de vida por segundo.', apply: () => { player.regen += 0.6; } },
    armor: { name: 'Armadura', max: 5, desc: '-1 de dano recebido por golpe.', apply: () => { player.armor += 1; } },
    multi: { name: 'Projéteis', max: 3, desc: '+1 projétil, flecha, faca, lâmina, raio e bola de fogo.', apply: () => { player.extraProj += 1; } },
    precisao: { name: 'Precisão', max: 5, desc: '+6% de chance de dano crítico (dano x2).', apply: () => { player.crit += 0.06; } },
    area: { name: 'Área de Acerto', max: 5, desc: '+12% de área (aura, explosões, lâminas, ondas).', apply: () => { player.areaMul += 0.12; } },
    sorte: { name: 'Sorte', max: 5, desc: '+1 de Sorte: cartas de nível mais alto, mais opções e mais itens.', apply: () => { player.luck += 1; } },
  };

  // ============================================================
  // Bênçãos das fogueiras (não ocupam espaço; força depende da sorte)
  // ============================================================
  const BONFIRE_COLOR = '#ff8a2a';

  const BOONS = {
    dano: { name: 'Fúria Ancestral', icon: 'might', base: 0.08, text: (v) => `+${pct(v)} de dano`, apply: (v) => { player.dmgMul += v; } },
    recarga: { name: 'Ritmo de Batalha', icon: 'haste', base: 0.05, text: (v) => `Armas ${pct(v)} mais rápidas`, apply: (v) => { player.cdMul *= 1 - v; } },
    vida: { name: 'Coração de Brasa', icon: 'vigor', base: 15, text: (v) => `+${Math.round(v)} de vida máxima`, apply: (v) => { player.maxHp += Math.round(v); heal(Math.round(v)); } },
    area: { name: 'Chama Expansiva', icon: 'area', base: 0.07, text: (v) => `+${pct(v)} de área`, apply: (v) => { player.areaMul += v; } },
    critico: { name: 'Olho do Caçador', icon: 'precisao', base: 0.03, text: (v) => `+${pct(v)} de crítico`, apply: (v) => { player.crit += v; } },
    velocidade: { name: 'Passos Leves', icon: 'boots', base: 0.05, text: (v) => `+${pct(v)} de velocidade`, apply: (v) => { player.speed *= 1 + v; } },
    regen: { name: 'Brasas Vivas', icon: 'regen', base: 0.3, text: (v) => `+${v.toFixed(1).replace('.', ',')} de vida por segundo`, apply: (v) => { player.regen += v; } },
    xp: { name: 'Sabedoria', icon: 'xp', base: 0.08, text: (v) => `+${pct(v)} de XP ganho`, apply: (v) => { player.xpMul += v; } },
    ima: { name: 'Atração', icon: 'magnet', base: 0.15, text: (v) => `+${pct(v)} de alcance do ímã`, apply: (v) => { player.magnet *= 1 + v; } },
    moedas: { name: 'Ganância', icon: 'coin', base: 0.15, text: (v) => `+${pct(v)} de moedas`, apply: (v) => { player.coinMul += v; } },
    armadura: { name: 'Pele de Pedra', icon: 'armor', base: 0.6, text: (v) => `+${v.toFixed(1).replace('.', ',')} de armadura`, apply: (v) => { player.armor += v; } },
    sorte: { name: 'Bênção da Sorte', icon: 'sorte', base: 0.5, text: (v) => `+${v.toFixed(1).replace('.', ',')} de Sorte`, apply: (v) => { player.luck += v; } },
  };

  const TIERS = [
    { name: 'Fraca', mul: 0.6, cls: 'weak' },
    { name: 'Comum', mul: 1, cls: '' },
    { name: 'Rara', mul: 1.7, cls: 'rare' },
    { name: 'Épica', mul: 2.6, cls: 'epic' },
    { name: 'Lendária', mul: 4, cls: 'legend' },
  ];

  function rollTier() {
    const L = effLuck();
    const weights = [Math.max(4, 30 - L * 6), 45, 15 + L * 4, 5 + L * 2.5, 1 + L * 1.2];
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return 1;
  }

  // ============================================================
  // Inimigos
  // ============================================================
  // speed é uma fração da velocidade base do personagem: os inimigos andam
  // um pouco mais devagar que você (o lobisomem só passa disso no bote).
  const ENEMY_TYPES = {
    skeleton: { name: 'Esqueleto', r: 12, hp: 16, speed: 0.78, dmg: 8, xp: 1, color: '#e8e2cf' },
    ghost: { name: 'Ceifador', r: 11, hp: 11, speed: 0.88, dmg: 6, xp: 1, color: '#7fd8ff' },
    mummy: { name: 'Múmia', r: 14, hp: 42, speed: 0.55, dmg: 12, xp: 2, color: '#d8c9a3' },
    werewolf: { name: 'Lobisomem', r: 15, hp: 36, speed: 0.74, dmg: 14, xp: 2, color: '#8a7a6a' },
    skelknight: { name: 'Cavaleiro Esqueleto', r: 17, hp: 120, speed: 0.6, dmg: 20, xp: 6, color: '#9aa6b4' },
    robo: { name: 'Robô Destruidor', r: 42, hp: 1700, speed: 0.5, dmg: 34, xp: 60, color: '#c3ccd8', boss: true },
    boss: { name: 'Rei Ogro', r: 40, hp: 1600, speed: 0.6, dmg: 35, xp: 60, color: '#c02060', boss: true },
    lich: { name: 'Lich', r: 34, hp: 1250, speed: 0.5, dmg: 30, xp: 60, color: '#4fc7b8', boss: true },
  };
  const BOSS_ORDER = ['robo', 'boss', 'lich'];

  const MAX_ENEMIES = 320;
  const BOSS_INTERVAL = 180;

  // ============================================================
  // Estado do jogo
  // ============================================================
  let state = 'home';
  let inRun = false; // há uma partida em andamento (jogando, pausado ou escolhendo)
  let settingsReturn = 'home';
  let selectedChar = save.chars[save.char] ? save.char : 'mago';
  let player;
  let enemies;
  let projectiles;
  let pickups;
  let particles;
  let texts;
  let rings;
  let chains;
  let explosions;
  let hazards;
  let strikes;
  let structures;
  let weapons;
  let passiveLevels;
  let boonsTaken;
  let time;
  let kills;
  let runCoins;
  let spawnAcc;
  let nextBoss;
  let nextSwarm;
  let bossesSpawned;
  let pendingLevels;
  let pendingChests;
  let pendingShrines;
  let structTimer;
  let shake;
  let hurtFlash;
  let levelFx;
  let trailT;
  let hpGhost;
  let loadoutKey = '';
  let currentChoices = [];
  let bannerTimer = null;

  function resetWorld() {
    const C = CHARACTERS[selectedChar];
    player = {
      char: selectedChar,
      x: 0, y: 0, r: C.r,
      hp: C.hp, maxHp: C.hp,
      speed: C.speed, regen: C.regen, armor: C.armor,
      magnet: 90, dmgMul: 1, cdMul: 1, areaMul: 1, extraProj: 0,
      xpMul: 1, coinMul: 1,
      crit: C.crit, luck: C.luck,
      xp: 0, level: 1, xpNext: xpForLevel(1),
      invuln: 0, facing: 1, dirX: 1, dirY: 0, moving: false, anim: 0,
      bossKills: 0,
    };
    enemies = [];
    projectiles = [];
    pickups = [];
    particles = [];
    texts = [];
    rings = [];
    chains = [];
    explosions = [];
    hazards = [];
    strikes = [];
    structures = [];
    weapons = {};
    passiveLevels = {};
    boonsTaken = {};
    time = 0;
    kills = 0;
    runCoins = 0;
    spawnAcc = 0;
    nextBoss = BOSS_INTERVAL;
    nextSwarm = 50;
    bossesSpawned = 0;
    pendingLevels = 0;
    pendingChests = 0;
    pendingShrines = 0;
    structTimer = 0;
    shake = 0;
    hurtFlash = 0;
    levelFx = 0;
    trailT = 0;
    hpGhost = 1;
    loadoutKey = '';
  }

  function xpForLevel(level) {
    return Math.floor(5 + (level - 1) * 4 + Math.pow(level - 1, 1.6));
  }

  // ---------- Atributos efetivos (com a passiva de cada personagem) ----------
  const golemRage = () => (player.char === 'golem' ? 1 - player.hp / player.maxHp : 0);
  const effDmgMul = () => player.dmgMul * (player.char === 'golem' ? 1 + golemRage() * 1.2 : 1);
  const effCd = () => player.cdMul;
  const effSpeed = () => player.speed;
  const effLuck = () => player.luck;
  const effRegen = () => player.regen;
  const bladeReduction = () => (weapons.laminas ? 0.06 * weapons.laminas.level : 0);

  // ============================================================
  // Configurações
  // ============================================================
  function applySettings() {
    Sound.setVolumes(save.settings.music, save.settings.sfx);
    const forced = save.settings.quality === 'baixa';
    if (forced !== lowQuality || save.settings.quality === 'alta') {
      lowQuality = forced;
      maxParticles = lowQuality ? 300 : 900;
      Art.setLowQuality(lowQuality);
      resize();
    }
  }

  // ============================================================
  // Entrada (teclado, mouse e toque)
  // ============================================================
  const keys = new Set();

  // O som só pode começar depois do primeiro toque ou tecla.
  let audioReady = false;
  const unlockAudio = () => {
    Sound.unlock();
    if (!audioReady) {
      audioReady = true;
      updateMusic();
    }
  };
  window.addEventListener('pointerdown', unlockAudio, true);
  window.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('click', (e) => {
    if (e.target.closest('button')) Sound.play('click');
  });

  function updateMusic() {
    if (state === 'dead') Sound.music('off');
    else if (!inRun) Sound.music('menu');
    else Sound.music(enemies.some((e) => e.boss) ? 'boss' : 'game');
    Sound.duck(inRun && state !== 'playing');
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!e.repeat) onKey(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => {
    keys.clear();
    if (state === 'playing') setState('paused');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') setState('paused');
  });

  // Joystick virtual: encoste o dedo (ou clique e arraste o mouse) em qualquer lugar e arraste.
  const STICK_R = 60;
  const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, used: false };

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing' || stick.active) return;
    e.preventDefault();
    stick.active = true;
    stick.used = true;
    stick.id = e.pointerId;
    stick.ox = stick.x = e.clientX / zoom;
    stick.oy = stick.y = e.clientY / zoom;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!stick.active || e.pointerId !== stick.id) return;
    stick.x = e.clientX / zoom;
    stick.y = e.clientY / zoom;
    // Se o dedo vai além do limite, a base acompanha (não precisa voltar ao centro).
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      stick.ox = stick.x - (dx / d) * STICK_R;
      stick.oy = stick.y - (dy / d) * STICK_R;
    }
  });
  const endStick = (e) => {
    if (e.pointerId !== stick.id) return;
    stick.active = false;
    stick.id = null;
  };
  canvas.addEventListener('pointerup', endStick);
  canvas.addEventListener('pointercancel', endStick);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function onKey(k) {
    if (state === 'home') {
      if (k === 'enter' || k === ' ') setState('chars');
    } else if (state === 'chars') {
      if (k === 'enter' || k === ' ') startGame();
      else if (k === 'escape') setState('home');
      const ids = Object.keys(CHARACTERS);
      const n = Number(k);
      if (n >= 1 && n <= ids.length) selectChar(ids[n - 1]);
    } else if (state === 'shop' && k === 'escape') setState('home');
    else if (state === 'settings' && k === 'escape') setState(settingsReturn);
    else if (state === 'playing' && (k === 'escape' || k === 'p')) setState('paused');
    else if (state === 'paused' && (k === 'escape' || k === 'p')) setState('playing');
    else if (state === 'levelup' && ['1', '2', '3', '4'].includes(k)) choose(Number(k) - 1);
    else if (state === 'dead' && (k === 'r' || k === 'enter')) startGame();
  }

  // ============================================================
  // Telas
  // ============================================================
  const OVERLAYS = { home: 'home', chars: 'chars', shop: 'shop', settings: 'settings', paused: 'pause', levelup: 'levelup', dead: 'gameover' };

  function setState(s) {
    state = s;
    if (s !== 'playing') stick.active = false;
    for (const st in OVERLAYS) $(OVERLAYS[st]).classList.toggle('hidden', st !== s);
    $('hud').classList.toggle('hidden', !inRun);
    document.querySelectorAll('.coinval').forEach((el) => { el.textContent = save.coins; });
    if (s === 'home') renderHome();
    if (s === 'chars') renderChars();
    if (s === 'shop') renderShop();
    if (s === 'settings') renderSettings();
    if (s === 'paused') renderStats();
    updateMusic();
  }

  function toast(text) {
    showBanner(text, '#ffd36b');
  }

  // ---------- Tela inicial ----------
  function renderHome() {
    const st = save.stats;
    $('best').textContent = st.bestTime > 0
      ? `Recorde: ${fmtTime(st.bestTime)} · nível ${st.bestLevel} · ${st.bosses} chefões derrotados`
      : 'Sobreviva às hordas, suba de nível e fique mais forte.';
  }

  function drawHomeArt(t) {
    const c = $('homeArt');
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const ids = ['maniaco', 'mago', 'golem'];
    const xs = [c.width * 0.22, c.width * 0.5, c.width * 0.78];
    ids.forEach((id, i) => {
      const s = id === 'golem' ? 3.3 : id === 'mago' ? 4.4 : 3.8;
      const y = c.height * 0.92;
      Art.glow(g, xs[i], y - 60, 120, CHARACTERS[id].accent, 0.35);
      if (save.chars[id]) Art.drawHero(g, id, xs[i], y, s, t + i, i === 2 ? -1 : 1, { rage: 0.5 + Math.sin(t * 2) * 0.5 });
      else Art.drawHeroSilhouette(g, id, xs[i], y, s, t + i);
    });
  }

  // ---------- Escolha de personagem com retratos animados ----------
  let portraits = [];
  let hoverChar = null;

  function renderChars() {
    const box = $('charlist');
    box.innerHTML = '';
    portraits = [];
    Object.keys(CHARACTERS).forEach((id, i) => {
      const C = CHARACTERS[id];
      const locked = !save.chars[id];
      const card = document.createElement('div');
      card.className = 'card char' + (id === selectedChar ? ' selected' : '') + (locked ? ' locked' : '');
      card.style.setProperty('--accent', C.accent);
      const bars = Object.entries(C.bars).map(([k, v]) =>
        `<div class="stat"><span>${k}</span><div class="sbar"><i style="width:${v * 100}%"></i></div></div>`).join('');
      card.innerHTML = `
        <canvas class="portrait" width="440" height="360"></canvas>
        ${locked ? `<div class="lockbadge"><img src="${Art.icon('lock')}" alt=""><span>Desbloqueie na Loja</span></div>` : ''}
        <div class="ctitle">${C.title}</div>
        <div class="name">${C.name}</div>
        <div class="stats">${bars}</div>
        <div class="desc">${C.desc}</div>
        <div class="desc passive">${C.passive}</div>
        <div class="key">${locked ? 'Bloqueado' : isTouch ? 'Toque para escolher' : 'Clique ou tecla ' + (i + 1)}</div>`;
      card.addEventListener('click', () => selectChar(id));
      card.addEventListener('dblclick', () => { if (save.chars[id]) { selectChar(id); startGame(); } });
      card.addEventListener('mouseenter', () => { hoverChar = id; });
      card.addEventListener('mouseleave', () => { if (hoverChar === id) hoverChar = null; });
      box.appendChild(card);
      portraits.push({ id, c: card.querySelector('canvas') });
    });
  }

  function drawPortraits(t) {
    for (const p of portraits) {
      const g = p.c.getContext('2d');
      const C = CHARACTERS[p.id];
      const w = p.c.width;
      const h = p.c.height;
      const locked = !save.chars[p.id];
      g.setTransform(1, 0, 0, 1, 0, 0);
      const bg = g.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, w * 0.7);
      bg.addColorStop(0, locked ? '#2a2438' : C.theme[0]);
      bg.addColorStop(1, locked ? '#0c0a12' : C.theme[1]);
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      // partículas de ambiente de cada personagem
      for (let i = 0; i < 18; i++) {
        const seed = i * 97.13;
        const life = (t * 0.25 + (seed % 1)) % 1;
        const x = (seed * 37) % w;
        const y = p.id === 'mago' ? life * h : h - life * h;
        const r = 2 + (i % 3);
        Art.glow(g, x + Math.sin(t + i) * 10, y, r * 4, locked ? '#6a6080' : C.accent, 0.5 * (1 - Math.abs(life - 0.5) * 2));
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(w / 2, h * 0.86, w * 0.3, h * 0.07, 0, 0, TAU);
      g.fill();
      const s = p.id === 'golem' ? 4.6 : 5.6;
      if (locked) {
        Art.drawHeroSilhouette(g, p.id, w / 2, h * 0.86, s, t);
      } else {
        Art.glow(g, w / 2, h * 0.86, w * 0.35, C.accent, 0.25);
        Art.drawHero(g, p.id, w / 2, h * 0.86, s, t, 1, { moving: hoverChar === p.id, rage: p.id === 'golem' ? 0.5 + Math.sin(t * 2) * 0.5 : 0 });
      }
    }
  }

  function selectChar(id) {
    if (!save.chars[id]) {
      Sound.play('denied');
      toast('Desbloqueie esse personagem na Loja');
      return;
    }
    selectedChar = id;
    save.char = id;
    persist();
    resetWorld();
    renderChars();
  }

  // ---------- Loja ----------
  function renderShop() {
    const box = $('shoplist');
    box.innerHTML = '';
    const groups = [['Personagens', 'char'], ['Espaços de arma', 'wslot'], ['Espaços de passiva', 'pslot']];
    for (const [title, kind] of groups) {
      const h = document.createElement('h3');
      h.className = 'shophead';
      h.textContent = title;
      box.appendChild(h);
      const row = document.createElement('div');
      row.className = 'shoprow';
      for (const item of SHOP.filter((i) => i.kind === kind)) {
        const owned = item.kind === 'char' ? save.chars[item.id] : save.bought[item.id];
        const needsOk = !item.needs || save.bought[item.needs];
        const ok = reqMet(item.req);
        const afford = save.coins >= item.price;
        const icon = item.kind === 'char' ? Art.heroIcon(item.id) : Art.icon(item.kind === 'wslot' ? 'might' : 'armor');
        const card = document.createElement('div');
        card.className = 'card shopitem' + (owned ? ' owned' : '') + (!owned && (!ok || !needsOk) ? ' blocked' : '');
        card.style.setProperty('--accent', item.kind === 'char' ? CHARACTERS[item.id].accent : item.kind === 'wslot' ? '#ffd36b' : '#8fd3a0');
        let status;
        if (owned) status = '<div class="owned-tag">Comprado</div>';
        else if (!needsOk) status = '<div class="req">Compre o espaço anterior primeiro</div>';
        else {
          const reqHtml = item.req
            ? `<div class="req ${ok ? 'ok' : ''}">${ok ? '✔' : '🔒'} ${item.req.text}${ok ? '' : ` <b>(${reqProgress(item.req)})</b>`}</div>`
            : '';
          status = `${reqHtml}<button class="buy" ${ok && afford ? '' : 'disabled'}><img src="${Art.icon('coin')}" alt="">${item.price}</button>`;
        }
        card.innerHTML = `
          <div class="shopicon ${item.kind === 'char' ? 'hero' : ''}"><img src="${icon}" alt=""></div>
          <div class="name">${item.name}</div>
          <div class="desc">${item.desc}</div>
          ${status}`;
        const btn = card.querySelector('.buy');
        if (btn) btn.addEventListener('click', () => buy(item));
        row.appendChild(card);
      }
      box.appendChild(row);
    }
    document.querySelectorAll('.coinval').forEach((el) => { el.textContent = save.coins; });
  }

  function buy(item) {
    if (save.coins < item.price || !reqMet(item.req) || (item.needs && !save.bought[item.needs])) return;
    save.coins -= item.price;
    Sound.play('buy');
    save.bought[item.id] = true;
    if (item.kind === 'char') save.chars[item.id] = true;
    persist();
    toast(`${item.name} desbloqueado!`);
    renderShop();
  }

  // ---------- Configurações ----------
  const SETTINGS = [
    { id: 'quality', name: 'Qualidade gráfica', desc: 'Automática reduz sozinha se o aparelho ficar lento.', options: [['auto', 'Automática'], ['alta', 'Alta'], ['baixa', 'Baixa']] },
    { id: 'shake', name: 'Tremor de tela', desc: 'A tela treme com explosões e golpes.', options: [[true, 'Ligado'], [false, 'Desligado']] },
    { id: 'numbers', name: 'Números de dano', desc: 'Mostra o dano causado nos inimigos.', options: [[true, 'Ligado'], [false, 'Desligado']] },
    { id: 'music', name: 'Música', desc: 'Volume da música.', options: [[0, 'Mudo'], [0.3, 'Baixo'], [0.6, 'Médio'], [1, 'Alto']] },
    { id: 'sfx', name: 'Efeitos sonoros', desc: 'Volume dos golpes, explosões e itens.', options: [[0, 'Mudo'], [0.4, 'Baixo'], [0.8, 'Médio'], [1, 'Alto']] },
  ];

  function renderSettings() {
    const box = $('setlist');
    box.innerHTML = '';
    for (const opt of SETTINGS) {
      const row = document.createElement('div');
      row.className = 'setrow';
      row.innerHTML = `<div class="setinfo"><b>${opt.name}</b><span>${opt.desc}</span></div><div class="seg"></div>`;
      const seg = row.querySelector('.seg');
      for (const [value, label] of opt.options) {
        const b = document.createElement('button');
        b.className = 'segbtn' + (save.settings[opt.id] === value ? ' on' : '');
        b.textContent = label;
        b.addEventListener('click', () => {
          save.settings[opt.id] = value;
          persist();
          applySettings();
          renderSettings();
        });
        seg.appendChild(b);
      }
      box.appendChild(row);
    }
    $('resetBtn').classList.toggle('hidden', settingsReturn !== 'home');
  }

  function renderStats() {
    const C = CHARACTERS[player.char];
    const rows = [
      ['Personagem', C.name],
      ['Vida', `${Math.ceil(player.hp)} / ${player.maxHp}`],
      ['Dano', pct(effDmgMul())],
      ['Crítico', pct(player.crit)],
      ['Recarga', pct(effCd())],
      ['Área', pct(player.areaMul)],
      ['Projéteis extras', player.extraProj],
      ['Velocidade', Math.round(effSpeed())],
      ['Armadura', +player.armor.toFixed(1)],
      ['Redução de dano', pct(bladeReduction())],
      ['Regeneração', `${effRegen().toFixed(1)}/s`],
      ['Sorte', +effLuck().toFixed(1)],
      ['XP e moedas', `${pct(player.xpMul)} · ${pct(player.coinMul)}`],
      ['Espaços', `armas ${Object.keys(weapons).length}/${weaponSlots()} · passivas ${Object.keys(passiveLevels).length}/${passiveSlots()}`],
    ];
    $('pstats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }

  function startGame() {
    if (!save.chars[selectedChar]) selectedChar = 'mago';
    // No celular, entra em tela cheia (precisa vir de um toque do jogador).
    const root = document.documentElement;
    if (isTouch && !document.fullscreenElement && root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    }
    resetWorld();
    addWeapon(CHARACTERS[selectedChar].weapon, 1);
    // Uma fogueira perto do início para o jogador descobrir a mecânica.
    spawnStructure('totem', 380);
    inRun = true;
    setState('playing');
  }

  function showBanner(text, color) {
    const el = $('banner');
    el.textContent = text;
    el.style.color = color || '#ff5c8a';
    el.classList.remove('show');
    void el.offsetWidth; // reinicia a animação
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // Fecha a partida: soma moedas, atualiza recordes e objetivos.
  function endRun() {
    const minutes = Math.floor(time / 60);
    const parts = [
      ['Moedas coletadas', Math.round(runCoins)],
      [`Tempo (${minutes} min)`, minutes * 10],
      [`Chefões (${player.bossKills})`, player.bossKills * 25],
      [`Abates (${kills})`, Math.floor(kills / 25)],
    ];
    const total = parts.reduce((a, [, v]) => a + v, 0);
    const st = save.stats;
    const newRecord = time > st.bestTime;
    st.bestTime = Math.max(st.bestTime, time);
    st.bestLevel = Math.max(st.bestLevel, player.level);
    st.bestKills = Math.max(st.bestKills, kills);
    st.bosses += player.bossKills;
    st.kills += kills;
    st.runs += 1;
    save.coins += total;
    persist();
    inRun = false;
    return { parts, total, newRecord };
  }

  function gameOver() {
    Sound.play('death');
    const { parts, total, newRecord } = endRun();
    $('stats').innerHTML = `
      <div><span>Personagem</span><b>${CHARACTERS[player.char].name}</b></div>
      <div><span>Tempo sobrevivido</span><b>${fmtTime(time)}</b></div>
      <div><span>Nível alcançado</span><b>${player.level}</b></div>
      ${newRecord ? '<p class="new">Novo recorde!</p>' : ''}
      <h3 class="earnhead">Moedas ganhas</h3>
      ${parts.map(([k, v]) => `<div><span>${k}</span><b>+${v}</b></div>`).join('')}
      <div class="total"><span>Total</span><b><img src="${Art.icon('coin')}" alt="">+${total}</b></div>`;
    setState('dead');
  }

  function quitToHome() {
    if (inRun) {
      const { total } = endRun();
      if (total > 0) setTimeout(() => toast(`+${total} moedas`), 50);
    }
    inRun = false;
    resetWorld();
    setState('home');
  }

  $('homePlay').addEventListener('click', () => setState('chars'));
  $('homeShop').addEventListener('click', () => setState('shop'));
  $('homeSettings').addEventListener('click', () => { settingsReturn = 'home'; setState('settings'); });
  $('charsBack').addEventListener('click', () => setState('home'));
  $('charsPlay').addEventListener('click', startGame);
  $('shopBack').addEventListener('click', () => setState('home'));
  $('settingsBack').addEventListener('click', () => setState(settingsReturn));
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Apagar todo o progresso (moedas, compras e recordes)?')) return;
    save = defaultSave();
    persist();
    selectedChar = 'mago';
    applySettings();
    toast('Progresso apagado');
    renderSettings();
  });
  $('restartBtn').addEventListener('click', startGame);
  $('resumeBtn').addEventListener('click', () => setState('playing'));
  $('pauseSettings').addEventListener('click', () => { settingsReturn = 'paused'; setState('settings'); });
  $('pauseBtn').addEventListener('click', () => { if (state === 'playing') setState('paused'); });
  $('quitBtn').addEventListener('click', quitToHome);
  $('menuBtn').addEventListener('click', quitToHome);

  // ============================================================
  // Subir de nível, baús, fogueiras e recompensas
  // ============================================================
  const RARITY = [
    null,
    { name: 'Comum', cls: '' },
    { name: 'Raro', cls: 'rare' },
    { name: 'Épico', cls: 'epic' },
  ];

  function addWeapon(id, levels) {
    if (weapons[id]) weapons[id].level = Math.min(WEAPONS[id].max, weapons[id].level + levels);
    else weapons[id] = { level: Math.min(WEAPONS[id].max, levels), timer: 0.3, angle: 0, blades: [] };
  }

  function rollRarity(minRarity) {
    const luck = effLuck();
    const epic = Math.min(0.3, 0.01 + luck * 0.02);
    const rare = Math.min(0.6, 0.06 + luck * 0.05);
    const r = Math.random();
    const rolled = r < epic ? 3 : r < epic + rare ? 2 : 1;
    return Math.max(minRarity, rolled);
  }

  // Armas e passivas misturadas, respeitando os espaços livres.
  function buildChoices(isChest) {
    const pool = [];
    const weaponsFull = Object.keys(weapons).length >= weaponSlots();
    const passivesFull = Object.keys(passiveLevels).length >= passiveSlots();
    for (const id in WEAPONS) {
      const lv = weapons[id] ? weapons[id].level : 0;
      if (lv >= WEAPONS[id].max) continue;
      if (lv === 0 && weaponsFull) continue;
      pool.push({ kind: 'weapon', id, lv });
    }
    for (const id in PASSIVES) {
      const lv = passiveLevels[id] || 0;
      if (lv >= PASSIVES[id].max) continue;
      if (lv === 0 && passivesFull) continue;
      pool.push({ kind: 'passive', id, lv });
    }
    const count = 3 + (Math.random() < effLuck() * 0.08 ? 1 : 0);
    const picks = shuffle(pool).slice(0, count);
    for (const c of picks) {
      const max = c.kind === 'weapon' ? WEAPONS[c.id].max : PASSIVES[c.id].max;
      c.rarity = rollRarity(isChest ? 2 : 1);
      c.gain = Math.min(c.rarity, max - c.lv);
    }
    if (picks.length === 0) {
      picks.push({ kind: 'heal', id: 'heal', rarity: 1, gain: 1 });
      picks.push({ kind: 'gold', id: 'coin', rarity: 1, gain: 1 });
    }
    return picks;
  }

  function buildBoons() {
    return shuffle(Object.keys(BOONS)).slice(0, 3).map((id) => {
      const tier = rollTier();
      return { kind: 'boon', id, tier, value: BOONS[id].base * TIERS[tier].mul };
    });
  }

  function openChoices() {
    const mode = pendingLevels > 0 ? 'level' : pendingChests > 0 ? 'chest' : 'shrine';
    currentChoices = mode === 'shrine' ? buildBoons() : buildChoices(mode === 'chest');
    currentChoices.mode = mode;
    if (mode === 'level') Sound.play('levelup');
    $('choiceTitle').textContent = mode === 'chest' ? 'Baú do tesouro!' : mode === 'shrine' ? 'Fogueira acesa' : 'Subiu de nível!';
    $('choiceSub').textContent = mode === 'chest' ? 'Recompensas raras garantidas'
      : mode === 'shrine' ? 'Escolha uma bênção (não ocupa espaço). A Sorte deixa as bênçãos mais fortes.'
        : `Espaços: armas ${Object.keys(weapons).length}/${weaponSlots()} · passivas ${Object.keys(passiveLevels).length}/${passiveSlots()}`;
    const cards = $('cards');
    cards.innerHTML = '';
    currentChoices.forEach((c, i) => {
      let name;
      let tag;
      let desc;
      let color;
      let ribbon = '';
      let cls = '';
      let bonus = '';
      let iconId = c.id;
      if (c.kind === 'weapon') {
        const def = WEAPONS[c.id];
        name = def.name; desc = def.desc[c.lv]; color = def.color;
        tag = c.lv === 0 ? 'Nova arma' : `Arma · nível ${c.lv + c.gain}`;
      } else if (c.kind === 'passive') {
        const def = PASSIVES[c.id];
        name = def.name; desc = def.desc; color = '#8fd3a0';
        tag = c.lv === 0 ? 'Nova passiva' : `Passiva · nível ${c.lv + c.gain}`;
      } else if (c.kind === 'boon') {
        const def = BOONS[c.id];
        const tier = TIERS[c.tier];
        name = def.name; desc = def.text(c.value); color = BONFIRE_COLOR; iconId = def.icon;
        tag = `Bênção ${tier.name.toLowerCase()}`;
        cls = tier.cls;
        ribbon = tier.name;
      } else if (c.kind === 'gold') {
        name = 'Saco de Moedas'; tag = 'Tudo no máximo'; desc = '+25 moedas.'; color = '#ffd36b';
      } else {
        name = 'Poção'; tag = 'Consumível'; desc = 'Recupera 40 de vida.'; color = '#ff4f6a';
      }
      if (c.rarity > 1) {
        const rar = RARITY[c.rarity];
        cls = rar.cls;
        ribbon = rar.name;
        if (c.gain > 1) bonus = `<div class="bonus">${rar.name}: +${c.gain} níveis de uma vez!</div>`;
      }
      const card = document.createElement('div');
      card.className = 'card reward ' + cls;
      card.style.setProperty('--accent', color);
      card.style.animationDelay = (i * 0.07) + 's';
      card.innerHTML = `
        ${ribbon ? `<div class="ribbon">${ribbon}</div>` : ''}
        <div class="medal"><img src="${Art.icon(iconId)}" alt=""></div>
        <div class="name">${name}</div>
        <div class="tag">${tag}</div>
        <div class="desc">${desc}</div>
        ${bonus}
        <div class="key">${isTouch ? 'Toque para escolher' : 'Clique ou tecla ' + (i + 1)}</div>`;
      card.addEventListener('click', () => choose(i));
      cards.appendChild(card);
    });
    setState('levelup');
  }

  function choose(i) {
    if (state !== 'levelup') return;
    const c = currentChoices[i];
    if (!c) return;
    if (c.kind === 'weapon') addWeapon(c.id, c.gain);
    else if (c.kind === 'passive') {
      for (let n = 0; n < c.gain; n++) {
        passiveLevels[c.id] = (passiveLevels[c.id] || 0) + 1;
        PASSIVES[c.id].apply();
      }
    } else if (c.kind === 'boon') {
      BOONS[c.id].apply(c.value);
      boonsTaken[c.id] = (boonsTaken[c.id] || 0) + c.value;
    } else if (c.kind === 'gold') runCoins += 25;
    else heal(40);
    if (currentChoices.mode === 'chest') pendingChests--;
    else if (currentChoices.mode === 'shrine') pendingShrines--;
    else pendingLevels--;
    sparks(player.x, player.y - 15, '#ffd36b', 16, 260);
    Sound.play('select');
    if (pendingLevels > 0 || pendingChests > 0 || pendingShrines > 0) openChoices();
    else setState('playing');
  }

  function gainXp(v) {
    player.xp += v * player.xpMul;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.level++;
      player.xpNext = xpForLevel(player.level);
      pendingLevels++;
      levelFx = 1;
      if (player.char === 'maniaco') player.crit += 0.01;
    }
  }

  function heal(v) {
    player.hp = Math.min(player.maxHp, player.hp + v);
  }

  // ============================================================
  // Partículas e efeitos
  // ============================================================
  let maxParticles = 900;

  function fx(o) {
    if (particles.length >= maxParticles) return;
    o.max = o.life;
    if (o.vx === undefined) o.vx = 0;
    if (o.vy === undefined) o.vy = 0;
    if (o.drag === undefined) o.drag = 0.9;
    particles.push(o);
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.3, speed);
      fx({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), color, size: rand(2, 4.5) });
    }
  }

  function sparks(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.4, speed);
      fx({ kind: 'spark', add: true, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.15, 0.35), color, size: rand(1.5, 2.5), drag: 0.85 });
    }
  }

  function smoke(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      fx({ kind: 'smoke', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-40, -10), life: rand(0.5, 0.9), color: color || '#9a948c', size: rand(5, 9), grow: 14, drag: 0.95 });
    }
  }

  function ringFx(x, y, r, color) {
    fx({ kind: 'ring', add: true, x, y, life: 0.3, color, size: r * 0.4, grow: r * 3, drag: 1 });
  }

  function addText(x, y, txt, color, big) {
    if (texts.length > 160) texts.shift();
    texts.push({ x: x + rand(-8, 8), y, txt, color, big: !!big, life: 0.75, vx: rand(-15, 15) });
  }

  // ============================================================
  // Estruturas: fogueiras e altares de invocação
  // ============================================================
  function spawnStructure(kind, distance) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const a = rand(0, TAU);
      const d = distance || rand(650, 1250);
      const x = player.x + Math.cos(a) * d;
      const y = player.y + Math.sin(a) * d;
      const crowded = structures.some((s) => Math.hypot(s.x - x, s.y - y) < 350);
      if (crowded) continue;
      if (kind === 'totem') {
        structures.push({ kind, x, y, r: 55, charge: 0, need: 1.5, used: false, fade: 1 });
      } else {
        structures.push({ kind, x, y, r: 70, charge: 0, need: 2.5, used: false, fade: 1 });
      }
      return;
    }
  }

  function updateStructures(dt) {
    structTimer -= dt;
    if (structTimer <= 0) {
      structTimer = 3;
      structures = structures.filter((s) => Math.hypot(s.x - player.x, s.y - player.y) < 2600 && s.fade > 0);
      const totems = structures.filter((s) => s.kind === 'totem' && !s.used).length;
      const altars = structures.filter((s) => s.kind === 'altar' && !s.used).length;
      if (totems < 2) spawnStructure('totem');
      if (altars < 1 && time > 20) spawnStructure('altar');
    }

    for (const s of structures) {
      const near = Math.abs(s.x - player.x) < W / 2 + 100 && Math.abs(s.y - player.y) < H / 2 + 100;
      // brasas e fumaça só para o que está na tela
      if (near) {
        if (s.kind === 'totem' && !s.used && Math.random() < dt * 14) {
          fx({ kind: 'dot', add: true, x: s.x + rand(-10, 10), y: s.y - rand(5, 25), vx: rand(-15, 15), vy: rand(-70, -35), life: rand(0.6, 1.2), color: BONFIRE_COLOR, size: rand(1.5, 3), drag: 0.98 });
        } else if (s.kind === 'totem' && s.used && Math.random() < dt * 3) {
          smoke(s.x, s.y - 10, 1, '#6a6460');
        } else if (s.kind === 'altar' && !s.used && Math.random() < dt * 10) {
          fx({ kind: 'dot', add: true, x: s.x + rand(-50, 50), y: s.y + rand(-20, 20), vx: 0, vy: rand(-50, -25), life: rand(0.6, 1.1), color: '#ff3355', size: rand(1.5, 3), drag: 0.99 });
        }
      }
      if (s.used) {
        s.fade -= dt * 0.08;
        continue;
      }
      const inside = Math.hypot(s.x - player.x, s.y - player.y) < s.r;
      s.charge = inside ? s.charge + dt : Math.max(0, s.charge - dt * 2);
      if (s.charge >= s.need) {
        s.used = true;
        if (s.kind === 'totem') activateTotem(s);
        else activateAltar(s);
      }
    }
  }

  function activateTotem(s) {
    Sound.play('bonfire');
    sparks(s.x, s.y - 30, BONFIRE_COLOR, 40, 320);
    ringFx(s.x, s.y, 80, BONFIRE_COLOR);
    smoke(s.x, s.y - 20, 6, '#7a746e');
    pendingShrines++;
  }

  function activateAltar(s) {
    Sound.play('altar');
    sparks(s.x, s.y, '#ff3355', 60, 380);
    ringFx(s.x, s.y, 140, '#ff3355');
    smoke(s.x, s.y, 10, '#3a2028');
    shake = 12;
    spawnBoss(s.x + rand(-40, 40), s.y - 90, 1.3);
    showBanner('Você invocou um chefão!', '#ff3355');
  }

  // ============================================================
  // Inimigos
  // ============================================================
  function pickEnemyType() {
    const r = Math.random();
    if (time > 120 && r < 0.08) return 'skelknight';
    if (time > 60 && r < 0.28) return 'werewolf';
    if (time > 25 && r < 0.48) return 'mummy';
    if (r < 0.7) return 'skeleton';
    return 'ghost';
  }

  function spawnPoint() {
    const a = rand(0, TAU);
    const d = Math.hypot(W, H) / 2 + 40;
    return { x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d };
  }

  function spawnEnemy(type, x, y, hpMul) {
    const T = ENEMY_TYPES[type];
    if (x === undefined) ({ x, y } = spawnPoint());
    const hp = T.hp * (1 + (time / 60) * 0.45) * (hpMul || 1);
    const base = CHARACTERS[player.char].speed;
    const e = {
      type, x, y, r: T.r, hp, maxHp: hp,
      // fica sempre abaixo de 95% da velocidade base do personagem
      speed: base * Math.min(0.95, T.speed * (1 + Math.min(time / 600, 0.15))),
      dmg: T.dmg * (1 + (time / 240) * 0.3),
      xp: T.xp, color: T.color, boss: !!T.boss,
      flash: 0, kbx: 0, kby: 0, orbitCd: 0, phase: rand(0, TAU), summonT: 3, dead: false,
      lungeCd: rand(1, 3), windup: 0, dashT: 0, dashX: 0, dashY: 0, missileT: 2.5,
    };
    enemies.push(e);
    return e;
  }

  function spawnBoss(x, y, extraMul) {
    bossesSpawned++;
    const type = BOSS_ORDER[(bossesSpawned - 1) % BOSS_ORDER.length];
    // Cada chefão seguinte é mais forte que o anterior.
    const mul = (1 + (bossesSpawned - 1) * 0.5) * (extraMul || 1);
    const e = spawnEnemy(type, x, y, mul);
    smoke(x, y, 12, '#2a1a24');
    Sound.play('boss');
    return e;
  }

  function updateSpawning(dt) {
    const rate = 1 + time / 18;
    spawnAcc += rate * dt;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      if (enemies.length < MAX_ENEMIES) spawnEnemy(pickEnemyType());
    }

    if (time >= nextSwarm) {
      // Enxame: um anel de inimigos fechando em volta do jogador.
      nextSwarm += 50;
      const n = 24 + Math.floor(time / 15);
      const d = Math.hypot(W, H) / 2 + 20;
      const type = time > 100 ? 'werewolf' : 'ghost';
      for (let i = 0; i < n && enemies.length < MAX_ENEMIES + 40; i++) {
        const a = (i / n) * TAU;
        spawnEnemy(type, player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
      }
      showBanner('Cuidado, um enxame!');
      Sound.play('swarm');
    }

    if (time >= nextBoss) {
      nextBoss += BOSS_INTERVAL;
      const p = spawnPoint();
      spawnBoss(p.x, p.y);
      showBanner('Um chefão apareceu!');
    }
  }

  function damageEnemy(e, base, kx, ky) {
    if (e.dead) return;
    let dmg = base * effDmgMul();
    const crit = Math.random() < player.crit;
    if (crit) dmg *= 2;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.flash = 0.1;
    if (!e.boss) {
      e.kbx += kx || 0;
      e.kby += ky || 0;
    }
    if (Math.random() < 0.5) sparks(e.x, e.y, crit ? '#ffd23f' : '#ffffff', crit ? 5 : 2, 180);
    Sound.play(crit ? 'crit' : 'hit');
    if (save.settings.numbers) addText(e.x, e.y - e.r, crit ? dmg + '!' : dmg, crit ? '#ffd23f' : '#ffffff', crit);
    if (e.hp <= 0) killEnemy(e);
  }

  function coinValue() {
    return 1 + Math.floor(time / 180);
  }

  function killEnemy(e) {
    e.dead = true;
    kills++;
    Sound.play(e.boss ? 'bossdeath' : 'kill');
    burst(e.x, e.y, e.color, e.boss ? 40 : 7, e.boss ? 280 : 150);
    ringFx(e.x, e.y, e.r * 1.4, '#ffffff');
    smoke(e.x, e.y, e.boss ? 14 : 1);
    if (e.boss) {
      for (let i = 0; i < 12; i++) dropXp(e.x + rand(-50, 50), e.y + rand(-50, 50), 5);
      for (let i = 0; i < 8; i++) pickups.push({ kind: 'coin', x: e.x + rand(-60, 60), y: e.y + rand(-60, 60), v: coinValue() * 3 });
      pickups.push({ kind: 'chest', x: e.x, y: e.y });
      pickups.push({ kind: 'heart', x: e.x + 34, y: e.y, v: 50 });
      player.bossKills++;
      shake = 14;
      sparks(e.x, e.y, '#ffd36b', 50, 420);
      if (player.char === 'mago') {
        player.luck += 1;
        addText(player.x, player.y - 50, '+1 Sorte', '#5fe8ff', true);
      }
      showBanner('Chefão derrotado! Pegue o baú.', '#ffd36b');
    } else {
      dropXp(e.x, e.y, e.xp);
      const luck = 1 + effLuck() * 0.1;
      if (Math.random() < 0.012 * (1 + effLuck() * 0.25)) pickups.push({ kind: 'heart', x: e.x, y: e.y, v: 25 });
      else if (Math.random() < 0.05 * luck) pickups.push({ kind: 'coin', x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), v: coinValue() });
    }
  }

  function dropXp(x, y, v) {
    // Muitas gemas no chão pesam: acima do limite, junta o valor numa gema existente.
    if (pickups.length > 450) {
      const g = pickups.find((p) => p.kind === 'xp');
      if (g) { g.v += v; return; }
    }
    pickups.push({ kind: 'xp', x, y, v });
  }

  function hurtPlayer(amount) {
    const dmg = Math.max(1, Math.round((amount - player.armor) * (1 - bladeReduction())));
    player.hp -= dmg;
    player.invuln = 0.6;
    shake = Math.max(shake, 7);
    hurtFlash = 1;
    Sound.play('hurt');
    sparks(player.x, player.y - 15, '#ff4444', 8, 220);
    addText(player.x, player.y - 40, '-' + dmg, '#ff5555', true);
    if (player.hp <= 0) {
      player.hp = 0;
      burst(player.x, player.y, CHARACTERS[player.char].accent, 40, 260);
      smoke(player.x, player.y, 10);
      gameOver();
    }
  }

  function updateEnemies(dt) {
    const farLimit = Math.hypot(W, H) * 0.85;
    for (const e of enemies) {
      if (e.dead) continue;
      let dx = player.x - e.x;
      let dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // Inimigo muito longe reaparece perto do jogador (evita ficar perdido).
      if (d > farLimit && !e.boss) {
        const p = spawnPoint();
        e.x = p.x; e.y = p.y;
        continue;
      }

      dx /= d; dy /= d;
      let vx = dx * e.speed;
      let vy = dy * e.speed;
      if (e.type === 'ghost') {
        // flutua em zigue-zague
        const w = Math.sin(time * 3 + e.phase) * 45;
        vx += -dy * w;
        vy += dx * w;
      }
      if (e.type === 'werewolf') {
        // Agacha (aviso) e dá um bote rápido na direção do jogador.
        e.lungeCd -= dt;
        if (e.dashT > 0) {
          e.dashT -= dt;
          vx = e.dashX * e.speed * 3.2;
          vy = e.dashY * e.speed * 3.2;
        } else if (e.windup > 0) {
          e.windup -= dt;
          vx = 0;
          vy = 0;
          if (e.windup <= 0) {
            e.dashT = 0.32;
            e.dashX = dx;
            e.dashY = dy;
            smoke(e.x, e.y + 8, 2, '#8a7a64');
          }
        } else if (e.lungeCd <= 0 && d < 260) {
          e.windup = 0.45;
          Sound.play('growl');
          e.lungeCd = rand(2.5, 4);
        }
      }
      if (e.type === 'robo') {
        // Marca áreas no chão; os mísseis caem depois de um tempo para dar chance de desviar.
        e.missileT -= dt;
        if (e.missileT <= 0) {
          e.missileT = 3.4;
          const n = 5 + Math.min(4, Math.floor(bossesSpawned / 2));
          const lead = player.moving ? 90 : 0;
          for (let i = 0; i < n; i++) {
            const tx = player.x + player.dirX * lead + (i === 0 ? 0 : rand(-190, 190));
            const ty = player.y + player.dirY * lead + (i === 0 ? 0 : rand(-150, 150));
            strikes.push({ x: tx, y: ty, r: 58, t: 1.6 + i * 0.08, max: 1.6 + i * 0.08, dmg: e.dmg * 0.9 });
          }
          sparks(e.x, e.y - e.r, '#ff4a3a', 18, 260);
          Sound.play('warn');
          smoke(e.x, e.y - e.r, 6, '#5a5a60');
        }
      }
      if (e.type === 'lich') {
        // O Lich invoca esqueletos ao seu redor.
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = 4;
          for (let i = 0; i < 4 && enemies.length < MAX_ENEMIES + 60; i++) {
            const a = (i / 4) * TAU;
            spawnEnemy('skeleton', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
            smoke(e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, 3, '#2a4a50');
          }
          sparks(e.x, e.y - 20, '#4fe0d0', 20, 220);
        }
      }
      e.x += (vx + e.kbx) * dt;
      e.y += (vy + e.kby) * dt;
      const decay = Math.min(1, dt * 8);
      e.kbx -= e.kbx * decay;
      e.kby -= e.kby * decay;
      e.flash -= dt;
      e.orbitCd -= dt;
      e.phase += dt;

      if (d < e.r + player.r && player.invuln <= 0 && state === 'playing') hurtPlayer(e.dmg);
    }
    separateEnemies();
  }

  // Empurra inimigos sobrepostos para que a horda não vire uma bola só.
  function separateEnemies() {
    const CELL = 48;
    const grid = new Map();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      e.idx = i;
      const key = Math.floor(e.x / CELL) + ',' + Math.floor(e.y / CELL);
      let cell = grid.get(key);
      if (!cell) grid.set(key, (cell = []));
      cell.push(e);
    }
    for (const e of enemies) {
      const cx = Math.floor(e.x / CELL);
      const cy = Math.floor(e.y / CELL);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const cell = grid.get((cx + ox) + ',' + (cy + oy));
          if (!cell) continue;
          for (const o of cell) {
            if (o.idx <= e.idx) continue;
            const dx = o.x - e.x;
            const dy = o.y - e.y;
            const min = e.r + o.r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const push = (min - d) * 0.5;
            const nx = dx / d;
            const ny = dy / d;
            const we = e.boss ? 0.1 : 1;
            const wo = o.boss ? 0.1 : 1;
            e.x -= nx * push * we;
            e.y -= ny * push * we;
            o.x += nx * push * wo;
            o.y += ny * push * wo;
          }
        }
      }
    }
  }

  function nearestEnemy(x, y, exclude, maxDist) {
    let best = null;
    let bd = maxDist ? maxDist * maxDist : Infinity;
    for (const e of enemies) {
      if (e.dead || (exclude && exclude.has(e))) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function enemiesOnScreen() {
    const hw = W / 2 + 20;
    const hh = H / 2 + 20;
    return enemies.filter((e) => !e.dead && Math.abs(e.x - player.x) < hw && Math.abs(e.y - player.y) < hh);
  }

  // Dano em área com empurrão para fora do centro.
  function areaDamage(x, y, radius, dmg, knock) {
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const rr = radius + e.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1;
      damageEnemy(e, dmg, (dx / d) * knock, (dy / d) * knock);
    }
  }

  // ============================================================
  // Armas
  // ============================================================
  const WEAPON_UPDATE = {
    missil(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const target = nearestEnemy(player.x, player.y);
      if (!target) { w.timer = 0.1; return; }
      w.timer = (lv >= 3 ? 0.7 : 0.95) * effCd();
      Sound.play('ice');
      const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 6) + player.extraProj;
      const dmg = 8 + 3 * lv + (lv >= 6 ? 6 : 0);
      const base = Math.atan2(target.y - player.y, target.x - player.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.16;
        projectiles.push({
          kind: 'missil', x: player.x, y: player.y - 14,
          vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
          r: 6, dmg, pierce: lv >= 5 ? 2 : 0, life: 1.4, hit: new Set(),
        });
      }
    },

    arco(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 6) + player.extraProj;
      // Cada flecha mira um inimigo diferente, do mais perto ao mais longe.
      const taken = new Set();
      const targets = [];
      for (let i = 0; i < n; i++) {
        const t = nearestEnemy(player.x, player.y, taken);
        if (!t) break;
        taken.add(t);
        targets.push(t);
      }
      if (!targets.length) { w.timer = 0.1; return; }
      w.timer = (lv >= 3 ? 0.85 : 1.1) * effCd();
      Sound.play('arrow');
      const dmg = 12 + 4 * lv + (lv >= 6 ? 8 : 0);
      const pierce = 2 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const t = targets[i % targets.length];
        const a = Math.atan2(t.y - player.y, t.x - player.x) + rand(-0.5, 0.5);
        projectiles.push({
          kind: 'arrow', x: player.x, y: player.y - 12, speed: 560,
          vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
          r: 5, dmg, pierce, life: 2, hit: new Set(), target: t, turn: 9,
        });
      }
    },

    facas(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      // Mira sozinha no inimigo mais próximo e corrige a rota em voo.
      const target = nearestEnemy(player.x, player.y);
      if (!target) { w.timer = 0.1; return; }
      w.timer = (lv >= 3 ? 0.32 : 0.45) * effCd();
      Sound.play('knife');
      const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 6) + player.extraProj;
      const dmg = 7 + 3 * lv + (lv >= 6 ? 5 : 0);
      const base = Math.atan2(target.y - player.y, target.x - player.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.14 + rand(-0.04, 0.04);
        projectiles.push({
          kind: 'knife', x: player.x, y: player.y - 12, speed: 620,
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          r: 5, dmg, pierce: lv >= 5 ? 1 : 0, life: 0.8, hit: new Set(), target, turn: 6,
        });
      }
    },

    raio(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const starts = shuffle(enemiesOnScreen());
      if (!starts.length) { w.timer = 0.1; return; }
      w.timer = (lv >= 5 ? 1.5 : 2.2) * effCd();
      Sound.play('zap');
      const n = 1 + (lv >= 6 ? 1 : 0) + player.extraProj;
      const bounces = 2 + lv;
      const dmg = 20 + 8 * lv + (lv >= 3 ? 10 : 0);
      for (let i = 0; i < n && i < starts.length; i++) {
        chainLightning(starts[i], bounces, dmg, 170 * player.areaMul);
      }
      shake = Math.max(shake, 3);
    },

    fogo(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const options = enemiesOnScreen();
      if (!options.length) { w.timer = 0.1; return; }
      w.timer = (lv >= 3 ? 1.6 : 2.1) * effCd();
      Sound.play('fire');
      const n = 1 + (lv >= 4 ? 1 : 0) + player.extraProj;
      const radius = (60 + (lv >= 2 ? 15 : 0) + (lv >= 5 ? 25 : 0)) * player.areaMul;
      const dmg = 22 + 9 * lv + (lv >= 5 ? 12 : 0);
      for (let i = 0; i < n; i++) {
        const t = pick(options);
        const a = Math.atan2(t.y - player.y, t.x - player.x);
        projectiles.push({
          kind: 'fireball', x: player.x, y: player.y - 14,
          vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
          r: 8, dmg, pierce: 0, life: 1.6, hit: new Set(),
          tx: t.x, ty: t.y, radius, burn: lv >= 6,
        });
      }
    },

    laminas(w, lv, dt) {
      const n = 2 + (lv >= 3) + (lv >= 5) + player.extraProj;
      const radius = 65 * player.areaMul;
      const speed = 2.8 + (lv >= 6 ? 1.4 : 0);
      const dmg = 5 + 2 * lv + (lv >= 4 ? 5 : 0);
      const br = 10 * Math.sqrt(player.areaMul);
      w.angle += speed * dt;
      w.radius = radius;
      w.blades = [];
      for (let i = 0; i < n; i++) {
        const a = w.angle + (i / n) * TAU;
        w.blades.push({ x: player.x + Math.cos(a) * radius, y: player.y - 10 + Math.sin(a) * radius, a, r: br });
      }
      for (const e of enemies) {
        if (e.dead || e.orbitCd > 0) continue;
        for (const b of w.blades) {
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const rr = e.r + b.r;
          if (dx * dx + dy * dy < rr * rr) {
            const kd = Math.hypot(e.x - player.x, e.y - player.y) || 1;
            damageEnemy(e, dmg, ((e.x - player.x) / kd) * 180, ((e.y - player.y) / kd) * 180);
            e.orbitCd = 0.35;
            break;
          }
        }
      }
    },

    aura(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      w.timer = lv >= 5 ? 0.35 : 0.5;
      const dmg = 4 + 2 * lv + (lv >= 5 ? 3 : 0);
      areaDamage(player.x, player.y, auraRadius(lv), dmg, 0);
    },

    tremor(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      w.timer = (lv >= 3 ? 2.5 : 3.2) * effCd();
      Sound.play('tremor');
      const ring = {
        x: player.x, y: player.y, r: 0,
        maxR: (125 + (lv >= 4 ? 50 : 0)) * player.areaMul,
        dmg: 15 + 7 * lv + (lv >= 2 ? 6 : 0) + (lv >= 5 ? 10 : 0),
        knock: lv >= 5 ? 420 : 300,
        hit: new Set(), delay: 0,
      };
      rings.push(ring);
      if (lv >= 6) rings.push({ ...ring, hit: new Set(), delay: 0.35 });
      shake = Math.max(shake, 4);
      for (let i = 0; i < 10; i++) {
        const a = rand(0, TAU);
        fx({ kind: 'rock', x: player.x, y: player.y, vx: Math.cos(a) * rand(120, 260), vy: Math.sin(a) * rand(120, 260), life: rand(0.35, 0.6), color: '#8a7a64', size: rand(2.5, 4.5) });
      }
    },
  };

  function auraRadius(lv) {
    return (60 + 10 * lv) * player.areaMul;
  }

  function updateWeapons(dt) {
    for (const id in weapons) WEAPON_UPDATE[id](weapons[id], weapons[id].level, dt);
  }

  // Raio que pula de inimigo em inimigo, perdendo 10% de dano por salto.
  function chainLightning(start, bounces, dmg, range) {
    const hit = new Set();
    const pts = [{ x: start.x + rand(-30, 30), y: start.y - 320 }];
    let cur = start;
    let d = dmg;
    for (let i = 0; i <= bounces && cur; i++) {
      pts.push({ x: cur.x, y: cur.y });
      hit.add(cur);
      damageEnemy(cur, d, 0, 0);
      sparks(cur.x, cur.y, '#bfe8ff', 4, 220);
      d *= 0.9;
      cur = nearestEnemy(cur.x, cur.y, hit, range);
    }
    chains.push({ pts, life: 0.3 });
  }

  function explode(x, y, radius, dmg, burn) {
    Sound.play('explosion');
    areaDamage(x, y, radius, dmg, 220);
    explosions.push({ x, y, r: radius, life: 0.4 });
    sparks(x, y, '#ffb347', 14, 320);
    smoke(x, y, 5, '#5a4a40');
    if (burn) hazards.push({ x, y, r: radius * 0.8, life: 2.5, tick: 0, dmg: Math.round(dmg * 0.15) });
    shake = Math.max(shake, 4);
  }

  function steer(p, target, dt) {
    const desired = Math.atan2(target.y - p.y, target.x - p.x);
    const cur = Math.atan2(p.vy, p.vx);
    let diff = desired - cur;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const a = cur + clamp(diff, -p.turn * dt, p.turn * dt);
    p.vx = Math.cos(a) * p.speed;
    p.vy = Math.sin(a) * p.speed;
  }

  function updateProjectiles(dt) {
    for (const p of projectiles) {
      // Flechas e facas perseguem o alvo até acertar o primeiro; depois seguem reto atravessando.
      if ((p.kind === 'arrow' || p.kind === 'knife') && p.hit.size === 0) {
        if (!p.target || p.target.dead) p.target = nearestEnemy(p.x, p.y, p.hit, 500);
        if (p.target) steer(p, p.target, dt);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.kind === 'missil' && Math.random() < 0.5) {
        fx({ kind: 'dot', add: true, x: p.x, y: p.y, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.25, color: '#7fe8ff', size: rand(1.5, 3) });
      }

      if (p.kind === 'fireball') {
        const reached = Math.hypot(p.tx - p.x, p.ty - p.y) < 14;
        let touched = reached || p.life <= 0;
        if (!touched) {
          for (const e of enemies) {
            if (e.dead) continue;
            const rr = e.r + p.r;
            if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) { touched = true; break; }
          }
        }
        if (touched) {
          explode(p.x, p.y, p.radius, p.dmg, p.burn);
          p.life = 0;
        } else {
          fx({ kind: 'dot', add: true, x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), vx: -p.vx * 0.1 + rand(-20, 20), vy: -p.vy * 0.1 + rand(-20, 20), life: 0.3, color: Math.random() < 0.5 ? '#ff7a1a' : '#ffd36b', size: rand(2.5, 5) });
        }
        continue;
      }

      if (p.life <= 0) continue;
      for (const e of enemies) {
        if (e.dead || p.hit.has(e)) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const rr = e.r + p.r;
        if (dx * dx + dy * dy < rr * rr) {
          p.hit.add(e);
          damageEnemy(e, p.dmg, p.vx * 0.3, p.vy * 0.3);
          if (p.pierce <= 0) { p.life = 0; break; }
          p.pierce--;
        }
      }
    }
    projectiles = projectiles.filter((p) => p.life > 0);
  }

  function updateRings(dt) {
    for (const ring of rings) {
      if (ring.delay > 0) {
        ring.delay -= dt;
        // A segunda onda acompanha o jogador até disparar.
        ring.x = player.x;
        ring.y = player.y;
        continue;
      }
      ring.r += 520 * dt;
      for (const e of enemies) {
        if (e.dead || ring.hit.has(e)) continue;
        const dx = e.x - ring.x;
        const dy = e.y - ring.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < ring.r + e.r) {
          ring.hit.add(e);
          damageEnemy(e, ring.dmg, (dx / d) * ring.knock, (dy / d) * ring.knock);
        }
      }
    }
    rings = rings.filter((r) => r.r < r.maxR);
  }

  function updateHazards(dt) {
    for (const h of hazards) {
      h.life -= dt;
      h.tick -= dt;
      if (h.tick <= 0) {
        h.tick = 0.4;
        areaDamage(h.x, h.y, h.r, h.dmg, 0);
      }
      if (Math.random() < dt * 20) {
        const a = rand(0, TAU);
        const d = rand(0, h.r);
        fx({ kind: 'dot', add: true, x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d * 0.6, vy: rand(-60, -30), life: rand(0.3, 0.6), color: '#ff8a2a', size: rand(2, 4), drag: 0.97 });
      }
    }
    hazards = hazards.filter((h) => h.life > 0);
  }

  function updateStrikes(dt) {
    for (const s of strikes) {
      s.t -= dt;
      if (s.t <= 0.45 && !s.whistled) {
        s.whistled = true;
        Sound.play('whistle');
      }
      if (s.t > 0) continue;
      Sound.play('explosion');
      explosions.push({ x: s.x, y: s.y, r: s.r, life: 0.4 });
      sparks(s.x, s.y, '#ffb347', 16, 340);
      smoke(s.x, s.y, 6, '#4a4040');
      shake = Math.max(shake, 6);
      const d = Math.hypot(player.x - s.x, player.y - s.y);
      if (d < s.r + player.r * 0.5 && player.invuln <= 0 && state === 'playing') hurtPlayer(s.dmg);
    }
    strikes = strikes.filter((s) => s.t > 0);
  }

  // ============================================================
  // Itens no chão (XP, moedas, corações e baús)
  // ============================================================
  function updatePickups(dt) {
    const magnet2 = player.magnet * player.magnet;
    for (const p of pickups) {
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const d2 = dx * dx + dy * dy;
      // Baús não são puxados pelo ímã: é preciso ir até eles.
      if (p.kind !== 'chest' && (p.pulled || d2 < magnet2)) {
        p.pulled = true;
        p.speed = (p.speed || 120) + 1400 * dt;
        const d = Math.sqrt(d2) || 1;
        const step = Math.min(d, p.speed * dt);
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
      const reach = player.r + (p.kind === 'chest' ? 18 : 8);
      if (d2 < reach * reach) {
        p.taken = true;
        if (p.kind === 'xp') {
          gainXp(p.v);
          Sound.play('gem');
          if (Math.random() < 0.3) sparks(player.x, player.y - 10, '#7fe0ff', 2, 120);
        } else if (p.kind === 'coin') {
          runCoins += p.v * player.coinMul;
          Sound.play('coin');
          sparks(player.x, player.y - 10, '#ffd36b', 4, 140);
        } else if (p.kind === 'chest') {
          pendingChests++;
          Sound.play('chest');
          sparks(p.x, p.y, '#ffd36b', 40, 360);
          ringFx(p.x, p.y, 70, '#ffd36b');
        } else {
          heal(p.v);
          Sound.play('heal');
          sparks(player.x, player.y - 15, '#6bff8a', 12, 200);
          addText(player.x, player.y - 40, '+' + p.v, '#6bff8a', true);
        }
      }
    }
    pickups = pickups.filter((p) => !p.taken);
  }

  // ============================================================
  // Atualização principal
  // ============================================================
  function update(dt) {
    time += dt;

    let mx = 0;
    let my = 0;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (stick.active) {
      const dx = stick.x - stick.ox;
      const dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        const k = Math.min(1, d / STICK_R);
        mx = (dx / d) * k;
        my = (dy / d) * k;
      }
    }
    const len = Math.hypot(mx, my);
    player.moving = len > 0.05;
    if (player.moving) {
      // No joystick, arrastar pouco anda devagar; no teclado é sempre velocidade máxima.
      const k = Math.min(1, len);
      player.dirX = mx / len;
      player.dirY = my / len;
      player.x += player.dirX * effSpeed() * k * dt;
      player.y += player.dirY * effSpeed() * k * dt;
      if (Math.abs(mx) > 0.1) player.facing = Math.sign(mx);
    }
    player.anim += dt;
    player.invuln -= dt;
    heal(effRegen() * dt);
    updateTrail(dt);
    // vagalumes de ambiente
    if (!lowQuality && Math.random() < dt * 4) {
      fx({ kind: 'dot', add: true, x: player.x + rand(-W / 2, W / 2), y: player.y + rand(-H / 2, H / 2), vx: rand(-14, 14), vy: rand(-14, 14), life: rand(2, 4), color: '#d8ff7a', size: rand(1.2, 2.2), drag: 1 });
    }

    updateSpawning(dt);
    updateStructures(dt);
    updateWeapons(dt);
    updateProjectiles(dt);
    updateRings(dt);
    updateHazards(dt);
    updateEnemies(dt);
    updateStrikes(dt);
    enemies = enemies.filter((e) => !e.dead);
    if (state !== 'playing') return; // morreu durante este quadro
    updatePickups(dt);

    if (pendingLevels > 0 || pendingChests > 0 || pendingShrines > 0) openChoices();
    updateMusic();
  }

  // Rastros do personagem: poeira ao andar e efeitos próprios de cada um.
  function updateTrail(dt) {
    trailT -= dt;
    if (trailT > 0) return;
    trailT = 0.07;
    const px = player.x;
    const py = player.y;
    if (player.moving && Math.random() < 0.6) {
      fx({ kind: 'smoke', x: px + rand(-6, 6), y: py - 2, vx: -player.dirX * 20, vy: rand(-15, -5), life: 0.45, color: '#b8a888', size: player.char === 'golem' ? 6 : 3.5, grow: 10, drag: 0.92 });
    }
    if (player.char === 'mago' && Math.random() < 0.7) {
      fx({ kind: 'dot', add: true, x: px + rand(-14, 14), y: py - rand(0, 30), vx: rand(-10, 10), vy: rand(10, 25), life: rand(0.5, 0.9), color: '#9ff0ff', size: rand(1.2, 2.4), drag: 0.98 });
    } else if (player.char === 'maniaco' && Math.random() < 0.5) {
      fx({ kind: 'spark', add: true, x: px + player.facing * 17, y: py - 20, vx: rand(-60, 60), vy: rand(-80, -20), life: 0.25, color: '#ffb020', size: 1.5, drag: 0.9 });
    } else if (player.char === 'golem' && golemRage() > 0.3 && Math.random() < golemRage()) {
      fx({ kind: 'dot', add: true, x: px + rand(-12, 12), y: py - rand(5, 30), vy: rand(-50, -20), life: rand(0.4, 0.8), color: '#ff7a1a', size: rand(1.5, 3), drag: 0.97 });
    }
  }

  function updateEffects(dt) {
    for (const p of particles) {
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grow) p.size += p.grow * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const t of texts) {
      t.y -= 45 * dt;
      t.x += t.vx * dt;
      t.life -= dt;
    }
    texts = texts.filter((t) => t.life > 0);
    for (const c of chains) c.life -= dt;
    chains = chains.filter((c) => c.life > 0);
    for (const x of explosions) x.life -= dt;
    explosions = explosions.filter((x) => x.life > 0);
    shake = Math.max(0, shake - dt * 30);
    hurtFlash = Math.max(0, hurtFlash - dt * 3);
    levelFx = Math.max(0, levelFx - dt * 1.5);
    hpGhost += (player.hp / player.maxHp - hpGhost) * Math.min(1, dt * 3);
  }

  // ============================================================
  // Desenho
  // ============================================================
  function drawPlayer() {
    const p = player;
    ctx.save();
    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    Art.drawHero(ctx, p.char, p.x, p.y, 1.15, p.anim, p.facing, { moving: p.moving, rage: golemRage() });
    ctx.restore();
    const bw = 36;
    const by = p.y + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(p.x - bw / 2 - 1.5, by - 1.5, bw + 3, 7);
    ctx.fillStyle = '#e04040';
    ctx.fillRect(p.x - bw / 2, by, bw * (p.hp / p.maxHp), 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(p.x - bw / 2, by, bw * (p.hp / p.maxHp), 1.5);
  }

  function drawEnemyFull(e) {
    Art.drawEnemy(ctx, e, player.x >= e.x ? 1 : -1);
    if (e.boss || e.type === 'skelknight') {
      const bw = e.r * 2;
      const y = e.y + e.r + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(e.x - bw / 2 - 1.5, y - 1.5, bw + 3, 8);
      ctx.fillStyle = e.boss ? '#ff4f8b' : '#ff9b4f';
      ctx.fillRect(e.x - bw / 2, y, bw * clamp(e.hp / e.maxHp, 0, 1), 5);
      if (e.boss) {
        ctx.font = `700 13px ${TITLE_FONT}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.strokeText(ENEMY_TYPES[e.type].name, e.x, y + 22);
        ctx.fillStyle = '#ffd36b';
        ctx.fillText(ENEMY_TYPES[e.type].name, e.x, y + 22);
      }
    }
  }

  function drawStructureLabel(s) {
    const d = Math.hypot(s.x - player.x, s.y - player.y);
    if (s.used || d > 240) return;
    const label = s.kind === 'totem' ? 'Fogueira' : 'Altar de Invocação';
    const sub = s.kind === 'totem' ? 'Fique perto para escolher uma bênção' : 'Invoca um chefão';
    const color = s.kind === 'totem' ? BONFIRE_COLOR : '#ff3355';
    const y = s.y - (s.kind === 'totem' ? 100 : 64);
    ctx.globalAlpha = clamp((240 - d) / 80, 0, 1);
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.font = `700 14px ${TITLE_FONT}`;
    ctx.strokeText(label, s.x, y);
    ctx.fillStyle = color;
    ctx.fillText(label, s.x, y);
    ctx.font = `700 11px ${FONT}`;
    ctx.strokeText(sub, s.x, y + 15);
    ctx.fillStyle = '#fff';
    ctx.fillText(sub, s.x, y + 15);
    ctx.globalAlpha = 1;
  }

  function drawStructureGround(s) {
    ctx.globalAlpha = clamp(s.fade, 0, 1);
    if (s.kind === 'totem') {
      // círculo de ativação no chão
      ctx.strokeStyle = s.used ? 'rgba(120,120,120,0.4)' : Art.rgba(BONFIRE_COLOR, 0.55);
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -time * 20;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      Art.bonfireGround(ctx, s.x, s.y, time, BONFIRE_COLOR, !s.used);
    } else {
      Art.altar(ctx, s.x, s.y, s.r, time, s.used);
    }
    if (!s.used && s.charge > 0) {
      const k = s.charge / s.need;
      Art.glow(ctx, s.x, s.y, s.r * 1.5, s.kind === 'totem' ? BONFIRE_COLOR : '#ff3355', k * 0.6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r + 8, (s.r + 8) * 0.6, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Setas na borda da tela apontando para fogueiras e altares fora de vista.
  function drawIndicators() {
    for (const s of structures) {
      if (s.used) continue;
      const dx = s.x - player.x;
      const dy = s.y - player.y;
      if (Math.abs(dx) < W / 2 - 20 && Math.abs(dy) < H / 2 - 20) continue;
      const a = Math.atan2(dy, dx);
      const m = 34;
      const c = Math.cos(a);
      const n = Math.sin(a);
      // A faixa de cima fica livre para o HUD.
      const top = 160;
      const t = Math.min((W / 2 - m) / (Math.abs(c) || 1e-6), ((H - top - m) / 2) / (Math.abs(n) || 1e-6));
      const sx = W / 2 + c * t;
      const sy = (top + H - m) / 2 + n * t;
      const color = s.kind === 'totem' ? BONFIRE_COLOR : '#ff3355';
      const pulse = 1 + Math.sin(time * 5) * 0.08;
      Art.glow(ctx, sx, sy, 26, color, 0.5);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, TAU);
      ctx.fillStyle = 'rgba(15,12,25,0.85)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(14, -6);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // miniatura: chama para fogueira, estrela para altar
      if (s.kind === 'totem') {
        Art.flame(ctx, sx, sy + 6, 4.5, 14 + Math.sin(time * 12) * 2, 0, color, '#fff3b0');
      } else {
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) {
          const ang = -Math.PI / 2 + (i * 2 * TAU) / 5;
          ctx.lineTo(sx + Math.cos(ang) * 7, sy + Math.sin(ang) * 7);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = `800 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      const label = Math.round(Math.hypot(dx, dy) / 10) + 'm';
      ctx.strokeText(label, sx, sy + 28);
      ctx.fillText(label, sx, sy + 28);
    }
  }

  function drawProjectile(p) {
    const a = Math.atan2(p.vy, p.vx);
    if (p.kind === 'missil') {
      Art.glow(ctx, p.x, p.y, 18, '#3fd0ff', 0.7);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      Art.poly(ctx, [11, 0, 1, -4, -9, 0, 1, 4], Art.lin(ctx, -9, 0, 11, 0, '#5fb0e8', '#ffffff'), 1.3);
      ctx.restore();
    } else if (p.kind === 'fireball') {
      Art.glow(ctx, p.x, p.y, 30, '#ff6a1a', 0.8);
      Art.ball(ctx, p.x, p.y, 7.5, '#ffa040', 0, false);
      Art.glow(ctx, p.x, p.y, 9, '#fff3c0', 1);
    } else if (p.kind === 'arrow') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.lineTo(-16, 0);
      ctx.stroke();
      ctx.strokeStyle = Art.OUT;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.strokeStyle = '#a8743e';
      ctx.lineWidth = 2;
      ctx.stroke();
      Art.poly(ctx, [15, 0, 6, -5, 6, 5], '#e8eef6', 1.3);
      Art.poly(ctx, [-12, -1, -18, -6, -16, -1], '#e04040', 1);
      Art.poly(ctx, [-12, 1, -18, 6, -16, 1], '#e04040', 1);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 28);
      Art.poly(ctx, [12, 0, -2, -4, -2, 4], Art.lin(ctx, -2, 0, 12, 0, '#8d96a2', '#ffffff'), 1.3);
      Art.poly(ctx, [-2, -2.5, -10, -2.5, -10, 2.5, -2, 2.5], '#7a3020', 1.2);
      ctx.restore();
    }
  }

  function drawParticles(additive) {
    if (additive) ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      if (!!p.add !== additive) continue;
      const k = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'spark') {
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = k * 0.35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = k * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * k + 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.7, 0, 0, TAU);
        ctx.stroke();
      } else if (p.kind === 'rock') {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = Art.OUT;
        ctx.lineWidth = 1;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.strokeRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (additive ? 1 : 0.8), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function render() {
    const sh = save.settings.shake ? shake : 0;
    const sx = sh > 0 ? rand(-sh, sh) : 0;
    const sy = sh > 0 ? rand(-sh, sh) : 0;
    const camX = player.x - W / 2 + sx;
    const camY = player.y - H / 2 + sy;
    const onScreen = (x, y, m) => x > camX - m && x < camX + W + m && y > camY - m && y < camY + H + m;
    const showPlayer = inRun;

    ctx.save();
    ctx.translate(-camX, -camY);
    Art.drawGround(ctx, camX, camY, W, H);

    // ---------- Camada do chão ----------
    for (const h of hazards) {
      Art.glow(ctx, h.x, h.y, h.r * 1.4, '#ff5a1a', 0.5 * clamp(h.life, 0, 1));
    }
    for (const s of structures) if (onScreen(s.x, s.y, 160)) drawStructureGround(s);

    if (weapons.aura) {
      const r = auraRadius(weapons.aura.level);
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.scale(1, 0.75);
      const gr = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      gr.addColorStop(0, 'rgba(255,230,120,0.02)');
      gr.addColorStop(0.85, `rgba(255,220,100,${0.16 + Math.sin(time * 4) * 0.04})`);
      gr.addColorStop(1, 'rgba(255,220,100,0.4)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,236,160,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = time * 0.8 + (i / 12) * TAU;
        Art.glow(ctx, Math.cos(a) * r, Math.sin(a) * r, 7, '#ffe27a', 0.6);
      }
      ctx.restore();
    }

    for (const ring of rings) {
      if (ring.delay > 0) continue;
      const k = 1 - ring.r / ring.maxR;
      ctx.save();
      ctx.translate(ring.x, ring.y);
      ctx.scale(1, 0.7);
      ctx.strokeStyle = `rgba(120,95,60,${k * 0.8})`;
      ctx.lineWidth = 16 * k + 3;
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(230,205,160,${k})`;
      ctx.lineWidth = 4 * k + 1;
      ctx.stroke();
      ctx.restore();
    }

    // marcas vermelhas onde os mísseis do robô vão cair
    for (const s of strikes) {
      const k = 1 - s.t / s.max;
      const pulse = 0.5 + Math.sin(time * 18) * 0.5;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(1, 0.7);
      ctx.fillStyle = `rgba(255,40,50,${0.12 + k * 0.25})`;
      ctx.beginPath();
      ctx.arc(0, 0, s.r * k, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,70,70,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
      ctx.moveTo(0, -12); ctx.lineTo(0, 12);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of pickups) {
      if (p.kind === 'chest' || !onScreen(p.x, p.y, 30)) continue;
      if (p.kind === 'xp') Art.drawGem(ctx, p, time);
      else if (p.kind === 'coin') Art.drawCoin(ctx, p, time);
      else Art.drawHeart(ctx, p, time);
    }

    // ---------- Camada de objetos, ordenada de cima para baixo ----------
    const list = [];
    for (const e of enemies) if (onScreen(e.x, e.y, 80)) list.push({ y: e.y, e });
    for (const s of structures) if (s.kind === 'totem' && onScreen(s.x, s.y, 120)) list.push({ y: s.y, s });
    for (const p of pickups) if (p.kind === 'chest' && onScreen(p.x, p.y, 80)) list.push({ y: p.y, c: p });
    if (showPlayer) list.push({ y: player.y, player: true });
    for (const pr of Art.propsInView(camX, camY, W, H)) list.push({ y: pr.y, prop: pr });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) {
      if (o.prop) {
        // fica transparente quando o jogador está atrás dele
        const p = o.prop;
        const h = Art.PROP_HEIGHT[p.type] || 0;
        const behind = showPlayer && h > 0 && player.y < p.y && player.y > p.y - h - 10 && Math.abs(player.x - p.x) < 34;
        Art.drawProp(ctx, p, time, behind ? 0.45 : 1);
      } else if (o.e) drawEnemyFull(o.e);
      else if (o.s) {
        ctx.globalAlpha = clamp(o.s.fade, 0, 1);
        Art.bonfireTop(ctx, o.s.x, o.s.y, time, BONFIRE_COLOR, !o.s.used);
        ctx.globalAlpha = 1;
      } else if (o.c) Art.drawChest(ctx, o.c.x, o.c.y, time);
      else drawPlayer();
    }

    // ---------- Armas e efeitos por cima ----------
    if (weapons.laminas) {
      const w = weapons.laminas;
      ctx.save();
      ctx.translate(player.x, player.y - 10);
      ctx.strokeStyle = 'rgba(220,235,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, w.radius || 65, 0, TAU);
      ctx.stroke();
      ctx.restore();
      for (const b of w.blades) {
        ctx.strokeStyle = 'rgba(220,235,255,0.28)';
        ctx.lineWidth = b.r * 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(player.x, player.y - 10, w.radius || 65, b.a - 0.55, b.a - 0.05);
        ctx.stroke();
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(time * 14);
        for (let i = 0; i < 3; i++) {
          ctx.rotate(TAU / 3);
          Art.poly(ctx, [0, -b.r * 0.4, b.r * 0.5, -b.r * 0.9, b.r * 1.5, -b.r * 0.3, b.r * 0.5, b.r * 0.15], Art.lin(ctx, 0, -b.r, 0, b.r * 0.2, '#ffffff', '#8d96a2'), 1.4);
        }
        Art.ball(ctx, 0, 0, b.r * 0.4, '#6f86ab', 1.2, false);
        ctx.restore();
      }
    }

    for (const p of projectiles) if (onScreen(p.x, p.y, 40)) drawProjectile(p);

    // mísseis do robô caindo
    for (const s of strikes) {
      if (s.t > 0.45) continue;
      const k = s.t / 0.45;
      const my = s.y - k * 520;
      Art.glow(ctx, s.x, my - 14, 26, '#ff8a2a', 0.8);
      Art.poly(ctx, [s.x - 5, my - 30, s.x + 5, my - 30, s.x + 5, my - 6, s.x, my + 4, s.x - 5, my - 6], Art.lin(ctx, s.x - 5, 0, s.x + 5, 0, '#e2e6ea', '#7c8590'), 1.5);
      Art.poly(ctx, [s.x - 5, my - 10, s.x + 5, my - 10, s.x, my + 4], '#ff4a3a', 1.2);
      Art.flame(ctx, s.x, my - 30, 5, 24, 0, '#ff7a1a', '#ffe08a');
    }

    Art.drawFog(ctx, camX, camY, W, H, time);

    for (const x of explosions) {
      const k = x.life / 0.4;
      Art.glow(ctx, x.x, x.y, x.r * (1.5 - k * 0.4), '#ff6a1a', k * 0.55);
      Art.glow(ctx, x.x, x.y, x.r * 0.5, '#ffd890', k * 0.5);
      ctx.strokeStyle = `rgba(255,200,120,${k})`;
      ctx.lineWidth = 4 * k + 1;
      ctx.beginPath();
      ctx.ellipse(x.x, x.y, x.r * (1.15 - k * 0.5), x.r * (1.15 - k * 0.5) * 0.7, 0, 0, TAU);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const c of chains) {
      const k = c.life / 0.3;
      const pts = [c.pts[0]];
      for (let i = 1; i < c.pts.length; i++) {
        const p0 = c.pts[i - 1];
        const p1 = c.pts[i];
        for (let s = 1; s <= 3; s++) {
          const t = s / 4;
          pts.push({ x: p0.x + (p1.x - p0.x) * t + rand(-9, 9), y: p0.y + (p1.y - p0.y) * t + rand(-9, 9) });
        }
        pts.push(p1);
      }
      for (const [lw, color] of [[9, `rgba(80,160,255,${k * 0.35})`], [3, `rgba(220,240,255,${k})`]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const c of chains) for (let i = 1; i < c.pts.length; i++) Art.glow(ctx, c.pts[i].x, c.pts[i].y, 22, '#8fd0ff', c.life / 0.3);

    drawParticles(false);
    drawParticles(true);

    // coluna de luz ao subir de nível
    if (levelFx > 0 && showPlayer) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, player.y - 220, 0, player.y);
      gr.addColorStop(0, 'rgba(255,220,120,0)');
      gr.addColorStop(1, `rgba(255,220,120,${levelFx * 0.6})`);
      ctx.fillStyle = gr;
      ctx.fillRect(player.x - 26 * levelFx, player.y - 220, 52 * levelFx, 220);
      ctx.restore();
      Art.glow(ctx, player.x, player.y - 10, 70, '#ffd36b', levelFx);
    }

    if (showPlayer) for (const s of structures) if (onScreen(s.x, s.y, 160)) drawStructureLabel(s);

    // números de dano com "pulo" ao aparecer
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of texts) {
      const pop = 1 + Math.max(0, t.life - 0.6) / 0.15 * 0.6;
      const size = (t.big ? 20 : 14) * pop / Math.sqrt(zoom);
      ctx.globalAlpha = clamp(t.life / 0.35, 0, 1);
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1a1222';
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ---------- Tela ----------
    Art.vignette(ctx, W, H);
    if (inRun) {
      const low = player.hp / player.maxHp < 0.3 ? (0.3 - player.hp / player.maxHp) / 0.3 : 0;
      const red = Math.max(hurtFlash * 0.6, low * (0.35 + Math.sin(time * 6) * 0.15));
      if (red > 0) {
        const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
        gr.addColorStop(0, 'rgba(200,0,20,0)');
        gr.addColorStop(1, `rgba(200,0,20,${red})`);
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
      }
      drawIndicators();
      drawStick();
      updateHud();
    }
  }

  function drawStick() {
    if (stick.active) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(stick.ox, stick.oy, STICK_R, 0, TAU);
      ctx.fillStyle = 'rgba(15,12,25,0.45)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      Art.ball(ctx, stick.x, stick.y, 24, '#ffd36b', 2.5);
      ctx.restore();
    } else if (isTouch && !stick.used && state === 'playing') {
      // dica até o jogador tocar a primeira vez
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(time * 4) * 0.3;
      ctx.textAlign = 'center';
      ctx.font = `900 22px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.strokeText('Toque e arraste para mover', W / 2, H - 90);
      ctx.fillStyle = '#fff';
      ctx.fillText('Toque e arraste para mover', W / 2, H - 90);
      ctx.restore();
    }
  }

  function updateHud() {
    $('xpfill').style.width = (100 * player.xp / player.xpNext) + '%';
    $('lvlbadge').textContent = player.level;
    $('hpfill').style.width = (100 * player.hp / player.maxHp) + '%';
    $('hpghost').style.width = (100 * Math.max(hpGhost, player.hp / player.maxHp)) + '%';
    $('hptext').textContent = Math.ceil(player.hp) + ' / ' + player.maxHp;
    $('timer').textContent = fmtTime(time);
    $('kills').textContent = kills;
    $('runcoins').textContent = Math.round(runCoins);

    const key = JSON.stringify([weapons, passiveLevels].map((o) => Object.entries(o).map(([k, v]) => k + (v.level || v))));
    if (key !== loadoutKey) {
      loadoutKey = key;
      const slot = (id, name, lv, max, cls) => {
        const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
        return `<div class="slot ${cls}" title="${name} · nível ${lv}"><img src="${Art.icon(id)}" alt=""><div class="pips">${pips}</div></div>`;
      };
      // Espaços vazios aparecem tracejados; os ainda não comprados, com cadeado.
      const empty = (n, cls) => `<div class="slot empty ${cls}"></div>`.repeat(Math.max(0, n));
      const locked = (n) => `<div class="slot lockedslot"><img src="${Art.icon('lock')}" alt=""></div>`.repeat(Math.max(0, n));
      const wN = Object.keys(weapons).length;
      const pN = Object.keys(passiveLevels).length;
      let html = '<div class="row">';
      for (const id in weapons) html += slot(id, WEAPONS[id].name, weapons[id].level, WEAPONS[id].max, 'weapon');
      html += empty(weaponSlots() - wN, 'weapon') + locked(MAX_WEAPON_SLOTS - weaponSlots());
      html += '</div><div class="row">';
      for (const id in passiveLevels) html += slot(id, PASSIVES[id].name, passiveLevels[id], PASSIVES[id].max, '');
      html += empty(passiveSlots() - pN, '') + locked(MAX_PASSIVE_SLOTS - passiveSlots());
      html += '</div>';
      $('loadout').innerHTML = html;
    }
  }

  // ============================================================
  // Laço principal
  // ============================================================
  let last = performance.now();
  let fpsAvg = 60;
  let slowT = 0;

  // Na qualidade automática, se o aparelho não aguentar (menos de ~40 quadros por
  // segundo por alguns segundos), reduz resolução, partículas e brilhos.
  function watchPerformance(rawDt) {
    if (save.settings.quality !== 'auto' || lowQuality || state !== 'playing' || rawDt <= 0 || rawDt > 0.5) return;
    fpsAvg += (1 / rawDt - fpsAvg) * 0.05;
    slowT = fpsAvg < 40 ? slowT + rawDt : Math.max(0, slowT - rawDt);
    if (slowT > 3) {
      lowQuality = true;
      maxParticles = 300;
      Art.setLowQuality(true);
      resize();
    }
  }

  function frame(now) {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    watchPerformance(rawDt);
    if (state === 'playing') {
      update(dt);
      updateEffects(dt);
    } else if (!inRun && state !== 'dead') {
      // Nos menus a câmera passeia devagar pelo mapa.
      player.x += 30 * dt;
      player.y += 12 * dt;
      time += dt;
      if (state === 'home') drawHomeArt(now / 1000);
      if (state === 'chars') drawPortraits(now / 1000);
    } else {
      // Pausado, escolhendo recompensa ou morto: os efeitos terminam suavemente.
      updateEffects(dt * 0.3);
    }
    render();
    requestAnimationFrame(frame);
  }

  applySettings();
  resetWorld();
  setState('home');
  requestAnimationFrame(frame);

  // Acesso para testes no console do navegador.
  window.__jogo = {
    get state() { return state; },
    get player() { return player; },
    get enemies() { return enemies; },
    get structures() { return structures; },
    get weapons() { return weapons; },
    get save() { return save; },
    get lowQuality() { return lowQuality; },
    get zoom() { return zoom; },
    gainXp, startGame, addWeapon, spawnBoss, spawnEnemy, selectChar, persist,
  };
})();
