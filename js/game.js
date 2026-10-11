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
  // Recorde salvo no navegador
  // ============================================================
  const SAVE_KEY = 'jogoteste.recorde';

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

  // ============================================================
  // Definições: armas, passivas e inimigos
  // ============================================================
  const WEAPONS = {
    bolt: {
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
    orbit: {
      name: 'Lâminas Orbitais', icon: '⚙', max: 6,
      desc: [
        'Lâminas giram ao seu redor.',
        '+1 lâmina.',
        '+Dano e giram mais rápido.',
        '+1 lâmina.',
        '+Alcance e dano.',
        '+1 lâmina.',
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
    nova: {
      name: 'Explosão de Fogo', icon: '✹', max: 6,
      desc: [
        'Explosão de fogo ao seu redor.',
        '+Dano.',
        'Recarrega mais rápido.',
        '+Raio.',
        '+Dano.',
        'Explosão dupla.',
      ],
    },
    lightning: {
      name: 'Raio', icon: 'ϟ', max: 6,
      desc: [
        'Raios atingem inimigos aleatórios.',
        '+1 raio.',
        '+Dano.',
        '+1 raio.',
        'Recarrega mais rápido.',
        '+2 raios.',
      ],
    },
  };

  const PASSIVES = {
    vigor: { name: 'Vitalidade', icon: '❤', max: 5, desc: '+20 de vida máxima e cura 20.', apply: () => { player.maxHp += 20; heal(20); } },
    boots: { name: 'Botas Ágeis', icon: '»', max: 5, desc: '+10% de velocidade.', apply: () => { player.speed *= 1.1; } },
    might: { name: 'Força', icon: '⚔', max: 5, desc: '+15% de dano.', apply: () => { player.dmgMul += 0.15; } },
    haste: { name: 'Pressa', icon: '⧗', max: 5, desc: 'Armas recarregam 8% mais rápido.', apply: () => { player.cdMul *= 0.92; } },
    magnet: { name: 'Ímã', icon: '◉', max: 5, desc: '+35% de alcance para coletar XP.', apply: () => { player.magnet *= 1.35; } },
    regen: { name: 'Regeneração', icon: '✚', max: 5, desc: '+0,6 de vida por segundo.', apply: () => { player.regen += 0.6; } },
    armor: { name: 'Armadura', icon: '⛨', max: 5, desc: '-1 de dano recebido.', apply: () => { player.armor += 1; } },
    area: { name: 'Amplitude', icon: '◎', max: 5, desc: '+12% de área das armas.', apply: () => { player.areaMul += 0.12; } },
    multi: { name: 'Duplicador', icon: '✕', max: 2, desc: '+1 projétil, lâmina e raio.', apply: () => { player.extraProj += 1; } },
    luck: { name: 'Sorte', icon: '☘', max: 5, desc: '+5% de chance de crítico (dano x2).', apply: () => { player.crit += 0.05; } },
  };

  const ENEMY_TYPES = {
    slime: { r: 12, hp: 14, speed: 55, dmg: 8, xp: 1, color: '#5fd35f' },
    bat: { r: 9, hp: 8, speed: 115, dmg: 5, xp: 1, color: '#9a6ae0' },
    skeleton: { r: 13, hp: 32, speed: 72, dmg: 12, xp: 2, color: '#e8e2cf' },
    brute: { r: 22, hp: 130, speed: 46, dmg: 22, xp: 6, color: '#d0603a' },
    boss: { r: 40, hp: 1600, speed: 62, dmg: 35, xp: 60, color: '#c02060', boss: true },
  };

  const MAX_ENEMIES = 320;
  const BOSS_INTERVAL = 180;

  // ============================================================
  // Estado do jogo
  // ============================================================
  let state = 'menu';
  let player;
  let enemies;
  let projectiles;
  let pickups;
  let particles;
  let texts;
  let rings;
  let strikes;
  let weapons;
  let passiveLevels;
  let time;
  let kills;
  let spawnAcc;
  let nextBoss;
  let nextSwarm;
  let pendingLevels;
  let shake;
  let loadoutKey = '';
  let currentChoices = [];
  let bannerTimer = null;

  function resetWorld() {
    player = {
      x: 0, y: 0, r: 14,
      hp: 100, maxHp: 100,
      speed: 190, regen: 0, armor: 0,
      magnet: 90, dmgMul: 1, cdMul: 1, areaMul: 1, extraProj: 0, crit: 0.05,
      xp: 0, level: 1, xpNext: xpForLevel(1),
      invuln: 0, facing: 1, moving: false, anim: 0,
    };
    enemies = [];
    projectiles = [];
    pickups = [];
    particles = [];
    texts = [];
    rings = [];
    strikes = [];
    weapons = {};
    passiveLevels = {};
    time = 0;
    kills = 0;
    spawnAcc = 0;
    nextBoss = BOSS_INTERVAL;
    nextSwarm = 50;
    pendingLevels = 0;
    shake = 0;
    loadoutKey = '';
  }

  function xpForLevel(level) {
    return Math.floor(5 + (level - 1) * 4 + Math.pow(level - 1, 1.6));
  }

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
    if (state === 'menu' && (k === 'enter' || k === ' ')) startGame();
    else if (state === 'playing' && (k === 'escape' || k === 'p')) setState('paused');
    else if (state === 'paused' && (k === 'escape' || k === 'p')) setState('playing');
    else if (state === 'levelup' && ['1', '2', '3'].includes(k)) choose(Number(k) - 1);
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
    if (s === 'menu') showBestOnMenu();
  }

  function showBestOnMenu() {
    const b = loadBest();
    $('best').textContent = b.time > 0
      ? `Recorde: ${fmtTime(b.time)} · nível ${b.level} · ${b.kills} abates`
      : '';
  }

  function startGame() {
    resetWorld();
    addWeapon('bolt');
    setState('playing');
  }

  function showBanner(text) {
    const el = $('banner');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  function gameOver() {
    const best = loadBest();
    const newRecord = time > best.time;
    if (newRecord) saveBest({ time, level: player.level, kills });
    $('stats').innerHTML = `
      <div>Tempo sobrevivido: <b>${fmtTime(time)}</b>${newRecord ? ' <span class="new">Novo recorde!</span>' : ''}</div>
      <div>Nível alcançado: <b>${player.level}</b></div>
      <div>Inimigos derrotados: <b>${kills}</b></div>
      <div>Recorde: <b>${fmtTime(Math.max(time, best.time))}</b></div>`;
    setState('dead');
  }

  $('playBtn').addEventListener('click', startGame);
  $('restartBtn').addEventListener('click', startGame);
  $('resumeBtn').addEventListener('click', () => setState('playing'));
  $('quitBtn').addEventListener('click', () => { resetWorld(); setState('menu'); });
  $('menuBtn').addEventListener('click', () => { resetWorld(); setState('menu'); });

  // ============================================================
  // Subir de nível e recompensas
  // ============================================================
  function addWeapon(id) {
    if (weapons[id]) weapons[id].level++;
    else weapons[id] = { level: 1, timer: 0.3, angle: 0, blades: [] };
  }

  function buildChoices() {
    const pool = [];
    for (const id in WEAPONS) {
      const lv = weapons[id] ? weapons[id].level : 0;
      if (lv < WEAPONS[id].max) pool.push({ kind: 'weapon', id, next: lv + 1 });
    }
    for (const id in PASSIVES) {
      const lv = passiveLevels[id] || 0;
      if (lv < PASSIVES[id].max) pool.push({ kind: 'passive', id, next: lv + 1 });
    }
    const picks = shuffle(pool).slice(0, 3);
    if (picks.length === 0) picks.push({ kind: 'heal' });
    return picks;
  }

  function openLevelUp() {
    currentChoices = buildChoices();
    const cards = $('cards');
    cards.innerHTML = '';
    currentChoices.forEach((c, i) => {
      let icon;
      let name;
      let tag;
      let desc;
      let isNew = false;
      if (c.kind === 'weapon') {
        const def = WEAPONS[c.id];
        icon = def.icon; name = def.name; desc = def.desc[c.next - 1];
        isNew = c.next === 1;
        tag = isNew ? 'NOVA ARMA' : `Arma · nível ${c.next}`;
      } else if (c.kind === 'passive') {
        const def = PASSIVES[c.id];
        icon = def.icon; name = def.name; desc = def.desc;
        isNew = c.next === 1;
        tag = isNew ? 'NOVO' : `Passiva · nível ${c.next}`;
      } else {
        icon = '❤'; name = 'Poção'; tag = 'Consumível'; desc = 'Recupera 40 de vida.';
      }
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="icon">${icon}</div>
        <div class="name">${name}</div>
        <div class="tag${isNew ? ' new' : ''}">${tag}</div>
        <div class="desc">${desc}</div>
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
    if (c.kind === 'weapon') addWeapon(c.id);
    else if (c.kind === 'passive') {
      passiveLevels[c.id] = (passiveLevels[c.id] || 0) + 1;
      PASSIVES[c.id].apply();
    } else heal(40);
    pendingLevels--;
    if (pendingLevels > 0) openLevelUp();
    else setState('playing');
  }

  function gainXp(v) {
    player.xp += v;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.level++;
      player.xpNext = xpForLevel(player.level);
      pendingLevels++;
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
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), max: 0.6, color, size: rand(2, 4) });
    }
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

  function spawnEnemy(type, x, y) {
    const T = ENEMY_TYPES[type];
    if (x === undefined) ({ x, y } = spawnPoint());
    const hpScale = 1 + (time / 60) * 0.45;
    const hp = T.hp * hpScale;
    enemies.push({
      type, x, y, r: T.r, hp, maxHp: hp,
      speed: T.speed * (1 + Math.min(time / 600, 0.4)),
      dmg: T.dmg * (1 + (time / 240) * 0.3),
      xp: T.xp, color: T.color, boss: !!T.boss,
      flash: 0, kbx: 0, kby: 0, orbitCd: 0, phase: rand(0, TAU), dead: false,
    });
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
      spawnEnemy('boss');
      showBanner('Um chefe apareceu!');
    }
  }

  function damageEnemy(e, base, kx, ky) {
    if (e.dead) return;
    let dmg = base * player.dmgMul;
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
      pickups.push({ kind: 'heart', x: e.x, y: e.y, v: 50 });
      shake = 10;
    } else {
      dropXp(e.x, e.y, e.xp);
      if (Math.random() < 0.012) pickups.push({ kind: 'heart', x: e.x, y: e.y, v: 25 });
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
    const dmg = Math.max(1, Math.round(amount - player.armor));
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

  function nearestEnemy() {
    let best = null;
    let bd = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
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

  // ============================================================
  // Armas
  // ============================================================
  function updateWeapons(dt) {
    for (const id in weapons) {
      const w = weapons[id];
      const lv = w.level;
      if (id === 'bolt') updateBolt(w, lv, dt);
      else if (id === 'orbit') updateOrbit(w, lv, dt);
      else if (id === 'aura') updateAura(w, lv, dt);
      else if (id === 'nova') updateNova(w, lv, dt);
      else if (id === 'lightning') updateLightning(w, lv, dt);
    }
  }

  function updateBolt(w, lv, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const target = nearestEnemy();
    if (!target) { w.timer = 0.1; return; }
    w.timer = (lv >= 3 ? 0.7 : 0.95) * player.cdMul;
    const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 6) + player.extraProj;
    const dmg = 8 + 3 * lv + (lv >= 6 ? 6 : 0);
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.16;
      projectiles.push({
        x: player.x, y: player.y,
        vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
        r: 6 * player.areaMul, dmg, pierce: lv >= 5 ? 2 : 0,
        life: 1.4, hit: new Set(),
      });
    }
  }

  function updateOrbit(w, lv, dt) {
    const n = 2 + (lv >= 2) + (lv >= 4) + (lv >= 6) + player.extraProj;
    const radius = (65 + (lv >= 5 ? 22 : 0)) * player.areaMul;
    const speed = 2.6 + (lv >= 3 ? 1.1 : 0);
    const dmg = 6 + 3 * lv + (lv >= 5 ? 4 : 0);
    const br = 10 * player.areaMul;
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
          damageEnemy(e, dmg, ((e.x - player.x) / kd) * 160, ((e.y - player.y) / kd) * 160);
          e.orbitCd = 0.35;
          break;
        }
      }
    }
  }

  function auraRadius(lv) {
    return (60 + 10 * lv) * player.areaMul;
  }

  function updateAura(w, lv, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = lv >= 5 ? 0.35 : 0.5;
    const radius = auraRadius(lv);
    const dmg = 4 + 2 * lv + (lv >= 5 ? 3 : 0);
    for (const e of enemies) {
      if (e.dead) continue;
      const rr = radius + e.r;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      if (dx * dx + dy * dy < rr * rr) damageEnemy(e, dmg, 0, 0);
    }
  }

  function updateNova(w, lv, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = (lv >= 3 ? 2.7 : 3.5) * player.cdMul;
    const ring = {
      x: player.x, y: player.y, r: 0,
      maxR: (130 + (lv >= 4 ? 50 : 0)) * player.areaMul,
      dmg: 18 + 8 * lv + (lv >= 5 ? 10 : 0),
      hit: new Set(), delay: 0,
    };
    rings.push(ring);
    if (lv >= 6) rings.push({ ...ring, hit: new Set(), delay: 0.35 });
  }

  function updateLightning(w, lv, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = (lv >= 5 ? 1.6 : 2.4) * player.cdMul;
    const n = 1 + (lv >= 2) + (lv >= 4) + (lv >= 6 ? 2 : 0) + player.extraProj;
    const dmg = 25 + 10 * lv;
    const area = 34 * player.areaMul;
    const targets = shuffle(enemiesOnScreen()).slice(0, n);
    for (const t of targets) {
      strikes.push({ x: t.x, y: t.y, life: 0.25, seed: Math.random() });
      for (const e of enemies) {
        if (e.dead) continue;
        const rr = area + e.r;
        const dx = e.x - t.x;
        const dy = e.y - t.y;
        if (dx * dx + dy * dy < rr * rr) damageEnemy(e, dmg, 0, 0);
      }
    }
    if (targets.length) shake = Math.max(shake, 3);
  }

  function updateProjectiles(dt) {
    for (const p of projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
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
        // A segunda explosão acompanha o jogador até disparar.
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
          damageEnemy(e, ring.dmg, (dx / d) * 260, (dy / d) * 260);
        }
      }
    }
    rings = rings.filter((r) => r.r < r.maxR);
  }

  // ============================================================
  // Itens no chão (XP e corações)
  // ============================================================
  function updatePickups(dt) {
    const magnet2 = player.magnet * player.magnet;
    for (const p of pickups) {
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (p.pulled || d2 < magnet2) {
        p.pulled = true;
        p.speed = (p.speed || 120) + 1400 * dt;
        const d = Math.sqrt(d2) || 1;
        p.x += (dx / d) * p.speed * dt;
        p.y += (dy / d) * p.speed * dt;
      }
      if (d2 < (player.r + 8) * (player.r + 8)) {
        p.taken = true;
        if (p.kind === 'xp') gainXp(p.v);
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
      player.x += (mx / len) * player.speed * dt;
      player.y += (my / len) * player.speed * dt;
      if (mx !== 0) player.facing = Math.sign(mx);
    }
    player.anim += dt * (player.moving ? 10 : 3);
    player.invuln -= dt;
    if (player.regen > 0) heal(player.regen * dt);

    updateSpawning(dt);
    updateWeapons(dt);
    updateProjectiles(dt);
    updateRings(dt);
    updateEnemies(dt);
    enemies = enemies.filter((e) => !e.dead);
    if (state !== 'playing') return; // morreu durante este quadro
    updatePickups(dt);
    updateEffects(dt);

    if (pendingLevels > 0) openLevelUp();
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
    for (const s of strikes) s.life -= dt;
    strikes = strikes.filter((s) => s.life > 0);
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
          // tufo de grama
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
          // pedra
          ctx.fillStyle = '#5d6b64';
          ctx.beginPath();
          ctx.ellipse(px + 32, py + 34, 9, 6, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#7d8b84';
          ctx.beginPath();
          ctx.ellipse(px + 30, py + 32, 5, 3, 0, 0, TAU);
          ctx.fill();
        } else if (h > 0.84) {
          // flor
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

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return;
    const bob = p.moving ? Math.sin(p.anim) * 2 : Math.sin(p.anim) * 1;
    shadow(p.x, p.y, p.r);
    // capa
    ctx.fillStyle = '#2b5fb8';
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, p.r, 0, TAU);
    ctx.fill();
    // rosto
    ctx.fillStyle = '#f1c9a0';
    ctx.beginPath();
    ctx.arc(p.x + p.facing * 3, p.y - 3 + bob, p.r * 0.55, 0, TAU);
    ctx.fill();
    // olhos
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(p.x + p.facing * 3 - 3 + p.facing * 2, p.y - 5 + bob, 2, 3);
    ctx.fillRect(p.x + p.facing * 3 + 2 + p.facing * 2, p.y - 5 + bob, 2, 3);
    // chapéu de mago
    ctx.fillStyle = '#1f478c';
    ctx.beginPath();
    ctx.moveTo(p.x - 13, p.y - 8 + bob);
    ctx.lineTo(p.x + 13, p.y - 8 + bob);
    ctx.lineTo(p.x - p.facing * 6, p.y - 30 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(p.x - 13, p.y - 10 + bob, 26, 3);

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
    } else if (e.type === 'brute' || e.type === 'boss') {
      // chifres
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

    // olhos (exceto esqueleto, que já tem órbitas)
    if (e.type !== 'skeleton') {
      const es = Math.max(2, r * 0.16);
      ctx.fillStyle = e.type === 'slime' ? '#123d12' : '#ffef5a';
      ctx.fillRect(x + face * r * 0.2 - r * 0.35, y - r * 0.15, es, es + 1);
      ctx.fillRect(x + face * r * 0.2 + r * 0.2, y - r * 0.15, es, es + 1);
    }

    if (e.boss || e.type === 'brute') {
      const bw = e.r * 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - bw / 2 - 1, y + r + 6, bw + 2, 6);
      ctx.fillStyle = e.boss ? '#ff4f8b' : '#ff9b4f';
      ctx.fillRect(x - bw / 2, y + r + 7, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
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

  function drawStrike(s) {
    const a = s.life / 0.25;
    ctx.strokeStyle = `rgba(200,230,255,${a})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    let x = s.x + (s.seed - 0.5) * 40;
    let y = s.y - 400;
    ctx.moveTo(x, y);
    for (let i = 1; i <= 8; i++) {
      x = s.x + (hash(Math.floor(s.seed * 1000), i) - 0.5) * 40 * (1 - i / 8);
      y = s.y - 400 + (400 * i) / 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(160,210,255,${a * 0.5})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 34 * player.areaMul, 0, TAU);
    ctx.fill();
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

    for (const p of pickups) if (onScreen(p.x, p.y, 20)) drawPickup(p);

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
      ctx.strokeStyle = `rgba(255,140,40,${a})`;
      ctx.lineWidth = 10 * a + 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
      ctx.stroke();
    }

    // desenha de cima para baixo para dar sensação de profundidade
    const visible = enemies.filter((e) => onScreen(e.x, e.y, 60));
    visible.sort((a, b) => a.y - b.y);
    let playerDrawn = false;
    for (const e of visible) {
      if (!playerDrawn && e.y > player.y) { drawPlayer(); playerDrawn = true; }
      drawEnemy(e);
    }
    if (!playerDrawn && state !== 'menu') drawPlayer();

    if (weapons.orbit) {
      for (const b of weapons.orbit.blades) {
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

    for (const p of projectiles) {
      ctx.fillStyle = '#b07aff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f2e6ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.6, 0, TAU);
      ctx.fill();
    }

    for (const s of strikes) drawStrike(s);

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

    if (state !== 'menu') updateHud();
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
  window.__jogo = { get state() { return state; }, get player() { return player; }, get enemies() { return enemies; }, gainXp, startGame };
})();
