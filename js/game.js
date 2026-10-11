'use strict';

(() => {
  // ============================================================
  // Configuração do canvas
  // ============================================================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  let W = 0;
  let H = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  // Hash determinístico para decorar o chão sempre do mesmo jeito.
  function hash(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ============================================================
  // Dados salvos no navegador (recorde e personagem escolhido)
  // ============================================================
  const SAVE_KEY = 'jogoteste.recorde';
  const CHAR_KEY = 'jogoteste.personagem';

  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY)) || { time: 0, level: 0, kills: 0 };
    } catch (e) {
      return { time: 0, level: 0, kills: 0 };
    }
  }

  function saveBest(best) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(best));
    } catch (e) {
      // sem armazenamento disponível: o recorde só não é salvo
    }
  }

  function loadChar() {
    try {
      const c = localStorage.getItem(CHAR_KEY);
      return CHARACTERS[c] ? c : 'mago';
    } catch (e) {
      return 'mago';
    }
  }

  function saveChar(c) {
    try {
      localStorage.setItem(CHAR_KEY, c);
    } catch (e) {
      // ignora
    }
  }

  // ============================================================
  // Personagens
  // ============================================================
  const CHARACTERS = {
    mago: {
      name: 'Mago', icon: '✦', r: 14,
      hp: 100, speed: 190, armor: 0, regen: 0, crit: 0.05, luck: 0,
      weapon: 'missil',
      desc: 'Equilibrado. Começa com o Míssil Arcano.',
      passive: 'Ganha +1 de Sorte a cada chefão derrotado.',
    },
    maniaco: {
      name: 'Maníaco', icon: '☠', r: 13,
      hp: 75, speed: 255, armor: 0, regen: 0, crit: 0.1, luck: 0,
      weapon: 'facas',
      desc: 'Muito ágil e frágil. Começa com as Facas.',
      passive: 'Ganha +1% de chance de crítico a cada nível.',
    },
    golem: {
      name: 'Golem de Pedra', icon: '⛰', r: 18,
      hp: 240, speed: 135, armor: 3, regen: 0.5, crit: 0.05, luck: 0,
      weapon: 'tremor',
      desc: 'Extremamente resistente, mas lento. Começa com o Tremor.',
      passive: 'Causa mais dano quanto menor a vida (até +120%).',
    },
  };

  // ============================================================
  // Armas
  // ============================================================
  const MAX_WEAPONS = 6;

  const WEAPONS = {
    missil: {
      name: 'Míssil Arcano', icon: '✦', max: 6,
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
      name: 'Arco Caçador', icon: '➶', max: 6,
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
      name: 'Facas', icon: '†', max: 6,
      desc: [
        'Arremessa facas na direção em que você anda.',
        '+1 faca.',
        'Arremessa mais rápido.',
        '+1 faca.',
        'Facas perfuram 1 inimigo.',
        '+1 faca e +dano.',
      ],
    },
    raio: {
      name: 'Raio em Cadeia', icon: 'ϟ', max: 6,
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
      name: 'Bola de Fogo', icon: '☄', max: 6,
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
      name: 'Lâminas Orbitais', icon: '⚙', max: 6,
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
      name: 'Aura Sagrada', icon: '☀', max: 6,
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
      name: 'Tremor de Pedra', icon: '◍', max: 6,
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
  // Passivas
  // ============================================================
  const PASSIVES = {
    vigor: { name: 'Vitalidade', icon: '❤', max: 5, desc: '+20 de vida máxima e cura 20.', apply: () => { player.maxHp += 20; heal(20); } },
    boots: { name: 'Botas Ágeis', icon: '»', max: 5, desc: '+10% de velocidade.', apply: () => { player.speed *= 1.1; } },
    might: { name: 'Força', icon: '⚔', max: 5, desc: '+15% de dano.', apply: () => { player.dmgMul += 0.15; } },
    haste: { name: 'Pressa', icon: '⧗', max: 5, desc: 'Armas recarregam 8% mais rápido.', apply: () => { player.cdMul *= 0.92; } },
    magnet: { name: 'Ímã', icon: '◉', max: 5, desc: '+35% de alcance para coletar XP.', apply: () => { player.magnet *= 1.35; } },
    regen: { name: 'Regeneração', icon: '✚', max: 5, desc: '+0,6 de vida por segundo.', apply: () => { player.regen += 0.6; } },
    armor: { name: 'Armadura', icon: '⛨', max: 5, desc: '-1 de dano recebido por golpe.', apply: () => { player.armor += 1; } },
    multi: { name: 'Projéteis', icon: '⁂', max: 3, desc: '+1 projétil, flecha, faca, lâmina, raio e bola de fogo.', apply: () => { player.extraProj += 1; } },
    precisao: { name: 'Precisão', icon: '◈', max: 5, desc: '+6% de chance de dano crítico (dano x2).', apply: () => { player.crit += 0.06; } },
    area: { name: 'Área de Acerto', icon: '◎', max: 5, desc: '+12% de área (aura, explosões, lâminas, ondas).', apply: () => { player.areaMul += 0.12; } },
    sorte: { name: 'Sorte', icon: '☘', max: 5, desc: '+1 de Sorte: recompensas raras, mais opções e mais itens.', apply: () => { player.luck += 1; } },
  };

  // ============================================================
  // Totens (buffs temporários)
  // ============================================================
  const TOTEMS = {
    furia: { name: 'Totem da Fúria', color: '#ff5a3c', desc: '+40% de dano', dur: 30 },
    vento: { name: 'Totem do Vento', color: '#7fe0ff', desc: '+30% de velocidade e recarga', dur: 30 },
    vida: { name: 'Totem da Vida', color: '#6bff8a', desc: 'Cura 40% e regenera 4/s', dur: 20 },
    ima: { name: 'Totem do Ímã', color: '#5fd3ff', desc: 'Puxa todo o XP do mapa', dur: 0 },
    sorte: { name: 'Totem da Sorte', color: '#ffd36b', desc: '+3 de Sorte', dur: 45 },
  };

  // ============================================================
  // Inimigos
  // ============================================================
  const ENEMY_TYPES = {
    slime: { name: 'Gosma', r: 12, hp: 14, speed: 55, dmg: 8, xp: 1, color: '#5fd35f' },
    bat: { name: 'Morcego', r: 9, hp: 8, speed: 115, dmg: 5, xp: 1, color: '#9a6ae0' },
    skeleton: { name: 'Esqueleto', r: 13, hp: 32, speed: 72, dmg: 12, xp: 2, color: '#e8e2cf' },
    brute: { name: 'Bruto', r: 22, hp: 130, speed: 46, dmg: 22, xp: 6, color: '#d0603a' },
    boss: { name: 'Rei Ogro', r: 40, hp: 1600, speed: 62, dmg: 35, xp: 60, color: '#c02060', boss: true },
    lich: { name: 'Lich', r: 34, hp: 1250, speed: 48, dmg: 30, xp: 60, color: '#4fc7b8', boss: true },
  };

  const MAX_ENEMIES = 320;
  const BOSS_INTERVAL = 180;

  // ============================================================
  // Estado do jogo
  // ============================================================
  let state = 'menu';
  let selectedChar = loadChar();
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
  let structures;
  let weapons;
  let passiveLevels;
  let time;
  let kills;
  let spawnAcc;
  let nextBoss;
  let nextSwarm;
  let bossesSpawned;
  let pendingLevels;
  let pendingChests;
  let structTimer;
  let shake;
  let loadoutKey = '';
  let buffsKey = '';
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
      crit: C.crit, luck: C.luck,
      xp: 0, level: 1, xpNext: xpForLevel(1),
      invuln: 0, facing: 1, dirX: 1, dirY: 0, moving: false, anim: 0,
      buffs: {}, bossKills: 0,
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
    structures = [];
    weapons = {};
    passiveLevels = {};
    time = 0;
    kills = 0;
    spawnAcc = 0;
    nextBoss = BOSS_INTERVAL;
    nextSwarm = 50;
    bossesSpawned = 0;
    pendingLevels = 0;
    pendingChests = 0;
    structTimer = 0;
    shake = 0;
    loadoutKey = '';
    buffsKey = '';
  }

  function xpForLevel(level) {
    return Math.floor(5 + (level - 1) * 4 + Math.pow(level - 1, 1.6));
  }

  // ---------- Atributos efetivos (com buffs e passivas de personagem) ----------
  const buffOn = (id) => (player.buffs[id] || 0) > 0;

  function effDmgMul() {
    let m = player.dmgMul;
    if (buffOn('furia')) m *= 1.4;
    if (player.char === 'golem') m *= 1 + (1 - player.hp / player.maxHp) * 1.2;
    return m;
  }
  const effCd = () => player.cdMul * (buffOn('vento') ? 0.77 : 1);
  const effSpeed = () => player.speed * (buffOn('vento') ? 1.3 : 1);
  const effLuck = () => player.luck + (buffOn('sorte') ? 3 : 0);
  const effRegen = () => player.regen + (buffOn('vida') ? 4 : 0);
  const bladeReduction = () => (weapons.laminas ? 0.06 * weapons.laminas.level : 0);

  // ============================================================
  // Entrada (teclado)
  // ============================================================
  const keys = new Set();

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

  function onKey(k) {
    if (state === 'menu') {
      if (k === 'enter' || k === ' ') startGame();
      const ids = Object.keys(CHARACTERS);
      const n = Number(k);
      if (n >= 1 && n <= ids.length) selectChar(ids[n - 1]);
    } else if (state === 'playing' && (k === 'escape' || k === 'p')) setState('paused');
    else if (state === 'paused' && (k === 'escape' || k === 'p')) setState('playing');
    else if (state === 'levelup' && ['1', '2', '3', '4'].includes(k)) choose(Number(k) - 1);
    else if (state === 'dead' && (k === 'r' || k === 'enter')) startGame();
  }

  // ============================================================
  // Telas
  // ============================================================
  function setState(s) {
    state = s;
    $('menu').classList.toggle('hidden', s !== 'menu');
    $('pause').classList.toggle('hidden', s !== 'paused');
    $('levelup').classList.toggle('hidden', s !== 'levelup');
    $('gameover').classList.toggle('hidden', s !== 'dead');
    $('hud').classList.toggle('hidden', s === 'menu');
    if (s === 'menu') renderMenu();
    if (s === 'paused') renderStats();
  }

  function renderMenu() {
    const b = loadBest();
    $('best').textContent = b.time > 0
      ? `Recorde: ${fmtTime(b.time)} · nível ${b.level} · ${b.kills} abates`
      : '';
    const box = $('chars');
    box.innerHTML = '';
    Object.keys(CHARACTERS).forEach((id, i) => {
      const C = CHARACTERS[id];
      const card = document.createElement('div');
      card.className = 'card char' + (id === selectedChar ? ' selected' : '');
      card.innerHTML = `
        <div class="icon">${C.icon}</div>
        <div class="name">${C.name}</div>
        <div class="tag">Vida ${C.hp} · Velocidade ${C.speed}${C.armor ? ' · Armadura ' + C.armor : ''}</div>
        <div class="desc">${C.desc}</div>
        <div class="desc passive">${C.passive}</div>
        <div class="key">Tecla ${i + 1}</div>`;
      card.addEventListener('click', () => selectChar(id));
      box.appendChild(card);
    });
  }

  function selectChar(id) {
    selectedChar = id;
    saveChar(id);
    resetWorld();
    renderMenu();
  }

  function renderStats() {
    const C = CHARACTERS[player.char];
    const rows = [
      ['Personagem', C.name],
      ['Vida', `${Math.ceil(player.hp)} / ${player.maxHp}`],
      ['Dano', `${Math.round(effDmgMul() * 100)}%`],
      ['Crítico', `${Math.round(player.crit * 100)}%`],
      ['Recarga', `${Math.round(effCd() * 100)}%`],
      ['Área', `${Math.round(player.areaMul * 100)}%`],
      ['Projéteis extras', player.extraProj],
      ['Velocidade', Math.round(effSpeed())],
      ['Armadura', player.armor],
      ['Redução de dano', `${Math.round(bladeReduction() * 100)}%`],
      ['Regeneração', `${effRegen().toFixed(1)}/s`],
      ['Sorte', effLuck()],
      ['Chefões derrotados', player.bossKills],
    ];
    $('pstats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }

  function startGame() {
    resetWorld();
    addWeapon(CHARACTERS[selectedChar].weapon, 1);
    // Um totem perto do início para o jogador descobrir a mecânica.
    spawnStructure('totem', 380);
    setState('playing');
  }

  function showBanner(text, color) {
    const el = $('banner');
    el.textContent = text;
    el.style.color = color || '#ff5c8a';
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  function gameOver() {
    const best = loadBest();
    const newRecord = time > best.time;
    if (newRecord) saveBest({ time, level: player.level, kills });
    $('stats').innerHTML = `
      <div>Personagem: <b>${CHARACTERS[player.char].name}</b></div>
      <div>Tempo sobrevivido: <b>${fmtTime(time)}</b>${newRecord ? ' <span class="new">Novo recorde!</span>' : ''}</div>
      <div>Nível alcançado: <b>${player.level}</b></div>
      <div>Inimigos derrotados: <b>${kills}</b></div>
      <div>Chefões derrotados: <b>${player.bossKills}</b></div>
      <div>Recorde: <b>${fmtTime(Math.max(time, best.time))}</b></div>`;
    setState('dead');
  }

  $('playBtn').addEventListener('click', startGame);
  $('restartBtn').addEventListener('click', startGame);
  $('resumeBtn').addEventListener('click', () => setState('playing'));
  $('quitBtn').addEventListener('click', () => { resetWorld(); setState('menu'); });
  $('menuBtn').addEventListener('click', () => { resetWorld(); setState('menu'); });

  // ============================================================
  // Subir de nível, baús e recompensas
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

  function buildChoices(isChest) {
    const pool = [];
    const ownedWeapons = Object.keys(weapons).length;
    for (const id in WEAPONS) {
      const lv = weapons[id] ? weapons[id].level : 0;
      if (lv >= WEAPONS[id].max) continue;
      if (lv === 0 && ownedWeapons >= MAX_WEAPONS) continue;
      pool.push({ kind: 'weapon', id, lv });
    }
    for (const id in PASSIVES) {
      const lv = passiveLevels[id] || 0;
      if (lv < PASSIVES[id].max) pool.push({ kind: 'passive', id, lv });
    }
    const count = 3 + (Math.random() < effLuck() * 0.08 ? 1 : 0);
    const picks = shuffle(pool).slice(0, count);
    for (const c of picks) {
      const max = c.kind === 'weapon' ? WEAPONS[c.id].max : PASSIVES[c.id].max;
      c.rarity = rollRarity(isChest ? 2 : 1);
      c.gain = Math.min(c.rarity, max - c.lv);
    }
    if (picks.length === 0) picks.push({ kind: 'heal', rarity: 1, gain: 1 });
    return picks;
  }

  function openChoices() {
    const isChest = pendingLevels <= 0 && pendingChests > 0;
    currentChoices = buildChoices(isChest);
    currentChoices.isChest = isChest;
    $('choiceTitle').textContent = isChest ? 'Baú do tesouro!' : 'Subiu de nível!';
    $('choiceSub').textContent = isChest ? 'Recompensas raras garantidas' : 'Escolha uma recompensa';
    const cards = $('cards');
    cards.innerHTML = '';
    currentChoices.forEach((c, i) => {
      let icon;
      let name;
      let tag;
      let desc;
      if (c.kind === 'weapon') {
        const def = WEAPONS[c.id];
        icon = def.icon; name = def.name; desc = def.desc[c.lv];
        tag = c.lv === 0 ? 'NOVA ARMA' : `Arma · nível ${c.lv + c.gain}`;
      } else if (c.kind === 'passive') {
        const def = PASSIVES[c.id];
        icon = def.icon; name = def.name; desc = def.desc;
        tag = c.lv === 0 ? 'NOVA PASSIVA' : `Passiva · nível ${c.lv + c.gain}`;
      } else {
        icon = '❤'; name = 'Poção'; tag = 'Consumível'; desc = 'Recupera 40 de vida.';
      }
      const rar = RARITY[c.rarity];
      const bonus = c.gain > 1 ? `<div class="bonus">${rar.name}: +${c.gain} níveis de uma vez!</div>` : '';
      const card = document.createElement('div');
      card.className = 'card ' + rar.cls;
      card.innerHTML = `
        <div class="icon">${icon}</div>
        <div class="name">${name}</div>
        <div class="tag">${tag}</div>
        <div class="desc">${desc}</div>
        ${bonus}
        <div class="key">Tecla ${i + 1}</div>`;
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
    } else heal(40);
    if (currentChoices.isChest) pendingChests--;
    else pendingLevels--;
    if (pendingLevels > 0 || pendingChests > 0) openChoices();
    else setState('playing');
  }

  function gainXp(v) {
    player.xp += v;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.level++;
      player.xpNext = xpForLevel(player.level);
      pendingLevels++;
      if (player.char === 'maniaco') player.crit += 0.01;
    }
  }

  function heal(v) {
    player.hp = Math.min(player.maxHp, player.hp + v);
  }

  // ============================================================
  // Efeitos visuais
  // ============================================================
  function addText(x, y, txt, color, big) {
    if (texts.length > 160) texts.shift();
    texts.push({ x: x + rand(-6, 6), y, txt, color, big: !!big, life: 0.7 });
  }

  function burst(x, y, color, n, speed) {
    if (particles.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), max: 0.6, color, size: rand(2, 4) });
    }
  }

  // ============================================================
  // Estruturas: totens e altares de invocação
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
        structures.push({ kind, type: pick(Object.keys(TOTEMS)), x, y, r: 55, charge: 0, need: 1.5, used: false, fade: 1 });
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
      if (totems < 3) spawnStructure('totem');
      if (altars < 1 && time > 20) spawnStructure('altar');
    }

    for (const s of structures) {
      if (s.used) {
        s.fade -= dt * 0.5;
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
    const T = TOTEMS[s.type];
    burst(s.x, s.y - 30, T.color, 30, 220);
    showBanner(`${T.name}: ${T.desc}`, T.color);
    if (s.type === 'vida') heal(player.maxHp * 0.4);
    if (s.type === 'ima') {
      for (const p of pickups) if (p.kind === 'xp') p.pulled = true;
    }
    if (T.dur > 0) player.buffs[s.type] = Math.max(player.buffs[s.type] || 0, T.dur);
  }

  function activateAltar(s) {
    burst(s.x, s.y, '#ff3355', 50, 280);
    shake = 10;
    spawnBoss(s.x + rand(-40, 40), s.y - 90, 1.3);
    showBanner('Você invocou um chefão!', '#ff3355');
  }

  // ============================================================
  // Inimigos
  // ============================================================
  function pickEnemyType() {
    const r = Math.random();
    if (time > 120 && r < 0.08) return 'brute';
    if (time > 60 && r < 0.3) return 'skeleton';
    if (time > 25 && r < 0.55) return 'bat';
    return 'slime';
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
    const e = {
      type, x, y, r: T.r, hp, maxHp: hp,
      speed: T.speed * (1 + Math.min(time / 600, 0.4)),
      dmg: T.dmg * (1 + (time / 240) * 0.3),
      xp: T.xp, color: T.color, boss: !!T.boss,
      flash: 0, kbx: 0, kby: 0, orbitCd: 0, phase: rand(0, TAU), summonT: 3, dead: false,
    };
    enemies.push(e);
    return e;
  }

  function spawnBoss(x, y, extraMul) {
    bossesSpawned++;
    const type = bossesSpawned % 2 === 0 ? 'lich' : 'boss';
    // Cada chefão seguinte é mais forte que o anterior.
    const mul = (1 + (bossesSpawned - 1) * 0.5) * (extraMul || 1);
    return spawnEnemy(type, x, y, mul);
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
      const type = time > 100 ? 'skeleton' : 'bat';
      for (let i = 0; i < n && enemies.length < MAX_ENEMIES + 40; i++) {
        const a = (i / n) * TAU;
        spawnEnemy(type, player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
      }
      showBanner('Cuidado, um enxame!');
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
    e.flash = 0.12;
    if (!e.boss) {
      e.kbx += kx || 0;
      e.kby += ky || 0;
    }
    addText(e.x, e.y - e.r, dmg, crit ? '#ffd23f' : '#ffffff', crit);
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    kills++;
    burst(e.x, e.y, e.color, e.boss ? 40 : 8, e.boss ? 260 : 140);
    if (e.boss) {
      for (let i = 0; i < 12; i++) dropXp(e.x + rand(-50, 50), e.y + rand(-50, 50), 5);
      pickups.push({ kind: 'chest', x: e.x, y: e.y });
      pickups.push({ kind: 'heart', x: e.x + 30, y: e.y, v: 50 });
      player.bossKills++;
      shake = 10;
      if (player.char === 'mago') {
        player.luck += 1;
        addText(player.x, player.y - 40, '+1 Sorte', '#ffd36b', true);
      }
      showBanner('Chefão derrotado! Pegue o baú.', '#ffd36b');
    } else {
      dropXp(e.x, e.y, e.xp);
      if (Math.random() < 0.012 * (1 + effLuck() * 0.25)) pickups.push({ kind: 'heart', x: e.x, y: e.y, v: 25 });
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
    shake = Math.max(shake, 6);
    addText(player.x, player.y - 24, dmg, '#ff5555', true);
    if (player.hp <= 0) {
      player.hp = 0;
      burst(player.x, player.y, '#4aa3ff', 30, 220);
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
      if (e.type === 'bat') {
        const w = Math.sin(time * 6 + e.phase) * 50;
        vx += -dy * w;
        vy += dx * w;
      }
      if (e.type === 'lich') {
        // O Lich invoca esqueletos ao seu redor.
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = 4;
          for (let i = 0; i < 4 && enemies.length < MAX_ENEMIES + 60; i++) {
            const a = (i / 4) * TAU;
            spawnEnemy('skeleton', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
          }
          burst(e.x, e.y, '#4fc7b8', 20, 180);
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
      const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 6) + player.extraProj;
      const dmg = 8 + 3 * lv + (lv >= 6 ? 6 : 0);
      const base = Math.atan2(target.y - player.y, target.x - player.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.16;
        projectiles.push({
          kind: 'missil', x: player.x, y: player.y,
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
      const dmg = 12 + 4 * lv + (lv >= 6 ? 8 : 0);
      const pierce = 2 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const t = targets[i % targets.length];
        const a = Math.atan2(t.y - player.y, t.x - player.x) + rand(-0.5, 0.5);
        projectiles.push({
          kind: 'arrow', x: player.x, y: player.y, speed: 560,
          vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
          r: 5, dmg, pierce, life: 2, hit: new Set(), target: t, turn: 9,
        });
      }
    },

    facas(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      w.timer = (lv >= 3 ? 0.32 : 0.45) * effCd();
      const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 6) + player.extraProj;
      const dmg = 7 + 3 * lv + (lv >= 6 ? 5 : 0);
      const base = Math.atan2(player.dirY, player.dirX);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.12 + rand(-0.04, 0.04);
        projectiles.push({
          kind: 'knife', x: player.x, y: player.y,
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          r: 5, dmg, pierce: lv >= 5 ? 1 : 0, life: 0.7, hit: new Set(),
        });
      }
    },

    raio(w, lv, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const starts = shuffle(enemiesOnScreen());
      if (!starts.length) { w.timer = 0.1; return; }
      w.timer = (lv >= 5 ? 1.5 : 2.2) * effCd();
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
      const n = 1 + (lv >= 4 ? 1 : 0) + player.extraProj;
      const radius = (60 + (lv >= 2 ? 15 : 0) + (lv >= 5 ? 25 : 0)) * player.areaMul;
      const dmg = 22 + 9 * lv + (lv >= 5 ? 12 : 0);
      for (let i = 0; i < n; i++) {
        const t = pick(options);
        const a = Math.atan2(t.y - player.y, t.x - player.x);
        projectiles.push({
          kind: 'fireball', x: player.x, y: player.y,
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
      w.blades = [];
      for (let i = 0; i < n; i++) {
        const a = w.angle + (i / n) * TAU;
        w.blades.push({ x: player.x + Math.cos(a) * radius, y: player.y + Math.sin(a) * radius, a, r: br });
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
      const ring = {
        x: player.x, y: player.y, r: 0,
        maxR: (125 + (lv >= 4 ? 50 : 0)) * player.areaMul,
        dmg: 15 + 7 * lv + (lv >= 2 ? 6 : 0) + (lv >= 5 ? 10 : 0),
        knock: lv >= 5 ? 420 : 300,
        hit: new Set(), delay: 0,
      };
      rings.push(ring);
      if (lv >= 6) rings.push({ ...ring, hit: new Set(), delay: 0.35 });
      shake = Math.max(shake, 2);
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
      d *= 0.9;
      cur = nearestEnemy(cur.x, cur.y, hit, range);
    }
    chains.push({ pts, life: 0.3 });
  }

  function explode(x, y, radius, dmg, burn) {
    areaDamage(x, y, radius, dmg, 220);
    explosions.push({ x, y, r: radius, life: 0.35 });
    burst(x, y, '#ff8a2a', 14, 200);
    if (burn) hazards.push({ x, y, r: radius * 0.8, life: 2.5, tick: 0, dmg: Math.round(dmg * 0.15) });
    shake = Math.max(shake, 3);
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
      // Flecha: persegue o alvo até acertar o primeiro; depois segue reto atravessando.
      if (p.kind === 'arrow' && p.hit.size === 0) {
        if (!p.target || p.target.dead) p.target = nearestEnemy(p.x, p.y, p.hit, 500);
        if (p.target) steer(p, p.target, dt);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

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
        } else if (Math.random() < 0.6) {
          particles.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, max: 0.3, color: '#ffb347', size: rand(3, 5) });
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
    }
    hazards = hazards.filter((h) => h.life > 0);
  }

  // ============================================================
  // Itens no chão (XP, corações e baús)
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
        if (p.kind === 'xp') gainXp(p.v);
        else if (p.kind === 'chest') pendingChests++;
        else {
          heal(p.v);
          addText(player.x, player.y - 30, '+' + p.v, '#6bff8a', true);
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
    const len = Math.hypot(mx, my);
    player.moving = len > 0;
    if (player.moving) {
      player.dirX = mx / len;
      player.dirY = my / len;
      player.x += player.dirX * effSpeed() * dt;
      player.y += player.dirY * effSpeed() * dt;
      if (mx !== 0) player.facing = Math.sign(mx);
    }
    player.anim += dt * (player.moving ? 10 : 3);
    player.invuln -= dt;
    heal(effRegen() * dt);
    for (const id in player.buffs) player.buffs[id] = Math.max(0, player.buffs[id] - dt);

    updateSpawning(dt);
    updateStructures(dt);
    updateWeapons(dt);
    updateProjectiles(dt);
    updateRings(dt);
    updateHazards(dt);
    updateEnemies(dt);
    enemies = enemies.filter((e) => !e.dead);
    if (state !== 'playing') return; // morreu durante este quadro
    updatePickups(dt);
    updateEffects(dt);

    if (pendingLevels > 0 || pendingChests > 0) openChoices();
  }

  function updateEffects(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const t of texts) {
      t.y -= 40 * dt;
      t.life -= dt;
    }
    texts = texts.filter((t) => t.life > 0);
    for (const c of chains) c.life -= dt;
    chains = chains.filter((c) => c.life > 0);
    for (const x of explosions) x.life -= dt;
    explosions = explosions.filter((x) => x.life > 0);
    shake = Math.max(0, shake - dt * 30);
  }

  // ============================================================
  // Desenho
  // ============================================================
  const TILE = 64;

  function drawGround(camX, camY) {
    const x0 = Math.floor(camX / TILE) - 1;
    const y0 = Math.floor(camY / TILE) - 1;
    const x1 = Math.floor((camX + W) / TILE) + 1;
    const y1 = Math.floor((camY + H) / TILE) + 1;
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        const h = hash(tx, ty);
        const px = tx * TILE;
        const py = ty * TILE;
        ctx.fillStyle = (tx + ty) & 1 ? '#2f5d34' : '#2d5932';
        ctx.fillRect(px, py, TILE, TILE);
        if (h > 0.9) {
          ctx.strokeStyle = '#3f7a45';
          ctx.lineWidth = 2;
          const gx = px + 16 + h * 30;
          const gy = py + 40;
          ctx.beginPath();
          ctx.moveTo(gx - 5, gy); ctx.lineTo(gx - 7, gy - 9);
          ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - 12);
          ctx.moveTo(gx + 5, gy); ctx.lineTo(gx + 7, gy - 9);
          ctx.stroke();
        } else if (h > 0.87) {
          ctx.fillStyle = '#5d6b64';
          ctx.beginPath();
          ctx.ellipse(px + 32, py + 34, 9, 6, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#7d8b84';
          ctx.beginPath();
          ctx.ellipse(px + 30, py + 32, 5, 3, 0, 0, TAU);
          ctx.fill();
        } else if (h > 0.84) {
          ctx.fillStyle = h > 0.855 ? '#f2d14b' : '#e9758f';
          ctx.beginPath();
          ctx.arc(px + 20 + h * 20, py + 20, 3, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function shadow(x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * 0.9, r * 0.35, 0, 0, TAU);
    ctx.fill();
  }

  function drawStructure(s) {
    ctx.globalAlpha = clamp(s.fade, 0, 1);
    if (s.kind === 'totem') {
      const T = TOTEMS[s.type];
      const color = s.used ? '#777' : T.color;
      // círculo de ativação
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      // pilar
      shadow(s.x, s.y - 4, 16);
      ctx.fillStyle = s.used ? '#4d4b52' : '#6d6a75';
      ctx.fillRect(s.x - 12, s.y - 44, 24, 48);
      ctx.fillStyle = s.used ? '#3d3b42' : '#5a5762';
      ctx.fillRect(s.x - 16, s.y - 48, 32, 8);
      ctx.fillRect(s.x - 16, s.y, 32, 6);
      // gema brilhante
      const glow = s.used ? 0 : 0.35 + Math.sin(time * 4) * 0.15;
      if (glow) {
        ctx.fillStyle = T.color;
        ctx.globalAlpha = glow * clamp(s.fade, 0, 1);
        ctx.beginPath();
        ctx.arc(s.x, s.y - 62, 18, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = clamp(s.fade, 0, 1);
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 74);
      ctx.lineTo(s.x + 9, s.y - 62);
      ctx.lineTo(s.x, s.y - 50);
      ctx.lineTo(s.x - 9, s.y - 62);
      ctx.closePath();
      ctx.fill();
    } else {
      const color = s.used ? '#555' : '#ff3355';
      ctx.fillStyle = s.used ? 'rgba(40,30,30,0.6)' : 'rgba(40,10,20,0.75)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      // estrela de cinco pontas
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * TAU) / 5;
        const px = s.x + Math.cos(a) * s.r * 0.8;
        const py = s.y + Math.sin(a) * s.r * 0.8;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // pilares com chamas
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * TAU) / 4;
        const px = s.x + Math.cos(a) * (s.r + 14);
        const py = s.y + Math.sin(a) * (s.r + 14);
        ctx.fillStyle = '#3c3640';
        ctx.fillRect(px - 6, py - 22, 12, 24);
        if (!s.used) {
          const f = Math.sin(time * 12 + i) * 2;
          ctx.fillStyle = '#ff5533';
          ctx.beginPath();
          ctx.ellipse(px, py - 28, 5, 8 + f, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#ffd36b';
          ctx.beginPath();
          ctx.ellipse(px, py - 26, 2.5, 4, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    // progresso de ativação
    if (!s.used && s.charge > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * (s.charge / s.need));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Setas na borda da tela apontando para totens e altares fora de vista.
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
      // A faixa de cima fica livre para o HUD (vida, armas e buffs).
      const top = 160;
      const t = Math.min((W / 2 - m) / (Math.abs(c) || 1e-6), ((H - top - m) / 2) / (Math.abs(n) || 1e-6));
      const sx = W / 2 + c * t;
      const sy = (top + H - m) / 2 + n * t;
      const color = s.kind === 'totem' ? TOTEMS[s.type].color : '#ff3355';
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(Math.hypot(dx, dy) / 10) + 'm', sx, sy + 24);
    }
  }

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return;
    const bob = p.moving ? Math.sin(p.anim) * 2 : Math.sin(p.anim);
    const f = p.facing;
    const x = p.x;
    const y = p.y + bob;
    shadow(p.x, p.y, p.r);

    if (p.char === 'mago') {
      ctx.fillStyle = '#2b5fb8';
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f1c9a0';
      ctx.beginPath();
      ctx.arc(x + f * 3, y - 3, p.r * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x + f * 5 - 3, y - 5, 2, 3);
      ctx.fillRect(x + f * 5 + 2, y - 5, 2, 3);
      ctx.fillStyle = '#1f478c';
      ctx.beginPath();
      ctx.moveTo(x - 13, y - 8);
      ctx.lineTo(x + 13, y - 8);
      ctx.lineTo(x - f * 6, y - 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd36b';
      ctx.fillRect(x - 13, y - 10, 26, 3);
    } else if (p.char === 'maniaco') {
      // capuz escuro, máscara branca e olhos vermelhos
      ctx.fillStyle = '#3a1418';
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#25090c';
      ctx.beginPath();
      ctx.arc(x, y - 4, p.r * 0.85, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = '#eee8dc';
      ctx.beginPath();
      ctx.ellipse(x + f * 3, y - 2, p.r * 0.5, p.r * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e01b2c';
      ctx.fillRect(x + f * 5 - 4, y - 5, 3, 3);
      ctx.fillRect(x + f * 5 + 2, y - 5, 3, 3);
      ctx.strokeStyle = '#25090c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + f * 3 - 4, y + 3);
      ctx.lineTo(x + f * 3 + 4, y + 3);
      ctx.stroke();
    } else {
      // golem: pedra com rachaduras, musgo e olhos em brasa
      ctx.fillStyle = '#7a7470';
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5f5955';
      ctx.beginPath();
      ctx.arc(x - f * 10, y + 4, p.r * 0.45, 0, TAU);
      ctx.arc(x + f * 12, y + 6, p.r * 0.35, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5c8a3a';
      ctx.beginPath();
      ctx.ellipse(x - 4, y - p.r + 3, 9, 4, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#3e3936';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 2); ctx.lineTo(x - 1, y + 8); ctx.lineTo(x + 4, y + 5);
      ctx.stroke();
      const rage = 1 - p.hp / p.maxHp;
      ctx.fillStyle = `rgb(255,${Math.round(180 - rage * 150)},40)`;
      ctx.fillRect(x + f * 5 - 6, y - 5, 4, 3);
      ctx.fillRect(x + f * 5 + 2, y - 5, 4, 3);
    }

    // barra de vida embaixo do jogador
    const bw = 34;
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x - bw / 2 - 1, p.y + p.r + 7, bw + 2, 6);
    ctx.fillStyle = '#e04040';
    ctx.fillRect(p.x - bw / 2, p.y + p.r + 8, bw * (p.hp / p.maxHp), 4);
  }

  function drawEnemy(e) {
    shadow(e.x, e.y, e.r);
    const white = e.flash > 0;
    const col = white ? '#ffffff' : e.color;
    const x = e.x;
    const y = e.y;
    const r = e.r;
    const face = player.x >= x ? 1 : -1;

    if (e.type === 'slime') {
      const sq = Math.sin(e.phase * 6) * 0.12;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, r * (1 + sq), r * (0.85 - sq), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.3, r * 0.25, 0, TAU);
      ctx.fill();
    } else if (e.type === 'bat') {
      const flap = Math.sin(e.phase * 18) * 6;
      ctx.fillStyle = white ? '#fff' : '#5a3c8c';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - r * 2.2, y - 4 - flap);
      ctx.lineTo(x - r * 1.2, y + 4);
      ctx.moveTo(x, y);
      ctx.lineTo(x + r * 2.2, y - 4 - flap);
      ctx.lineTo(x + r * 1.2, y + 4);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    } else if (e.type === 'skeleton') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.arc(x + face * 2 - 4, y - 2, 3, 0, TAU);
      ctx.arc(x + face * 2 + 4, y - 2, 3, 0, TAU);
      ctx.fill();
      ctx.fillRect(x + face * 2 - 4, y + 5, 8, 2);
    } else if (e.type === 'lich') {
      // manto com capuz e coroa de ossos
      ctx.fillStyle = white ? '#fff' : '#22324a';
      ctx.beginPath();
      ctx.moveTo(x - r, y + r);
      ctx.lineTo(x, y - r * 1.2);
      ctx.lineTo(x + r, y + r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 0.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8e2cf';
      for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 7 - 2, y - r * 0.95, 4, 10);
    } else if (e.type === 'brute' || e.type === 'boss') {
      ctx.fillStyle = white ? '#fff' : '#efe3c0';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.5);
      ctx.lineTo(x - r * 0.9, y - r * 1.3);
      ctx.lineTo(x - r * 0.3, y - r * 0.8);
      ctx.moveTo(x + r * 0.7, y - r * 0.5);
      ctx.lineTo(x + r * 0.9, y - r * 1.3);
      ctx.lineTo(x + r * 0.3, y - r * 0.8);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (e.boss) {
        ctx.fillStyle = '#ffd36b';
        ctx.beginPath();
        ctx.moveTo(x - 16, y - r + 4);
        ctx.lineTo(x - 16, y - r - 12);
        ctx.lineTo(x - 8, y - r - 4);
        ctx.lineTo(x, y - r - 14);
        ctx.lineTo(x + 8, y - r - 4);
        ctx.lineTo(x + 16, y - r - 12);
        ctx.lineTo(x + 16, y - r + 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (e.type !== 'skeleton') {
      const es = Math.max(2, r * 0.16);
      ctx.fillStyle = e.type === 'slime' ? '#123d12' : e.type === 'lich' ? '#9ffcff' : '#ffef5a';
      const ey = e.type === 'lich' ? y - r * 0.35 : y - r * 0.15;
      ctx.fillRect(x + face * r * 0.2 - r * 0.35, ey, es, es + 1);
      ctx.fillRect(x + face * r * 0.2 + r * 0.2, ey, es, es + 1);
    }

    if (e.boss || e.type === 'brute') {
      const bw = e.r * 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - bw / 2 - 1, y + r + 6, bw + 2, 6);
      ctx.fillStyle = e.boss ? '#ff4f8b' : '#ff9b4f';
      ctx.fillRect(x - bw / 2, y + r + 7, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
      if (e.boss) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ENEMY_TYPES[e.type].name, x, y + r + 26);
      }
    }
  }

  function drawPickup(p) {
    if (p.kind === 'heart') {
      const s = 7;
      ctx.fillStyle = '#ff4f6a';
      ctx.beginPath();
      ctx.arc(p.x - s / 2, p.y - s / 3, s / 1.6, 0, TAU);
      ctx.arc(p.x + s / 2, p.y - s / 3, s / 1.6, 0, TAU);
      ctx.moveTo(p.x - s * 1.1, p.y);
      ctx.lineTo(p.x, p.y + s * 1.2);
      ctx.lineTo(p.x + s * 1.1, p.y);
      ctx.fill();
      return;
    }
    if (p.kind === 'chest') {
      const bob = Math.sin(time * 3) * 2;
      shadow(p.x, p.y + 4, 16);
      ctx.fillStyle = '#ffd36b';
      ctx.globalAlpha = 0.25 + Math.sin(time * 5) * 0.1;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 28, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(p.x - 16, p.y - 10 + bob, 32, 22);
      ctx.fillStyle = '#a8703a';
      ctx.fillRect(p.x - 16, p.y - 16 + bob, 32, 8);
      ctx.fillStyle = '#ffd36b';
      ctx.fillRect(p.x - 16, p.y - 9 + bob, 32, 3);
      ctx.fillRect(p.x - 3, p.y - 10 + bob, 6, 9);
      return;
    }
    const big = p.v >= 5;
    const s = big ? 7 : 4.5;
    ctx.fillStyle = big ? '#ff6bd5' : p.v >= 2 ? '#5fffb0' : '#5fd3ff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.3);
    ctx.lineTo(p.x + s, p.y);
    ctx.lineTo(p.x, p.y + s * 1.3);
    ctx.lineTo(p.x - s, p.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawProjectile(p) {
    const a = Math.atan2(p.vy, p.vx);
    if (p.kind === 'missil') {
      ctx.fillStyle = '#b07aff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f2e6ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.6, 0, TAU);
      ctx.fill();
    } else if (p.kind === 'fireball') {
      ctx.fillStyle = 'rgba(255,120,30,0.45)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.45, 0, TAU);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      if (p.kind === 'arrow') {
        ctx.strokeStyle = '#8a5a2b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.fillStyle = '#d9e4f2';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(6, -5);
        ctx.lineTo(6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e04040';
        ctx.fillRect(-18, -4, 6, 3);
        ctx.fillRect(-18, 1, 6, 3);
      } else {
        ctx.fillStyle = '#cfd8e3';
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-3, -4);
        ctx.lineTo(-3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(-9, -2, 6, 4);
      }
      ctx.restore();
    }
  }

  function render() {
    const sx = shake > 0 ? rand(-shake, shake) : 0;
    const sy = shake > 0 ? rand(-shake, shake) : 0;
    const camX = player.x - W / 2 + sx;
    const camY = player.y - H / 2 + sy;
    const onScreen = (x, y, m) => x > camX - m && x < camX + W + m && y > camY - m && y < camY + H + m;

    ctx.save();
    ctx.translate(-camX, -camY);
    drawGround(camX, camY);

    for (const h of hazards) {
      ctx.fillStyle = `rgba(255,90,20,${0.18 + Math.sin(time * 10 + h.x) * 0.05})`;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, TAU);
      ctx.fill();
    }

    for (const s of structures) if (onScreen(s.x, s.y, 120)) drawStructure(s);
    for (const p of pickups) if (onScreen(p.x, p.y, 30)) drawPickup(p);

    if (weapons.aura) {
      const r = auraRadius(weapons.aura.level);
      const pulse = 0.12 + Math.sin(time * 4) * 0.03;
      ctx.fillStyle = `rgba(255,230,120,${pulse})`;
      ctx.strokeStyle = 'rgba(255,230,120,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    for (const ring of rings) {
      if (ring.delay > 0) continue;
      const a = 1 - ring.r / ring.maxR;
      ctx.strokeStyle = `rgba(200,170,120,${a})`;
      ctx.lineWidth = 12 * a + 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
      ctx.stroke();
    }

    // desenha de cima para baixo para dar sensação de profundidade
    const visible = enemies.filter((e) => onScreen(e.x, e.y, 60));
    visible.sort((a, b) => a.y - b.y);
    let playerDrawn = state === 'menu';
    for (const e of visible) {
      if (!playerDrawn && e.y > player.y) { drawPlayer(); playerDrawn = true; }
      drawEnemy(e);
    }
    if (!playerDrawn) drawPlayer();

    if (weapons.laminas) {
      for (const b of weapons.laminas.blades) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.a + time * 10);
        ctx.fillStyle = '#d9e4f2';
        ctx.beginPath();
        ctx.moveTo(0, -b.r * 1.4);
        ctx.lineTo(b.r * 0.5, 0);
        ctx.lineTo(0, b.r * 1.4);
        ctx.lineTo(-b.r * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    for (const p of projectiles) if (onScreen(p.x, p.y, 30)) drawProjectile(p);

    for (const x of explosions) {
      const k = x.life / 0.35;
      ctx.fillStyle = `rgba(255,140,40,${k * 0.5})`;
      ctx.beginPath();
      ctx.arc(x.x, x.y, x.r * (1.1 - k * 0.3), 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,240,180,${k * 0.6})`;
      ctx.beginPath();
      ctx.arc(x.x, x.y, x.r * 0.45 * (1.1 - k * 0.3), 0, TAU);
      ctx.fill();
    }

    for (const c of chains) {
      const a = c.life / 0.3;
      ctx.strokeStyle = `rgba(200,230,255,${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c.pts[0].x, c.pts[0].y);
      for (let i = 1; i < c.pts.length; i++) {
        const p0 = c.pts[i - 1];
        const p1 = c.pts[i];
        // segmento em zigue-zague para parecer eletricidade
        for (let k = 1; k <= 3; k++) {
          const t = k / 4;
          ctx.lineTo(p0.x + (p1.x - p0.x) * t + rand(-8, 8), p0.y + (p1.y - p0.y) * t + rand(-8, 8));
        }
        ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(160,210,255,${a * 0.6})`;
      for (let i = 1; i < c.pts.length; i++) {
        ctx.beginPath();
        ctx.arc(c.pts[i].x, c.pts[i].y, 10, 0, TAU);
        ctx.fill();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    for (const t of texts) {
      ctx.globalAlpha = clamp(t.life / 0.4, 0, 1);
      ctx.font = `bold ${t.big ? 18 : 13}px "Segoe UI", sans-serif`;
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (state !== 'menu') {
      drawIndicators();
      updateHud();
    }
  }

  function updateHud() {
    $('xpfill').style.width = (100 * player.xp / player.xpNext) + '%';
    $('lvltext').textContent = 'Nv ' + player.level;
    $('hpfill').style.width = (100 * player.hp / player.maxHp) + '%';
    $('hptext').textContent = Math.ceil(player.hp) + ' / ' + player.maxHp;
    $('timer').textContent = fmtTime(time);
    $('kills').textContent = 'Abates: ' + kills;

    const key = JSON.stringify([weapons, passiveLevels].map((o) => Object.entries(o).map(([k, v]) => k + (v.level || v))));
    if (key !== loadoutKey) {
      loadoutKey = key;
      let html = '';
      for (const id in weapons) {
        html += `<div class="slot weapon" title="${WEAPONS[id].name}">${WEAPONS[id].icon}<span class="lv">${weapons[id].level}</span></div>`;
      }
      for (const id in passiveLevels) {
        html += `<div class="slot" title="${PASSIVES[id].name}">${PASSIVES[id].icon}<span class="lv">${passiveLevels[id]}</span></div>`;
      }
      $('loadout').innerHTML = html;
    }

    const active = Object.keys(player.buffs).filter((id) => player.buffs[id] > 0);
    const bkey = active.map((id) => id + Math.ceil(player.buffs[id])).join();
    if (bkey !== buffsKey) {
      buffsKey = bkey;
      $('buffs').innerHTML = active.map((id) =>
        `<div class="buff" style="border-color:${TOTEMS[id].color}">${TOTEMS[id].desc} <b>${Math.ceil(player.buffs[id])}s</b></div>`).join('');
    }
  }

  // ============================================================
  // Laço principal
  // ============================================================
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'playing') {
      update(dt);
    } else if (state === 'menu') {
      // No menu a câmera passeia devagar pelo mapa.
      player.x += 30 * dt;
      player.y += 12 * dt;
      time += dt;
    }
    render();
    requestAnimationFrame(frame);
  }

  resetWorld();
  setState('menu');
  requestAnimationFrame(frame);

  // Acesso para testes no console do navegador.
  window.__jogo = {
    get state() { return state; },
    get player() { return player; },
    get enemies() { return enemies; },
    get structures() { return structures; },
    get weapons() { return weapons; },
    gainXp, startGame, addWeapon, spawnBoss, selectChar,
  };
})();
