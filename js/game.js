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
      chars: { mago: true, maniaco: false, golem: false, mercenario: false, berserker: false, arqueira: false, necromante: false },
      bought: {},
      char: 'mago',
      stage: 'cemiterio', // fase escolhida
      diff: 0, // dificuldade escolhida (0 Normal, 1 Difícil, 2 Pesadelo)
      stages: {}, // por fase: quantas dificuldades já foram concluídas
      version: 2, // 2 = moeda única
      tokens: 0, // (antigo) moedas de desafio
      challenges: {}, // desafios concluídos
      unlocks: {}, // armas e passivas liberadas com moedas de desafio
      stats: { bestTime: 0, bestLevel: 0, bestKills: 0, bosses: 0, kills: 0, runs: 0, elites: 0, bestThreat: 0, coinsTotal: 0, winChars: {} },
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
      if (raw) {
        const m = merge(s, raw);
        // versão 2: moeda única. Converte as moedas antigas e as de desafio.
        // opções compradas na versão antiga (reroll1/reroll2...) viram níveis
        for (const id of ['reroll', 'banish', 'skip']) {
          if (m.bought[id + '1'] || m.bought[id + '2']) {
            m.bought[id] = (m.bought[id + '1'] ? 2 : 0) + (m.bought[id + '2'] ? 2 : 0);
            delete m.bought[id + '1'];
            delete m.bought[id + '2'];
          }
        }
        if (!raw.version) {
          m.coins = Math.floor(m.coins / 60) + (m.tokens || 0);
          m.tokens = 0;
          m.version = 2;
        }
        return m;
      }
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
    mercenario: {
      name: 'Mercenário', title: 'O soldado da fortuna', r: 14,
      hp: 95, speed: 200, armor: 0, regen: 0, crit: 0.08, luck: 0,
      weapon: 'metralhadora', theme: ['#3a4a22', '#0e1208'], accent: '#ffd36b',
      bars: { vida: 0.4, velocidade: 0.7, defesa: 0.25 },
      desc: 'Rajadas sem parar. Começa com a Metralhadora.',
      passive: 'Ganha +10% de dano a cada chefão derrotado.',
    },
    berserker: {
      name: 'Berserker', title: 'O bárbaro', r: 16,
      hp: 190, speed: 160, armor: 2, regen: 0.4, crit: 0.05, luck: 0,
      weapon: 'espadao', theme: ['#5a1a10', '#140504'], accent: '#ff6a3a',
      bars: { vida: 0.85, velocidade: 0.4, defesa: 0.7 },
      desc: 'Resistente, lento e devastador. Começa com o Espadão.',
      passive: 'Cada nível aumenta em 5% toda a cura recebida.',
    },
    arqueira: {
      name: 'Arqueira Élfica', title: 'A caçadora', r: 13,
      hp: 85, speed: 215, armor: 0, regen: 0, crit: 0.08, luck: 0.5,
      weapon: 'arco', theme: ['#1a4a2a', '#06140a'], accent: '#8fd36a',
      bars: { vida: 0.35, velocidade: 0.8, defesa: 0.2 },
      desc: 'Rápida e certeira. Começa com o Arco Caçador.',
      passive: 'Ganha +1 projétil a cada 8 níveis.',
    },
    necromante: {
      name: 'Necromante', title: 'O senhor das almas', r: 14,
      hp: 90, speed: 185, armor: 1, regen: 0, crit: 0.05, luck: 0,
      weapon: 'caveiras', theme: ['#1a2a1a', '#050a05'], accent: '#9dff6a',
      bars: { vida: 0.4, velocidade: 0.55, defesa: 0.35 },
      desc: 'Comanda caveiras teleguiadas. Começa com as Caveiras Espectrais.',
      passive: 'Cada 100 abates dão +4% de dano (até +60%).',
    },
  };

  // ============================================================
  // Loja única: tudo custa moedas douradas (raras, umas 9 por partida completa)
  // ============================================================
  const SHOP = [
    { id: 'maniaco', kind: 'char', name: 'Maníaco', price: 8, desc: 'Desbloqueia o bobo da corte psicopata.' },
    { id: 'golem', kind: 'char', name: 'Golem de Pedra', price: 12, desc: 'Desbloqueia o colosso de pedra.', req: { type: 'bosses', n: 1, text: 'Derrote 1 chefão' } },
    { id: 'mercenario', kind: 'char', name: 'Mercenário', price: 15, desc: 'Desbloqueia o soldado da metralhadora.', req: { type: 'level', n: 12, text: 'Alcance o nível 12' } },
    { id: 'arqueira', kind: 'char', name: 'Arqueira Élfica', price: 20, desc: 'Desbloqueia a caçadora do arco.', req: { type: 'stage', id: 'vulcao', text: 'Conclua o Vulcão' } },
    { id: 'necromante', kind: 'char', name: 'Necromante', price: 26, desc: 'Desbloqueia o senhor das almas.', req: { type: 'elites', n: 40, text: 'Derrote 40 mini-chefes' } },
    { id: 'berserker', kind: 'char', name: 'Berserker', price: 18, desc: 'Desbloqueia o bárbaro do espadão.', req: { type: 'stage', id: 'cemiterio', text: 'Conclua o Cemitério' } },
    { id: 'wslot1', kind: 'wslot', name: 'Espaço de arma', price: 8, desc: '+1 espaço de arma (4 no total).', req: { type: 'time', n: 300, text: 'Sobreviva 5 minutos' } },
    { id: 'wslot2', kind: 'wslot', name: 'Espaço de arma', price: 18, desc: '+1 espaço de arma (5 no total).', req: { type: 'bosses', n: 3, text: 'Derrote 3 chefões no total' }, needs: 'wslot1' },
    { id: 'pslot1', kind: 'pslot', name: 'Espaço de passiva', price: 6, desc: '+1 espaço de passiva (3 no total).', req: { type: 'level', n: 15, text: 'Alcance o nível 15' } },
    { id: 'pslot2', kind: 'pslot', name: 'Espaço de passiva', price: 15, desc: '+1 espaço de passiva (4 no total).', req: { type: 'time', n: 420, text: 'Sobreviva 7 minutos' }, needs: 'pslot1' },
    // Opções ao subir de nível: começam trancadas (objetivo) e têm níveis; cada nível dá +1 uso por partida.
    { id: 'skip', kind: 'option', icon: 'skip', name: 'Pular', prices: [2, 3, 4, 6, 8],
      desc: 'Pula a escolha de recompensa sem pegar nada.', req: { type: 'level', n: 8, text: 'Alcance o nível 8' } },
    { id: 'reroll', kind: 'option', icon: 'reroll', name: 'Atualizar', prices: [3, 4, 6, 8, 10],
      desc: 'Troca as opções de recompensa por outras.', req: { type: 'time', n: 180, text: 'Sobreviva 3 minutos' } },
    { id: 'banish', kind: 'option', icon: 'banish', name: 'Banir', prices: [4, 6, 8, 10, 12],
      desc: 'Remove uma arma ou passiva da partida inteira.', req: { type: 'bosses', n: 1, text: 'Derrote 1 chefão' } },
  ];

  // Melhorias permanentes: valem em todas as partidas. Cada nível custa mais.
  const PERMS = [
    { id: 'pVida', icon: 'vigor', name: 'Vigor Eterno', each: '+8% de vida máxima', prices: [3, 5, 8, 12, 16], apply: (n) => { player.maxHp = Math.round(player.maxHp * (1 + 0.08 * n)); player.hp = player.maxHp; } },
    { id: 'pDano', icon: 'might', name: 'Força Ancestral', each: '+5% de dano', prices: [4, 6, 9, 13, 18], apply: (n) => { player.dmgMul += 0.05 * n; } },
    { id: 'pVel', icon: 'boots', name: 'Botas Aladas', each: '+3% de velocidade', prices: [3, 6, 10], apply: (n) => { player.speed *= 1 + 0.03 * n; } },
    { id: 'pXp', icon: 'xp', name: 'Mente Afiada', each: '+6% de XP', prices: [3, 5, 7, 10, 14], apply: (n) => { player.xpMul += 0.06 * n; } },
    { id: 'pSorte', icon: 'sorte', name: 'Trevo Dourado', each: '+0,5 de Sorte', prices: [5, 8, 12, 16], apply: (n) => { player.luck += 0.5 * n; } },
    { id: 'pMoedas', icon: 'coin', name: 'Faro de Tesouro', each: '+10% de chance de moedas', prices: [4, 6, 9, 13, 18], apply: (n) => { player.coinMul += 0.1 * n; } },
    { id: 'pArmadura', icon: 'armor', name: 'Couraça', each: '+1 de armadura', prices: [6, 10, 15], apply: (n) => { player.armor += n; } },
    { id: 'pReviver', icon: 'revive', name: 'Segunda Chance', each: '+1 reviver por partida', prices: [15, 30], req: { type: 'stage', id: 'vulcao', text: 'Conclua o Vulcão' }, apply: (n) => { run.revives = n; } },
  ];

  // Nível comprado de cada opção = usos por partida.
  const optionLevel = (id) => {
    const v = save.bought[id];
    return typeof v === 'number' ? v : 0;
  };
  const optionUses = optionLevel;

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
    if (r.type === 'stage') return (save.stages[r.id] || 0) >= 1;
    if (r.type === 'elites') return st.elites >= r.n;
    return true;
  }

  function reqProgress(r) {
    const st = save.stats;
    if (r.type === 'time') return `${fmtTime(Math.min(st.bestTime, r.n))} / ${fmtTime(r.n)}`;
    if (r.type === 'bosses') return `${Math.min(st.bosses, r.n)} / ${r.n}`;
    if (r.type === 'stage') return 'pendente';
    if (r.type === 'elites') return `${Math.min(st.elites, r.n)} / ${r.n}`;
    return `${Math.min(st.bestLevel, r.n)} / ${r.n}`;
  }

  // ============================================================
  // Desafios: dão moedas de desafio, que liberam armas e passivas
  // ============================================================
  // Os que têm "goal" são conferidos sozinhos pelo valor de val();
  // os outros são concluídos por eventos do jogo (ver completeChallenge).
  const CHALLENGES = [
    { id: 'intocavel', name: 'Intocável', desc: 'Sobreviva 2 minutos seguidos sem levar dano', reward: 2, goal: 120, time: true,
      val: () => Math.max(save.stats.bestHitless || 0, inRun ? time - run.lastHurt : 0) },
    { id: 'massacre', name: 'Massacre', desc: 'Derrote 2.000 inimigos no total', reward: 3, goal: 2000,
      val: () => save.stats.kills + (inRun ? kills : 0) },
    { id: 'furia', name: 'Fúria', desc: 'Derrote 500 inimigos numa só partida', reward: 2, goal: 500,
      val: () => Math.max(save.stats.bestKills, inRun ? kills : 0) },
    { id: 'sobrevivente', name: 'Sobrevivente', desc: 'Sobreviva 7 minutos', reward: 3, goal: 420, time: true,
      val: () => Math.max(save.stats.bestTime, inRun ? time : 0) },
    { id: 'veterano', name: 'Veterano', desc: 'Alcance o nível 20', reward: 2, goal: 20,
      val: () => Math.max(save.stats.bestLevel, inRun ? player.level : 0) },
    { id: 'elites', name: 'Caçador de Elites', desc: 'Derrote 15 mini-chefes no total', reward: 2, goal: 15,
      val: () => save.stats.elites + (inRun ? run.eliteKills : 0) },
    { id: 'ogro', name: 'Mata-Gigantes', desc: 'Derrote o Rei Ogro em menos de 30 segundos', reward: 3 },
    { id: 'robo', name: 'Desviador', desc: 'Derrote o Robô Destruidor sem ser atingido por um míssil', reward: 2 },
    { id: 'lich', name: 'Caça-Lich', desc: 'Derrote o Lich em menos de 40 segundos', reward: 3 },
    { id: 'trinca', name: 'Trinca de Chefões', desc: 'Derrote 3 chefões numa só partida', reward: 3 },
    { id: 'lenda', name: 'Lendário', desc: 'Escolha uma carta lendária', reward: 1 },
    { id: 'mestre', name: 'Mestre de Armas', desc: 'Leve uma arma ao nível 10', reward: 2 },
    { id: 'cemiterio', name: 'Senhor do Cemitério', desc: 'Conclua o Cemitério Sombrio', reward: 3 },
    { id: 'vulcao', name: 'Coração de Magma', desc: 'Conclua o Vulcão Ardente', reward: 3 },
    { id: 'neve', name: 'Inverno Eterno', desc: 'Conclua os Picos Gelados', reward: 4 },
    { id: 'pesadelo', name: 'Pesadelo Vencido', desc: 'Conclua qualquer fase no Pesadelo', reward: 5 },
    { id: 'pantano', name: 'Senhor do Pântano', desc: 'Conclua o Pântano Venenoso', reward: 5 },
    { id: 'deserto', name: 'Herdeiro do Faraó', desc: 'Conclua o Deserto Amaldiçoado', reward: 6 },
    { id: 'dificil3', name: 'Veterano das Trevas', desc: 'Conclua o Difícil em 3 fases', reward: 6, goal: 3,
      val: () => STAGE_IDS.filter((id) => (save.stages[id] || 0) >= 2).length },
    { id: 'pesadelo3', name: 'Lenda Viva', desc: 'Conclua o Pesadelo em 3 fases', reward: 10, goal: 3,
      val: () => STAGE_IDS.filter((id) => (save.stages[id] || 0) >= 3).length },
    { id: 'todas', name: 'Conquistador', desc: 'Conclua todas as 5 fases', reward: 8, goal: 5,
      val: () => STAGE_IDS.filter((id) => (save.stages[id] || 0) >= 1).length },
    { id: 'ameaca5', name: 'Sem Medo', desc: 'Chegue à Ameaça 5', reward: 4, goal: 5,
      val: () => Math.max(save.stats.bestThreat || 0, inRun ? run.maxThreat : 0) },
    { id: 'ameaca10', name: 'Imortal', desc: 'Chegue à Ameaça 10', reward: 8, goal: 10,
      val: () => Math.max(save.stats.bestThreat || 0, inRun ? run.maxThreat : 0) },
    { id: 'nivel40', name: 'Mestre', desc: 'Alcance o nível 40', reward: 5, goal: 40,
      val: () => Math.max(save.stats.bestLevel, inRun ? player.level : 0) },
    { id: 'abates10k', name: 'Ceifador de Hordas', desc: 'Derrote 10.000 inimigos no total', reward: 6, goal: 10000,
      val: () => save.stats.kills + (inRun ? kills : 0) },
    { id: 'elites100', name: 'Matador de Elites', desc: 'Derrote 100 mini-chefes no total', reward: 6, goal: 100,
      val: () => save.stats.elites + (inRun ? run.eliteKills : 0) },
    { id: 'moedas100', name: 'Colecionador', desc: 'Junte 100 moedas douradas no total', reward: 5, goal: 100,
      val: () => (save.stats.coinsTotal || 0) + (inRun ? Math.round(runCoins) : 0) },
    { id: 'herois', name: 'Elenco Completo', desc: 'Conclua uma fase com 5 personagens diferentes', reward: 8, goal: 5,
      val: () => Object.keys(save.stats.winChars || {}).length },
    { id: 'semfogueira', name: 'Asceta', desc: 'Conclua uma fase sem usar nenhuma fogueira', reward: 5 },
    { id: 'umaarma', name: 'Especialista', desc: 'Conclua uma fase usando só uma arma', reward: 6 },
    { id: 'relampago', name: 'Relâmpago', desc: 'Derrote um chefão final em menos de 45 segundos', reward: 5 },
  ];

  function completeChallenge(id) {
    if (save.challenges[id]) return;
    const c = CHALLENGES.find((x) => x.id === id);
    save.challenges[id] = true;
    save.coins += c.reward;
    if (run) run.chalCoins += c.reward;
    persist();
    Sound.play('chest');
    showBanner(`Desafio concluído: ${c.name}! +${c.reward} ${c.reward === 1 ? 'moeda' : 'moedas'}`, '#ffd36b');
  }

  function checkChallenges() {
    for (const c of CHALLENGES) {
      if (c.goal && !save.challenges[c.id] && c.val() >= c.goal) completeChallenge(c.id);
    }
  }

  // ============================================================
  // Armas
  // ============================================================
  // Cada arma tem atributos base e uma lista de melhorias, uma por nível (do 2 ao 10).
  // A raridade da carta multiplica o valor da melhoria (ver RARITY).
  // unit = como chamar os "projéteis" dessa arma no texto das cartas.
  const WEAPONS = {
    missil: {
      name: 'Estilhaço de Gelo', color: '#5fe8ff', max: 10, unit: ['estilhaço', 'estilhaços'],
      desc: 'Dispara no inimigo mais próximo.',
      base: { dmg: 10, cd: 0.95, count: 1, pierce: 0 },
      ups: [[['dmg', 4]], [['count', 1]], [['cd', 0.08]], [['dmg', 4]], [['pierce', 1]], [['count', 1]], [['cd', 0.08]], [['dmg', 6]], [['count', 1], ['pierce', 1]]],
    },
    arco: {
      name: 'Arco Caçador', color: '#d69a52', max: 10, unit: ['flecha', 'flechas'],
      desc: 'Flechas teleguiadas que perfuram e seguem para o inimigo de trás.',
      base: { dmg: 16, cd: 1.1, count: 1, pierce: 2 },
      ups: [[['count', 1]], [['pierce', 1]], [['dmg', 5]], [['cd', 0.08]], [['count', 1]], [['pierce', 2]], [['dmg', 6]], [['cd', 0.08]], [['count', 1]]],
    },
    facas: {
      name: 'Facas', color: '#d8e0ea', max: 10, unit: ['faca', 'facas'],
      desc: 'Arremessa facas teleguiadas no inimigo mais próximo.',
      base: { dmg: 10, cd: 0.45, count: 1, pierce: 0 },
      ups: [[['count', 1]], [['dmg', 3]], [['cd', 0.08]], [['count', 1]], [['pierce', 1]], [['dmg', 4]], [['cd', 0.08]], [['count', 1]], [['dmg', 5]]],
    },
    raio: {
      name: 'Raio em Cadeia', color: '#ffd23f', max: 10, unit: ['raio', 'raios'], lock: 12,
      desc: 'Raio que ricocheteia entre os inimigos.',
      base: { dmg: 28, cd: 2.2, count: 1, bounces: 3 },
      ups: [[['bounces', 1]], [['dmg', 8]], [['bounces', 1]], [['cd', 0.1]], [['bounces', 1]], [['count', 1]], [['dmg', 10]], [['bounces', 2]], [['cd', 0.1]]],
    },
    fogo: {
      name: 'Bola de Fogo', color: '#ff7a1a', max: 10, unit: ['bola de fogo', 'bolas de fogo'], lock: 10,
      desc: 'Bola de fogo que explode em área.',
      base: { dmg: 31, cd: 2.1, count: 1, area: 60, burn: 0 },
      ups: [[['area', 15]], [['dmg', 9]], [['cd', 0.1]], [['count', 1]], [['area', 20]], [['dmg', 12]], [['burn', 1]], [['cd', 0.1]], [['count', 1]]],
    },
    laminas: {
      name: 'Lâminas Orbitais', color: '#c9d6e6', max: 10, unit: ['lâmina', 'lâminas'],
      desc: 'Lâminas giram ao seu redor e reduzem o dano recebido.',
      base: { dmg: 7, count: 2, reduction: 0.05, spin: 2.8, area: 65 },
      ups: [[['reduction', 0.04]], [['count', 1]], [['dmg', 3]], [['reduction', 0.04]], [['area', 12]], [['count', 1]], [['reduction', 0.05]], [['spin', 1]], [['dmg', 5]]],
    },
    aura: {
      name: 'Aura Sagrada', color: '#ffe27a', max: 10, unit: ['aura', 'auras'], lock: 4,
      desc: 'Campo que fere inimigos próximos.',
      base: { dmg: 6, area: 70, cd: 0.5 },
      ups: [[['area', 10]], [['dmg', 2]], [['area', 10]], [['dmg', 3]], [['cd', 0.1]], [['area', 12]], [['dmg', 3]], [['area', 12]], [['dmg', 4]]],
    },
    tremor: {
      name: 'Tremor de Pedra', color: '#c8a878', max: 10, unit: ['onda', 'ondas'],
      desc: 'Onda de choque que fere e empurra os inimigos.',
      base: { dmg: 22, cd: 3.2, area: 125, knock: 300, count: 1 },
      ups: [[['dmg', 7]], [['cd', 0.1]], [['area', 25]], [['dmg', 8]], [['knock', 120]], [['count', 1]], [['dmg', 10]], [['cd', 0.1]], [['area', 30]]],
    },
    metralhadora: {
      name: 'Metralhadora', color: '#ffd36b', max: 10, unit: ['bala', 'balas'],
      desc: 'Rajadas rápidas; as balas ricocheteiam para outros inimigos.',
      base: { dmg: 4, cd: 0.21, count: 1, bounces: 1 },
      ups: [[['dmg', 1.2]], [['bounces', 1]], [['cd', 0.07]], [['count', 1]], [['dmg', 1.5]], [['bounces', 1]], [['cd', 0.07]], [['dmg', 2]], [['count', 1], ['bounces', 1]]],
    },
    espadao: {
      name: 'Espadão', color: '#ff8a5a', max: 10, unit: ['giro', 'giros'],
      desc: 'Gira o espadão em círculo, com dano enorme e empurrão.',
      base: { dmg: 48, cd: 1.65, area: 100, knock: 260, count: 1 },
      ups: [[['dmg', 15]], [['area', 15]], [['cd', 0.1]], [['dmg', 17]], [['knock', 120]], [['count', 1]], [['area', 20]], [['dmg', 22]], [['cd', 0.12]]],
    },
    caveiras: {
      name: 'Caveiras Espectrais', color: '#9dff6a', max: 10, unit: ['caveira', 'caveiras'],
      desc: 'Caveiras teleguiadas que explodem em almas ao acertar.',
      base: { dmg: 13, cd: 1.25, count: 1, area: 38 },
      ups: [[['dmg', 4]], [['count', 1]], [['area', 10]], [['cd', 0.08]], [['dmg', 5]], [['count', 1]], [['area', 12]], [['cd', 0.08]], [['count', 1], ['dmg', 6]]],
    },
    bombardeio: {
      name: 'Bombardeio', color: '#ff7a1a', max: 10, unit: ['bomba', 'bombas'], lock: 10,
      desc: 'Uma fileira de bombas cai explodindo sobre os inimigos.',
      base: { dmg: 28, cd: 3.6, count: 4, area: 55 },
      ups: [[['count', 1]], [['dmg', 9]], [['area', 10]], [['cd', 0.1]], [['count', 2]], [['dmg', 12]], [['area', 12]], [['cd', 0.1]], [['count', 2]]],
    },
    bumerangue: {
      name: 'Bumerangue', color: '#b07aff', max: 10, unit: ['bumerangue', 'bumerangues'], lock: 6,
      desc: 'Vai e volta atravessando todos os inimigos no caminho.',
      base: { dmg: 13, cd: 1.7, count: 1, range: 250 },
      ups: [[['dmg', 4]], [['range', 40]], [['count', 1]], [['cd', 0.08]], [['dmg', 5]], [['count', 1]], [['range', 50]], [['dmg', 6]], [['count', 1]]],
    },
    meteoro: {
      name: 'Chuva de Meteoros', color: '#ff9a3a', max: 10, unit: ['meteoro', 'meteoros'], lock: 14,
      desc: 'Meteoros caem do céu sobre os inimigos e explodem.',
      base: { dmg: 40, cd: 3.2, count: 2, area: 70 },
      ups: [[['count', 1]], [['dmg', 12]], [['area', 15]], [['cd', 0.1]], [['count', 1]], [['dmg', 15]], [['area', 20]], [['cd', 0.1]], [['count', 2]]],
    },
  };

  // Números com uma casa decimal só quando precisa ("1,7", "2").
  const fmtNum = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1).replace('.', ','));
  const plural = (v, [one, many]) => (Math.abs(v - 1) < 0.05 ? one : many);

  function statText(def, stat, v) {
    switch (stat) {
      case 'dmg': return `+${fmtNum(v)} de dano`;
      case 'count': return `+${fmtNum(v)} ${plural(v, def.unit)}`;
      case 'cd': return `Ataca ${pct(v)} mais rápido`;
      case 'pierce': return `+${fmtNum(v)} ${plural(v, ['perfuração', 'perfurações'])}`;
      case 'bounces': return `+${fmtNum(v)} ${plural(v, ['ricochete', 'ricochetes'])}`;
      case 'area': return `+${fmtNum(v)} de raio`;
      case 'range': return `+${fmtNum(v)} de alcance`;
      case 'reduction': return `+${pct(v)} de redução de dano`;
      case 'spin': return `Giram ${pct(v / 2.8)} mais rápido`;
      case 'knock': return `+${fmtNum(v)} de empurrão`;
      case 'burn': return v > 1.05 ? `Chão em chamas (${pct(v)} de força)` : 'Deixa o chão em chamas';
      default: return '';
    }
  }

  function applyStat(s, stat, v) {
    if (stat === 'cd') s.cdMul = Math.max(0.2, s.cdMul * (1 - v));
    else s[stat] = (s[stat] || 0) + v;
  }

  // ============================================================
  // Passivas (ocupam espaço). v = valor de uma carta comum.
  // ============================================================
  const PASSIVES = {
    vigor: { name: 'Vida Máxima', max: 5, v: 20, text: (v) => `+${Math.round(v)} de vida máxima (e cura o mesmo)`, apply: (v) => { player.maxHp += Math.round(v); heal(Math.round(v)); } },
    boots: { name: 'Velocidade de Movimento', max: 5, v: 0.08, text: (v) => `+${pct(v)} de velocidade de movimento`, apply: (v) => { player.speed *= 1 + v; } },
    might: { name: 'Dano', max: 5, v: 0.12, text: (v) => `+${pct(v)} de dano em todas as armas`, apply: (v) => { player.dmgMul += v; } },
    haste: { name: 'Velocidade de Ataque', max: 5, v: 0.08, text: (v) => `Todas as armas atacam ${pct(v)} mais rápido`, apply: (v) => { player.cdMul = Math.max(0.25, player.cdMul * (1 - v)); } },
    magnet: { name: 'Alcance de Coleta', max: 5, v: 0.3, text: (v) => `+${pct(v)} de alcance para puxar XP e moedas`, apply: (v) => { player.magnet *= 1 + v; } },
    regen: { name: 'Regeneração', max: 5, v: 0.5, lock: 3, text: (v) => `+${fmtNum(v)} de vida por segundo`, apply: (v) => { player.regen += v; } },
    armor: { name: 'Armadura', max: 5, v: 1, text: (v) => `-${fmtNum(v)} de dano recebido por golpe`, apply: (v) => { player.armor += v; } },
    multi: {
      name: 'Projéteis', max: 3, lock: 18, v: 1, table: [1, 1.5, 2, 4],
      text: (v) => `+${fmtNum(v)} ${plural(v, ['projétil', 'projéteis'])} em todas as armas (frações somam até virar um inteiro)`,
      apply: (v) => { player.extraProj += v; },
    },
    precisao: { name: 'Chance de Crítico', max: 5, v: 0.06, text: (v) => `+${pct(v)} de chance de crítico`, apply: (v) => { player.crit = Math.min(1, player.crit + v); } },
    area: { name: 'Área', max: 5, v: 0.1, text: (v) => `+${pct(v)} de área (aura, explosões, lâminas, ondas)`, apply: (v) => { player.areaMul += v; } },
    sorte: { name: 'Sorte', max: 5, v: 1, text: (v) => `+${fmtNum(v)} de Sorte: cartas raras, épicas e lendárias aparecem mais`, apply: (v) => { player.luck += v; } },
    critdmg: { name: 'Dano Crítico', max: 5, v: 0.25, lock: 11, text: (v) => `Críticos causam +${pct(v)} de dano`, apply: (v) => { player.critMul += v; } },
    vampiro: { name: 'Vampirismo', max: 5, v: 0.04, lock: 8, text: (v) => `+${pct(v)} de chance de curar 3 de vida ao derrotar um inimigo`, apply: (v) => { player.lifesteal += v; } },
    sabedoria: { name: 'Sabedoria', max: 5, v: 0.1, lock: 5, text: (v) => `+${pct(v)} de XP ganho`, apply: (v) => { player.xpMul += v; } },
  };

  // Armas e passivas com "lock" começam bloqueadas e são liberadas com moedas de desafio.
  const isUnlocked = (def, id) => !def.lock || !!save.unlocks[id];

  // Valor de uma passiva numa carta da raridade r.
  const passiveValue = (id, r) => {
    const def = PASSIVES[id];
    return def.v * (def.table ? def.table[r] : RARITY[r].mult);
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
    moedas: { name: 'Ganância', icon: 'coin', base: 0.15, text: (v) => `+${pct(v)} de chance de achar moedas douradas`, apply: (v) => { player.coinMul += v; } },
    armadura: { name: 'Pele de Pedra', icon: 'armor', base: 0.6, text: (v) => `+${v.toFixed(1).replace('.', ',')} de armadura`, apply: (v) => { player.armor += v; } },
    sorte: { name: 'Bênção da Sorte', icon: 'sorte', base: 0.5, text: (v) => `+${v.toFixed(1).replace('.', ',')} de Sorte`, apply: (v) => { player.luck += v; } },
  };

  // Texto curto do total de uma bênção (para o HUD e o pause).
  function boonShort(id, v) {
    const pctIds = ['dano', 'recarga', 'area', 'critico', 'velocidade', 'xp', 'ima', 'moedas'];
    if (pctIds.includes(id)) return '+' + pct(v);
    if (id === 'vida') return '+' + Math.round(v);
    return '+' + fmtNum(v);
  }

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
    skeleton: { name: 'Esqueleto', r: 12, hp: 16, speed: 0.45, dmg: 8, xp: 1, color: '#e8e2cf' },
    ghost: { name: 'Ceifador', r: 11, hp: 11, speed: 0.5, dmg: 6, xp: 1, color: '#7fd8ff' },
    mummy: { name: 'Múmia', r: 14, hp: 42, speed: 0.33, dmg: 12, xp: 2, color: '#d8c9a3' },
    werewolf: { name: 'Lobisomem', r: 15, hp: 36, speed: 0.42, dmg: 14, xp: 2, color: '#8a7a6a' },
    skelknight: { name: 'Cavaleiro Esqueleto', r: 17, hp: 120, speed: 0.36, dmg: 20, xp: 6, color: '#9aa6b4' },
    // Vulcão
    fireslime: { name: 'Slime Flamejante', r: 12, hp: 14, speed: 0.45, dmg: 8, xp: 1, color: '#ff7a2a' },
    blackskel: { name: 'Esqueleto Negro', r: 12, hp: 26, speed: 0.55, dmg: 12, xp: 2, color: '#4a4250' },
    bomber: { name: 'Bombardeiro', r: 12, hp: 12, speed: 0.52, dmg: 6, xp: 2, color: '#c8402a' },
    ashgolem: { name: 'Golem de Cinzas', r: 18, hp: 130, speed: 0.32, dmg: 20, xp: 6, color: '#5a524e' },
    // Neve
    yak: { name: 'Iaque das Neves', r: 13, hp: 15, speed: 0.45, dmg: 8, xp: 1, color: '#6a4a32' },
    yeti: { name: 'Abominável', r: 15, hp: 40, speed: 0.38, dmg: 13, xp: 2, color: '#eef4fa' },
    icetroll: { name: 'Troll Gelado', r: 18, hp: 140, speed: 0.32, dmg: 20, xp: 6, color: '#6a9ac0' },
    crystalguard: { name: 'Guarda Cristalino', r: 15, hp: 60, speed: 0.36, dmg: 14, xp: 3, color: '#9ad8ff', armor: 0.5 },
    // Pântano
    frog: { name: 'Sapo Gigante', r: 12, hp: 15, speed: 0.47, dmg: 8, xp: 1, color: '#5aa83a' },
    zombie: { name: 'Zumbi do Pântano', r: 15, hp: 55, speed: 0.3, dmg: 13, xp: 2, color: '#8aa86a' },
    witch: { name: 'Bruxa', r: 13, hp: 32, speed: 0.4, dmg: 10, xp: 3, color: '#7a3ad0' },
    // Deserto
    scorpion: { name: 'Escorpião', r: 11, hp: 14, speed: 0.55, dmg: 8, xp: 1, color: '#c8803a' },
    sandworm: { name: 'Verme da Areia', r: 15, hp: 42, speed: 0.42, dmg: 13, xp: 2, color: '#c8a070' },
    jackal: { name: 'Guerreiro Chacal', r: 16, hp: 115, speed: 0.38, dmg: 18, xp: 5, color: '#3a2a40', armor: 0.7 },
    // Chefões
    robo: { name: 'Robô Destruidor', r: 42, hp: 1100, speed: 0.32, dmg: 34, xp: 60, color: '#c3ccd8', boss: true },
    boss: { name: 'Rei Ogro', r: 40, hp: 1000, speed: 0.36, dmg: 35, xp: 60, color: '#c02060', boss: true },
    lich: { name: 'Lich', r: 34, hp: 850, speed: 0.32, dmg: 30, xp: 60, color: '#4fc7b8', boss: true },
    // Chefões finais (aparecem aos 7 minutos ou no Altar Maior)
    ceifador: { name: 'Ceifador Ancestral', r: 46, hp: 1800, speed: 0.34, dmg: 34, xp: 120, color: '#c77dff', boss: true, final: true },
    titan: { name: 'Titã de Magma', r: 50, hp: 2000, speed: 0.3, dmg: 38, xp: 120, color: '#ff6a1a', boss: true, final: true },
    rainha: { name: 'Rainha do Gelo', r: 40, hp: 1700, speed: 0.34, dmg: 32, xp: 120, color: '#9af0ff', boss: true, final: true },
    hydra: { name: 'Hidra do Pântano', r: 48, hp: 2100, speed: 0.3, dmg: 36, xp: 140, color: '#4a8a5a', boss: true, final: true },
    pharaoh: { name: 'Faraó Amaldiçoado', r: 44, hp: 2000, speed: 0.33, dmg: 38, xp: 140, color: '#ffd36b', boss: true, final: true },
  };
  // ============================================================
  // Fases e dificuldades
  // ============================================================
  const STAGE_TIME = 420; // aos 7 minutos chega o chefão final (ou antes, pelo Altar Maior)
  const SUMMON_TIME = 2; // segundos entre ativar um altar e o chefão nascer
  const STAGES = {
    cemiterio: {
      name: 'Cemitério Sombrio', biome: 'grass', accent: '#8fd3a0', final: 'ceifador',
      desc: 'Floresta com túmulos. Esqueletos, múmias, ceifadores e lobisomens.',
      bosses: ['robo', 'boss', 'lich'], fodder: 'skeleton', swarm: ['ghost', 'werewolf'],
      pick(t, r) {
        if (t > 120 && r < 0.08) return 'skelknight';
        if (t > 60 && r < 0.28) return 'werewolf';
        if (t > 25 && r < 0.48) return 'mummy';
        if (r < 0.7) return 'skeleton';
        return 'ghost';
      },
    },
    vulcao: {
      name: 'Vulcão Ardente', biome: 'lava', accent: '#ff7a2a', final: 'titan',
      desc: 'Chão de lava. Slimes flamejantes, esqueletos negros, bombardeiros e golens de cinza.',
      bosses: ['boss', 'robo', 'lich'], fodder: 'fireslime', swarm: ['fireslime', 'blackskel'],
      pick(t, r) {
        if (t > 120 && r < 0.09) return 'ashgolem';
        if (t > 40 && r < 0.26) return 'bomber';
        if (t > 20 && r < 0.5) return 'blackskel';
        return 'fireslime';
      },
    },
    neve: {
      name: 'Picos Gelados', biome: 'snow', accent: '#9af0ff', final: 'rainha',
      desc: 'Neve e gelo. Iaques, abomináveis, trolls gelados e guardas cristalinos.',
      bosses: ['lich', 'boss', 'robo'], fodder: 'yak', swarm: ['yak', 'yeti'],
      pick(t, r) {
        if (t > 120 && r < 0.09) return 'icetroll';
        if (t > 60 && r < 0.24) return 'crystalguard';
        if (t > 25 && r < 0.45) return 'yeti';
        return 'yak';
      },
    },
    pantano: {
      name: 'Pântano Venenoso', biome: 'swamp', accent: '#7aff4a', final: 'hydra',
      desc: 'Água lodosa e névoa. Sapos gigantes, zumbis, bruxas e múmias.',
      bosses: ['lich', 'robo', 'boss'], fodder: 'frog', swarm: ['frog', 'zombie'],
      pick(t, r) {
        if (t > 90 && r < 0.12) return 'witch';
        if (t > 50 && r < 0.3) return 'mummy';
        if (t > 20 && r < 0.55) return 'zombie';
        return 'frog';
      },
    },
    deserto: {
      name: 'Deserto Amaldiçoado', biome: 'sand', accent: '#ffd36b', final: 'pharaoh',
      desc: 'Areia escaldante e ruínas. Escorpiões, vermes, chacais e lobisomens.',
      bosses: ['robo', 'lich', 'boss'], fodder: 'scorpion', swarm: ['scorpion', 'sandworm'],
      pick(t, r) {
        if (t > 120 && r < 0.1) return 'jackal';
        if (t > 60 && r < 0.26) return 'werewolf';
        if (t > 25 && r < 0.5) return 'sandworm';
        return 'scorpion';
      },
    },
  };
  const STAGE_IDS = Object.keys(STAGES);

  const DIFFS = [
    { name: 'Normal', hp: 1, dmg: 1, spawn: 1, coins: 1, color: '#8fd3a0' },
    { name: 'Difícil', hp: 1.6, dmg: 1.35, spawn: 1.25, coins: 1.6, color: '#ffb347' },
    { name: 'Pesadelo', hp: 2.5, dmg: 1.75, spawn: 1.5, coins: 2.4, color: '#ff4f6a' },
  ];

  // A primeira fase está sempre liberada; as outras, depois de concluir a anterior.
  const stageUnlocked = (id) => {
    const i = STAGE_IDS.indexOf(id);
    return i === 0 || (save.stages[id] || 0) >= 1 || (save.stages[STAGE_IDS[i - 1]] || 0) >= 1;
  };
  const diffUnlocked = (id, d) => stageUnlocked(id) && (save.stages[id] || 0) >= d;

  const MAX_ENEMIES = 220;
  const FIRST_SWARM = 75;

  // Inimigos por segundo: 1 a cada 3 s até a primeira horda; depois cresce devagar.
  // Ex.: 2 min = 0,8 · 3 min = 1,6 · 5 min = 4 · 10 min = 14
  function spawnRate(t) {
    if (t < FIRST_SWARM) return 0.33;
    const m = (t - FIRST_SWARM) / 60;
    return 0.4 + m * 0.5 + m * m * 0.12;
  }
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
  let lanes; // ataques dos chefões em faixa (onda do Ogro, fogo do Lich)
  let meteors;
  let eshots; // projéteis dos inimigos (bolas de neve, cristais)
  let epools; // chão em chamas deixado pelos slimes
  let spins; // giros do espadão
  let summons; // chefões sendo invocados nos altares
  let run; // dados da partida usados pelos desafios
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
      crit: C.crit, luck: C.luck, critMul: 2, lifesteal: 0, healMul: 1,
      xp: 0, level: 1, xpNext: xpForLevel(1),
      invuln: 0, facing: 1, dirX: 1, dirY: 0, moving: false, anim: 0,
      bossKills: 0,
    };
    run = {
      lastHurt: 0, bestHitless: 0, eliteKills: 0, spawned: 0, chalCoins: 0, checkT: 0,
      rerolls: optionUses('reroll'), banishes: optionUses('banish'), skips: optionUses('skip'), banned: new Set(),
      stage: STAGES[save.stage] ? save.stage : 'cemiterio', diff: save.diff || 0,
      stageStart: 0, // quando começou a dificuldade atual (o portal reinicia a contagem)
      finalSpawned: false, cleared: false, clearTime: 0, firstClear: false, nextOver: 0, overIdx: 0,
    };
    if (!diffUnlocked(run.stage, run.diff)) { run.stage = 'cemiterio'; run.diff = 0; }
    run.revives = 0;
    run.usedBonfire = false;
    run.maxThreat = 0;
    for (const P of PERMS) if (optionLevel(P.id)) P.apply(optionLevel(P.id));
    Art.setBiome(STAGES[run.stage].biome, run.diff);
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
    lanes = [];
    meteors = [];
    eshots = [];
    epools = [];
    spins = [];
    summons = [];
    structures = [];
    weapons = {};
    passiveLevels = {};
    boonsTaken = {};
    time = 0;
    kills = 0;
    runCoins = 0;
    spawnAcc = 0;
    nextBoss = BOSS_INTERVAL;
    nextSwarm = FIRST_SWARM;
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
  const effDmgMul = () => player.dmgMul
    * (player.char === 'golem' ? 1 + golemRage() * 1.2 : 1)
    * (player.char === 'mercenario' ? 1 + player.bossKills * 0.1 : 1)
    * (player.char === 'necromante' ? 1 + Math.min(0.6, Math.floor(kills / 100) * 0.04) : 1);
  const effCd = () => player.cdMul;
  const effSpeed = () => player.speed;
  const effLuck = () => player.luck;
  const effRegen = () => player.regen;
  const bladeReduction = () => (weapons.laminas ? Math.min(0.6, weapons.laminas.s.reduction) : 0);

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
    else {
      // cada dificuldade tem sua música: normal, sombria (Difícil) e rock pesado (Pesadelo)
      const base = {
        cemiterio: ['game', 'dark', 'metal'],
        vulcao: ['lava', 'lavadark', 'lavametal'],
        neve: ['snow', 'snowdark', 'snowmetal'],
        pantano: ['swamp', 'swampdark', 'swampmetal'],
        deserto: ['desert', 'desertdark', 'desertmetal'],
      }[run.stage][run.diff];
      const boss = enemies.some((e) => e.boss);
      Sound.music(base === 'game' ? (boss ? 'boss' : 'game') : base + (boss ? 'boss' : ''));
    }
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
  // A base fica parada onde você tocou; só a bolinha acompanha o dedo, até a borda.
  const STICK_R = 85;
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
      if (k === 'enter' || k === ' ') setState('stages');
    } else if (state === 'stages') {
      if (k === 'enter' || k === ' ') setState('chars');
      else if (k === 'escape') setState('home');
    } else if (state === 'chars') {
      if (k === 'enter' || k === ' ') startGame();
      else if (k === 'escape') setState('stages');
      const ids = Object.keys(CHARACTERS);
      const n = Number(k);
      if (n >= 1 && n <= ids.length) selectChar(ids[n - 1]);
    } else if ((state === 'shop' || state === 'challenges') && k === 'escape') setState('home');
    else if (state === 'settings' && k === 'escape') setState(settingsReturn);
    else if (state === 'playing' && (k === 'escape' || k === 'p')) setState('paused');
    else if (state === 'paused' && (k === 'escape' || k === 'p')) setState('playing');
    else if (state === 'levelup' && ['1', '2', '3', '4'].includes(k)) (banishMode ? banishChoice : choose)(Number(k) - 1);
    else if (state === 'levelup' && k === 'r') rerollChoices();
    else if (state === 'dead' && (k === 'r' || k === 'enter')) startGame();
  }

  // ============================================================
  // Telas
  // ============================================================
  const OVERLAYS = { home: 'home', stages: 'stages', chars: 'chars', shop: 'shop', challenges: 'challenges', settings: 'settings', paused: 'pause', levelup: 'levelup', dead: 'gameover' };

  function setState(s) {
    state = s;
    if (s !== 'playing') stick.active = false;
    for (const st in OVERLAYS) $(OVERLAYS[st]).classList.toggle('hidden', st !== s);
    $('hud').classList.toggle('hidden', !inRun);
    updateWallet();
    if (s === 'home') renderHome();
    if (s === 'challenges') renderChallenges();
    if (s === 'chars') renderChars();
    if (s === 'stages') renderStages();
    if (s === 'shop') renderShop();
    if (s === 'settings') renderSettings();
    if (s === 'paused') renderStats();
    updateMusic();
  }

  function updateWallet() {
    document.querySelectorAll('.coinval').forEach((el) => { el.textContent = save.coins; });
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

  // ---------- Escolha de fase e dificuldade ----------
  function renderStages() {
    const box = $('stagelist');
    box.innerHTML = '';
    for (const id of STAGE_IDS) {
      const S = STAGES[id];
      const open = stageUnlocked(id);
      const done = save.stages[id] || 0;
      const card = document.createElement('div');
      card.className = 'card stage' + (save.stage === id ? ' selected' : '') + (open ? '' : ' locked');
      card.style.setProperty('--accent', S.accent);
      const diffs = DIFFS.map((D, d) => {
        const ok = diffUnlocked(id, d);
        const on = save.stage === id && save.diff === d;
        return `<button class="diffbtn ${on ? 'on' : ''}" data-d="${d}" style="--dc:${D.color}" ${ok ? '' : 'disabled'}>${ok ? '' : '🔒 '}${D.name}${done > d ? ' ✔' : ''}</button>`;
      }).join('');
      const prev = STAGE_IDS[STAGE_IDS.indexOf(id) - 1];
      card.innerHTML = `
        <div class="preview"><img src="${Art.stagePreview(S.biome, save.stage === id ? save.diff : 0)}" alt="">${open ? '' : `<div class="lockbadge"><img src="${Art.icon('lock')}" alt=""><span>Conclua ${STAGES[prev].name}</span></div>`}</div>
        <div class="name">${S.name}</div>
        <div class="desc">${S.desc}</div>
        <div class="desc boss">Chefão final: <b>${ENEMY_TYPES[S.final].name}</b></div>
        <div class="diffs">${diffs}</div>`;
      card.querySelectorAll('.diffbtn').forEach((b) => b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectStage(id, Number(b.dataset.d));
      }));
      card.addEventListener('click', () => selectStage(id, save.stage === id ? save.diff : 0));
      box.appendChild(card);
    }
  }

  function selectStage(id, d) {
    if (!diffUnlocked(id, d)) {
      Sound.play('denied');
      toast(stageUnlocked(id) ? 'Conclua a dificuldade anterior primeiro' : 'Conclua a fase anterior primeiro');
      return;
    }
    Sound.play('click');
    save.stage = id;
    save.diff = d;
    persist();
    resetWorld();
    renderStages();
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
      // arte em imagem ocupa mais o quadro que o desenho por código
      const s = Art.hasSheet(p.id) ? 4.2 : p.id === 'golem' ? 4.6 : 5.6;
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
  // Itens da loja: personagens, espaços, opções de nível, armas e passivas.
  function shopItems() {
    const items = SHOP.slice();
    for (const P of PERMS) {
      items.push({ id: P.id, kind: 'perm', icon: P.icon, name: P.name, prices: P.prices, req: P.req, desc: `${P.each} por nível.`, color: '#ffd36b' });
    }
    for (const id in WEAPONS) {
      const d = WEAPONS[id];
      if (d.lock) items.push({ id, kind: 'weapon', name: d.name, price: d.lock, desc: d.desc, color: d.color });
    }
    for (const id in PASSIVES) {
      const d = PASSIVES[id];
      if (d.lock) items.push({ id, kind: 'passive', name: d.name, price: d.lock, desc: d.text(passiveValue(id, 0)), color: '#8fd3a0' });
    }
    return items;
  }

  // Preço atual (as opções com níveis ficam mais caras a cada compra).
  const priceOf = (item) => (item.prices ? item.prices[Math.min(optionLevel(item.id), item.prices.length - 1)] : item.price);

  const isOwned = (item) => (item.prices ? optionLevel(item.id) >= item.prices.length
    : item.kind === 'char' ? save.chars[item.id]
    : item.kind === 'weapon' || item.kind === 'passive' ? save.unlocks[item.id] : save.bought[item.id]);

  function renderShop() {
    const box = $('shoplist');
    box.innerHTML = '';
    const groups = [['Personagens', 'char'], ['Melhorias permanentes', 'perm'], ['Armas', 'weapon'], ['Passivas', 'passive'],
      ['Opções ao subir de nível', 'option'], ['Espaços de arma', 'wslot'], ['Espaços de passiva', 'pslot']];
    const all = shopItems();
    for (const [title, kind] of groups) {
      const h = document.createElement('h3');
      h.className = 'shophead';
      h.textContent = title;
      box.appendChild(h);
      const row = document.createElement('div');
      row.className = 'shoprow';
      // do mais barato para o mais caro
      for (const item of all.filter((i) => i.kind === kind).sort((a, b) => priceOf(a) - priceOf(b))) {
        const owned = isOwned(item);
        const leveled = !!item.prices;
        const lv = leveled ? optionLevel(item.id) : 0;
        const price = priceOf(item);
        const needsOk = !item.needs || save.bought[item.needs];
        const ok = reqMet(item.req);
        const afford = save.coins >= price;
        const icon = item.kind === 'char' ? Art.heroIcon(item.id)
          : Art.icon(item.kind === 'wslot' ? 'might' : item.kind === 'pslot' ? 'armor' : item.icon || item.id);
        const accent = item.kind === 'char' ? CHARACTERS[item.id].accent
          : item.color || (item.kind === 'wslot' ? '#ffd36b' : item.kind === 'option' ? '#7fe0ff' : '#8fd3a0');
        const card = document.createElement('div');
        card.className = 'card shopitem' + (owned ? ' owned' : '') + (!owned && (!ok || !needsOk) ? ' blocked' : '') + (!ok ? ' locked' : '');
        card.style.setProperty('--accent', accent);
        let status;
        if (owned) status = `<div class="owned-tag">${leveled ? 'Nível máximo' : 'Comprado'}</div>`;
        else if (!needsOk) status = '<div class="req">Compre o anterior primeiro</div>';
        else {
          const reqHtml = item.req
            ? `<div class="req ${ok ? 'ok' : ''}">${ok ? '✔' : '🔒'} ${item.req.text}${ok ? '' : ` <b>(${reqProgress(item.req)})</b>`}</div>`
            : '';
          status = `${reqHtml}<button class="buy" ${ok && afford ? '' : 'disabled'}><img src="${Art.icon('coin')}" alt="">${price}</button>`;
        }
        const pips = leveled
          ? `<div class="lvpips">${item.prices.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
             <div class="lvtext">${item.kind === 'perm' ? `Nível ${lv}/${item.prices.length}` : `${lv ? `${lv} ${lv === 1 ? 'uso' : 'usos'} por partida` : 'Nenhum uso ainda'}${owned ? '' : ` · próximo nível: ${lv + 1} ${lv ? 'usos' : 'uso'}`}`}</div>`
          : '';
        card.innerHTML = `
          <div class="shopicon ${item.kind === 'char' ? 'hero' : ''}"><img src="${icon}" alt="">${ok ? '' : `<img class="padlock" src="${Art.icon('lock')}" alt="">`}</div>
          <div class="name">${item.name}</div>
          <div class="desc">${item.desc}</div>
          ${pips}
          ${status}`;
        const btn = card.querySelector('.buy');
        if (btn) btn.addEventListener('click', () => buy(item));
        row.appendChild(card);
      }
      box.appendChild(row);
    }
    updateWallet();
  }

  function buy(item) {
    const price = priceOf(item);
    if (isOwned(item) || save.coins < price || !reqMet(item.req) || (item.needs && !save.bought[item.needs])) return;
    save.coins -= price;
    Sound.play('buy');
    if (item.kind === 'weapon' || item.kind === 'passive') save.unlocks[item.id] = true;
    else if (item.prices) save.bought[item.id] = optionLevel(item.id) + 1;
    else save.bought[item.id] = true;
    if (item.kind === 'char') save.chars[item.id] = true;
    persist();
    toast(item.prices ? `${item.name}: nível ${optionLevel(item.id)}!` : `${item.name} desbloqueado!`);
    renderShop();
  }

  // ---------- Desafios e arsenal bloqueado ----------
  function renderChallenges() {
    const list = $('chalList');
    list.innerHTML = '';
    for (const c of CHALLENGES) {
      const done = !!save.challenges[c.id];
      let prog = '';
      if (c.goal && !done) {
        const v = Math.min(c.val(), c.goal);
        const txt = c.time ? `${fmtTime(v)} / ${fmtTime(c.goal)}` : `${Math.floor(v)} / ${c.goal}`;
        prog = `<div class="cbar"><i style="width:${(100 * v) / c.goal}%"></i></div><div class="cprog">${txt}</div>`;
      }
      const row = document.createElement('div');
      row.className = 'chal' + (done ? ' done' : '');
      row.innerHTML = `
        <div class="cinfo"><div class="cname">${c.name}</div><div class="cdesc">${c.desc}</div>${prog}</div>
        <div class="creward"><span class="coin-ico"></span>${c.reward}</div>`;
      list.appendChild(row);
    }

    updateWallet();
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
      ['Projéteis extras', fmtNum(player.extraProj)],
      ['Velocidade', Math.round(effSpeed())],
      ['Armadura', +player.armor.toFixed(1)],
      ['Redução de dano', pct(bladeReduction())],
      ['Regeneração', `${effRegen().toFixed(1)}/s`],
      ['Sorte', +effLuck().toFixed(1)],
      ['XP e chance de moedas', `${pct(player.xpMul)} · ${pct(player.coinMul)}`],
      ['Espaços', `armas ${Object.keys(weapons).length}/${weaponSlots()} · passivas ${Object.keys(passiveLevels).length}/${passiveSlots()}`],
    ];
    const boons = Object.entries(boonsTaken);
    $('pstats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')
      + (boons.length ? `<h3 class="earnhead">Bênçãos das fogueiras</h3>`
        + boons.map(([id, v]) => `<div><span><img class="mini" src="${Art.icon(BOONS[id].icon)}" alt="">${BOONS[id].name}</span><b>${BOONS[id].text(v)}</b></div>`).join('') : '');
  }

  function startGame() {
    if (!save.chars[selectedChar]) selectedChar = 'mago';
    // No celular, entra em tela cheia (precisa vir de um toque do jogador).
    const root = document.documentElement;
    if (isTouch && !document.fullscreenElement && root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    }
    resetWorld();
    addWeapon(CHARACTERS[selectedChar].weapon, 0);
    // Uma fogueira perto do início para o jogador descobrir a mecânica.
    spawnStructure('totem', 380);
    // Altar Maior: invoca o chefão final quando você quiser
    spawnStructure('grandaltar', 1000);
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
    // As moedas só vêm do chão (raras) e dos desafios (já somadas quando concluídos).
    const total = Math.round(runCoins);
    const st = save.stats;
    const newRecord = time > st.bestTime;
    st.bestTime = Math.max(st.bestTime, time);
    st.bestLevel = Math.max(st.bestLevel, player.level);
    st.bestKills = Math.max(st.bestKills, kills);
    st.bosses += player.bossKills;
    st.kills += kills;
    st.runs += 1;
    st.elites += run.eliteKills;
    st.bestHitless = Math.max(st.bestHitless || 0, run.bestHitless, time - run.lastHurt);
    st.bestThreat = Math.max(st.bestThreat || 0, run.maxThreat);
    st.coinsTotal = (st.coinsTotal || 0) + total;
    save.coins += total;
    inRun = false;
    checkChallenges();
    persist();
    const parts = [['Moedas coletadas', total]];
    if (run.chalCoins) parts.push(['Desafios concluídos', run.chalCoins]);
    return { parts, total: total + run.chalCoins, newRecord };
  }

  // Venceu o chefão final: libera a próxima dificuldade e a próxima fase.
  // A partida continua: a Ameaça começa a subir e os inimigos ficam cada vez mais fortes.
  function stageClear() {
    const prev = save.stages[run.stage] || 0;
    save.stages[run.stage] = Math.max(prev, run.diff + 1);
    run.cleared = true;
    run.clearTime = time;
    run.firstClear = prev < run.diff + 1;
    run.nextOver = time + 60;
    completeChallenge(run.stage);
    if (run.diff === 2) completeChallenge('pesadelo');
    save.stats.winChars = save.stats.winChars || {};
    save.stats.winChars[player.char] = true;
    if (!run.usedBonfire) completeChallenge('semfogueira');
    if (Object.keys(weapons).length === 1) completeChallenge('umaarma');
    persist();
    Sound.play('levelup');
    player.invuln = Math.max(player.invuln, 2);
    if (run.diff < 2) {
      // portal para a próxima dificuldade, levando tudo que foi conquistado
      const a = rand(0, TAU);
      structures.push({ kind: 'portal', x: player.x + Math.cos(a) * 320, y: player.y + Math.sin(a) * 240, r: 60, charge: 0, need: 2.5, used: false, fade: 1 });
      setTimeout(() => showBanner(`Um portal para o ${DIFFS[run.diff + 1].name} se abriu!`, DIFFS[run.diff + 1].color), 2700);
    } else {
      setTimeout(() => showBanner('Fase concluída! Agora sobreviva: a Ameaça vai subir.', '#ffd36b'), 2700);
    }
  }

  // Entrou no portal: mesma fase na dificuldade seguinte, com as mesmas armas, passivas e bênçãos.
  function enterPortal() {
    run.diff++;
    run.stageStart = time;
    run.finalSpawned = false;
    run.cleared = false;
    run.firstClear = false;
    const D = DIFFS[run.diff];
    // limpa o mapa (o XP que estava no chão vai direto para o jogador)
    let xp = 0;
    for (const p of pickups) if (p.kind === 'xp') xp += p.v;
    pickups = pickups.filter((p) => p.kind === 'coin' || p.kind === 'chest');
    for (const p of pickups) { p.x = player.x + rand(-60, 60); p.y = player.y + rand(-60, 60); }
    enemies = [];
    lanes = [];
    strikes = [];
    eshots = [];
    epools = [];
    summons = [];
    meteors = [];
    structures = [];
    nextBoss = time + BOSS_INTERVAL;
    nextSwarm = time + 60;
    Art.setBiome(STAGES[run.stage].biome, run.diff);
    spawnStructure('totem', 380);
    spawnStructure('grandaltar', 1000);
    if (xp) gainXp(xp);
    player.invuln = 3;
    levelFx = 1;
    shake = 14;
    Sound.play('boss');
    sparks(player.x, player.y - 20, D.color, 80, 460);
    ringFx(player.x, player.y, 240, D.color);
    showBanner(`${STAGES[run.stage].name} · ${D.name}!`, D.color);
    updateMusic();
  }

  // Nível de Ameaça depois de vencer o chefão final: sobe 1 a cada 30 segundos.
  const threat = () => (run && run.cleared ? 1 + Math.floor((time - run.clearTime) / 30) : 0);
  const threatHp = () => 1 + threat() * 0.2;
  const threatDmg = () => 1 + threat() * 0.12;
  const threatAtk = () => Math.min(2.5, 1 + threat() * 0.12);

  function gameOver() {
    Sound.play('death');
    showResult(run.cleared, run.firstClear);
  }

  function showResult(won, firstClear) {
    const { parts, total, newRecord } = endRun();
    const idx = STAGE_IDS.indexOf(run.stage);
    let unlockMsg = '';
    if (won && firstClear) {
      const msgs = [];
      if (run.diff < 2) msgs.push(`Dificuldade ${DIFFS[run.diff + 1].name} liberada`);
      if (run.diff === 0 && STAGE_IDS[idx + 1]) msgs.push(`Nova fase: ${STAGES[STAGE_IDS[idx + 1]].name}`);
      unlockMsg = msgs.map((m) => `<p class="new">${m}!</p>`).join('');
    }
    $('resultTitle').textContent = won ? 'Fase concluída!' : 'Você morreu';
    const threatRow = run.cleared ? `<div><span>Ameaça alcançada</span><b>${threat()}</b></div>` : '';
    $('resultTitle').className = won ? 'victory' : 'danger';
    $('stats').innerHTML = `
      <div><span>Fase</span><b>${STAGES[run.stage].name} · ${DIFFS[run.diff].name}</b></div>`
      + `
      <div><span>Personagem</span><b>${CHARACTERS[player.char].name}</b></div>
      <div><span>Tempo sobrevivido</span><b>${fmtTime(time)}</b></div>
      <div><span>Nível alcançado</span><b>${player.level}</b></div>
      ${threatRow}
      ${newRecord ? '<p class="new">Novo recorde!</p>' : ''}
      ${unlockMsg}
      <h3 class="earnhead">Moedas ganhas</h3>
      ${parts.map(([k, v]) => `<div><span>${k}</span><b>+${v}</b></div>`).join('')}
      <div class="total"><span>Total</span><b><img src="${Art.icon('coin')}" alt="">+${total}</b></div>
      `;
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

  $('homePlay').addEventListener('click', () => setState('stages'));
  $('stagesBack').addEventListener('click', () => setState('home'));
  $('stagesNext').addEventListener('click', () => setState('chars'));
  $('homeShop').addEventListener('click', () => setState('shop'));
  $('homeChal').addEventListener('click', () => setState('challenges'));
  $('chalBack').addEventListener('click', () => setState('home'));
  $('homeSettings').addEventListener('click', () => { settingsReturn = 'home'; setState('settings'); });
  $('charsBack').addEventListener('click', () => setState('stages'));
  $('charsPlay').addEventListener('click', startGame);
  $('shopBack').addEventListener('click', () => setState('home'));
  $('settingsBack').addEventListener('click', () => setState(settingsReturn));
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Apagar todo o progresso (moedas, compras, desafios e recordes)?')) return;
    save = defaultSave();
    persist();
    selectedChar = 'mago';
    applySettings();
    toast('Progresso apagado');
    renderSettings();
  });
  $('restartBtn').addEventListener('click', startGame);
  $('stagesBtn').addEventListener('click', () => { resetWorld(); setState('stages'); });
  $('resumeBtn').addEventListener('click', () => setState('playing'));
  $('pauseSettings').addEventListener('click', () => { settingsReturn = 'paused'; setState('settings'); });
  $('pauseBtn').addEventListener('click', () => { if (state === 'playing') setState('paused'); });
  $('quitBtn').addEventListener('click', quitToHome);
  $('menuBtn').addEventListener('click', quitToHome);

  // ============================================================
  // Subir de nível, baús, fogueiras e recompensas
  // ============================================================
  // Raridade das cartas: multiplica o valor do bônus (6% de crítico vira 10%, 16% ou 23%).
  const RARITY = [
    { name: 'Comum', cls: '', mult: 1 },
    { name: 'Raro', cls: 'rare', mult: 5 / 3 },
    { name: 'Épico', cls: 'epic', mult: 8 / 3 },
    { name: 'Lendário', cls: 'legend', mult: 23 / 6 },
  ];

  // Chance de cada raridade. A Sorte aumenta muito as raras:
  // sorte 0 -> 81% comum, 15% raro, 3% épico, 0,5% lendário
  // sorte 5 -> 48% comum, 33% raro, 14% épico, 6% lendário
  function rarityWeights(minRarity) {
    const L = Math.max(0, effLuck());
    const w = [100, 18 + L * 10, 4 + L * 5, 0.6 + L * 2.2];
    for (let i = 0; i < minRarity; i++) w[i] = 0;
    return w;
  }

  function rollRarity(minRarity) {
    const w = rarityWeights(minRarity);
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) {
      r -= w[i];
      if (r <= 0) return i;
    }
    return minRarity;
  }

  // Arma nova ou um nível a mais, com o bônus multiplicado pela raridade.
  // Bônus extras de uma carta de arma: Raro 1, Épico 2, Lendário 3,
  // sorteados entre as outras melhorias da arma (valor de um nível comum).
  function weaponExtras(id, lv, rarity) {
    const def = WEAPONS[id];
    const main = lv > 0 ? def.ups[lv - 1].map(([st]) => st) : [];
    const pool = [];
    for (const up of def.ups) {
      for (const [st, v] of up) {
        if (!main.includes(st) && !pool.some(([p]) => p === st)) pool.push([st, v]);
      }
    }
    return shuffle(pool).slice(0, rarity);
  }

  function addWeapon(id, rarity, extras) {
    const def = WEAPONS[id];
    const mult = RARITY[rarity || 0].mult;
    let w = weapons[id];
    if (w) {
      if (w.level >= def.max) return;
      for (const [stat, v] of def.ups[w.level - 1]) applyStat(w.s, stat, v * mult);
      w.level++;
      if (w.level >= def.max) completeChallenge('mestre');
    } else {
      // arma nova de raridade alta já começa com mais dano
      const s = Object.assign({ cdMul: 1 }, def.base);
      s.dmg *= 1 + (mult - 1) * 0.3;
      w = weapons[id] = { level: 1, timer: 0.3, angle: 0, blades: [], s };
    }
    for (const [stat, v] of extras || []) applyStat(w.s, stat, v);
  }

  function weaponUpText(id, lv, mult) {
    const def = WEAPONS[id];
    return def.ups[lv - 1].map(([stat, v]) => statText(def, stat, v * mult)).join(' · ');
  }

  // Armas e passivas misturadas, respeitando os espaços livres.
  function buildChoices(isChest) {
    const pool = [];
    const weaponsFull = Object.keys(weapons).length >= weaponSlots();
    const passivesFull = Object.keys(passiveLevels).length >= passiveSlots();
    for (const id in WEAPONS) {
      const lv = weapons[id] ? weapons[id].level : 0;
      if (lv >= WEAPONS[id].max || run.banned.has(id)) continue;
      if (lv === 0 && !isUnlocked(WEAPONS[id], id)) continue;
      if (lv === 0 && weaponsFull) continue;
      pool.push({ kind: 'weapon', id, lv });
    }
    for (const id in PASSIVES) {
      const lv = passiveLevels[id] || 0;
      if (lv >= PASSIVES[id].max || run.banned.has(id)) continue;
      if (lv === 0 && !isUnlocked(PASSIVES[id], id)) continue;
      if (lv === 0 && passivesFull) continue;
      pool.push({ kind: 'passive', id, lv });
    }
    const count = 3 + (Math.random() < effLuck() * 0.08 ? 1 : 0);
    const picks = shuffle(pool).slice(0, count);
    for (const c of picks) {
      c.rarity = rollRarity(isChest ? 1 : 0);
      if (c.kind === 'weapon') c.extras = weaponExtras(c.id, c.lv, c.rarity);
    }
    if (picks.length === 0) {
      picks.push({ kind: 'heal', id: 'heal', rarity: 0 });
      picks.push({ kind: 'gold', id: 'coin', rarity: 0 });
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
    banishMode = false;
    if (mode === 'level') Sound.play('levelup');
    renderChoices();
    setState('levelup');
  }

  function renderChoices() {
    const mode = currentChoices.mode;
    $('choiceTitle').textContent = mode === 'chest' ? 'Baú do tesouro!' : mode === 'shrine' ? 'Fogueira acesa' : 'Subiu de nível!';
    $('choiceSub').textContent = mode === 'chest' ? 'Recompensas raras ou melhores garantidas'
      : mode === 'shrine' ? 'Escolha uma bênção (não ocupa espaço). A Sorte deixa as bênçãos mais fortes.'
        : `Espaços: armas ${Object.keys(weapons).length}/${weaponSlots()} · passivas ${Object.keys(passiveLevels).length}/${passiveSlots()} · Sorte ${fmtNum(effLuck())}`;
    const cards = $('cards');
    cards.innerHTML = '';
    currentChoices.forEach((c, i) => {
      let name;
      let tag;
      let desc;
      let color;
      let ribbon = '';
      let cls = '';
      let iconId = c.id;
      if (c.kind === 'weapon') {
        const def = WEAPONS[c.id];
        const mult = RARITY[c.rarity].mult;
        name = def.name; color = def.color;
        if (c.lv === 0) {
          tag = 'Nova arma';
          desc = def.desc + (c.rarity > 0 ? `<br><b>+${pct((mult - 1) * 0.3)} de dano base</b>` : '');
        } else {
          tag = `Arma · nível ${c.lv + 1}/${def.max}`;
          desc = `<b>${weaponUpText(c.id, c.lv, mult)}</b>`;
        }
        if (c.extras && c.extras.length) {
          desc += `<div class="extras">${c.extras.map(([st, v]) => `<span>+ ${statText(def, st, v)}</span>`).join('')}</div>`;
        }
      } else if (c.kind === 'passive') {
        const def = PASSIVES[c.id];
        name = def.name; color = '#8fd3a0';
        tag = `${c.lv === 0 ? 'Nova passiva' : 'Passiva'} · nível ${c.lv + 1}/${def.max}`;
        desc = `<b>${def.text(passiveValue(c.id, c.rarity))}</b>`;
      } else if (c.kind === 'boon') {
        const def = BOONS[c.id];
        const tier = TIERS[c.tier];
        name = def.name; desc = def.text(c.value); color = BONFIRE_COLOR; iconId = def.icon;
        tag = `Bênção ${tier.name.toLowerCase()}`;
        cls = tier.cls;
        ribbon = tier.name;
      } else if (c.kind === 'gold') {
        name = 'Poder Bruto'; tag = 'Tudo no máximo'; desc = '+5% de dano em todas as armas.'; color = '#ffd36b'; iconId = 'might';
      } else {
        name = 'Poção'; tag = 'Consumível'; desc = 'Recupera 40 de vida.'; color = '#ff4f6a';
      }
      if (c.kind === 'weapon' || c.kind === 'passive') {
        const rar = RARITY[c.rarity];
        cls = rar.cls;
        ribbon = c.rarity > 0 ? rar.name : '';
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
        <div class="key">${isTouch ? 'Toque para escolher' : 'Clique ou tecla ' + (i + 1)}</div>`;
      card.addEventListener('click', () => (banishMode ? banishChoice(i) : choose(i)));
      cards.appendChild(card);
    });
    cards.classList.toggle('banishing', banishMode);
    renderChoiceTools();
  }

  // ---------- Atualizar, Banir e Pular (comprados na Loja) ----------
  let banishMode = false;

  function renderChoiceTools() {
    const box = $('choiceTools');
    box.innerHTML = '';
    if (currentChoices.mode === 'shrine') return;
    const tools = [
      ['reroll', 'Atualizar', run.rerolls, rerollChoices],
      ['banish', banishMode ? 'Cancelar' : 'Banir', run.banishes, toggleBanish],
      ['skip', 'Pular', run.skips, skipChoice],
    ];
    for (const [icon, label, uses, fn] of tools) {
      if (!optionUses(icon)) continue; // ainda não comprado
      const b = document.createElement('button');
      b.className = 'tool' + (icon === 'banish' && banishMode ? ' active' : '');
      b.innerHTML = `<img src="${Art.icon(icon)}" alt="">${label} <b>${uses}</b>`;
      b.disabled = uses <= 0 && !(icon === 'banish' && banishMode);
      b.addEventListener('click', fn);
      box.appendChild(b);
    }
  }

  function rerollChoices() {
    if (state !== 'levelup' || run.rerolls <= 0) return;
    run.rerolls--;
    banishMode = false;
    const mode = currentChoices.mode;
    currentChoices = buildChoices(mode === 'chest');
    currentChoices.mode = mode;
    Sound.play('select');
    renderChoices();
  }

  function toggleBanish() {
    if (state !== 'levelup' || (run.banishes <= 0 && !banishMode)) return;
    banishMode = !banishMode;
    Sound.play('click');
    renderChoices();
  }

  // A arma ou passiva banida some da partida; a carta é trocada por outra.
  function banishChoice(i) {
    const c = currentChoices[i];
    banishMode = false;
    if (!c || (c.kind !== 'weapon' && c.kind !== 'passive') || run.banishes <= 0) { renderChoices(); return; }
    run.banishes--;
    run.banned.add(c.id);
    Sound.play('denied');
    const shown = new Set(currentChoices.map((o) => o.id));
    const fresh = buildChoices(currentChoices.mode === 'chest').find((o) => !shown.has(o.id) && (o.kind === 'weapon' || o.kind === 'passive'));
    if (fresh) currentChoices[i] = fresh;
    else currentChoices.splice(i, 1);
    if (!currentChoices.length) currentChoices.push({ kind: 'heal', id: 'heal', rarity: 0 });
    toast(`${(c.kind === 'weapon' ? WEAPONS : PASSIVES)[c.id].name} banido desta partida`);
    renderChoices();
  }

  function skipChoice() {
    if (state !== 'levelup' || run.skips <= 0) return;
    run.skips--;
    banishMode = false;
    finishChoice();
  }

  function choose(i) {
    if (state !== 'levelup') return;
    const c = currentChoices[i];
    if (!c) return;
    if ((c.kind === 'weapon' || c.kind === 'passive') && c.rarity === 3) completeChallenge('lenda');
    if (c.kind === 'weapon') addWeapon(c.id, c.rarity, c.extras);
    else if (c.kind === 'passive') {
      passiveLevels[c.id] = (passiveLevels[c.id] || 0) + 1;
      PASSIVES[c.id].apply(passiveValue(c.id, c.rarity));
    } else if (c.kind === 'boon') {
      BOONS[c.id].apply(c.value);
      boonsTaken[c.id] = (boonsTaken[c.id] || 0) + c.value;
    } else if (c.kind === 'gold') player.dmgMul += 0.05;
    else heal(40);
    sparks(player.x, player.y - 15, '#ffd36b', 16, 260);
    Sound.play('select');
    finishChoice();
  }

  function finishChoice() {
    if (currentChoices.mode === 'chest') pendingChests--;
    else if (currentChoices.mode === 'shrine') pendingShrines--;
    else pendingLevels--;
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
      if (player.char === 'berserker') player.healMul += 0.05;
      if (player.char === 'arqueira' && player.level % 8 === 0) {
        player.extraProj += 1;
        addText(player.x, player.y - 60, '+1 projétil', '#8fd36a', true);
      }
    }
  }

  function heal(v) {
    player.hp = Math.min(player.maxHp, player.hp + v * player.healMul);
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
      } else if (kind === 'grandaltar') {
        structures.push({ kind, x, y, r: 95, charge: 0, need: 4, used: false, fade: 1 });
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
      structures = structures.filter((s) => s.kind === 'grandaltar' || s.kind === 'portal' || (Math.hypot(s.x - player.x, s.y - player.y) < 2600 && s.fade > 0));
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
        } else if (s.kind === 'portal' && Math.random() < dt * 20) {
          const a = rand(0, TAU);
          fx({ kind: 'dot', add: true, x: s.x + Math.cos(a) * s.r, y: s.y + Math.sin(a) * s.r * 0.45, vx: -Math.cos(a) * 40, vy: rand(-90, -40), life: rand(0.6, 1.1), color: DIFFS[Math.min(2, run.diff + 1)].color, size: rand(1.5, 3.5), drag: 0.98 });
        } else if (s.kind === 'grandaltar' && !s.used && Math.random() < dt * 14) {
          fx({ kind: 'dot', add: true, x: s.x + rand(-90, 90), y: s.y + rand(-40, 40), vx: 0, vy: rand(-60, -30), life: rand(0.8, 1.4), color: Math.random() < 0.7 ? '#c77dff' : '#ffd36b', size: rand(1.5, 3), drag: 0.99 });
        } else if (s.kind === 'altar' && !s.used && Math.random() < dt * 10) {
          fx({ kind: 'dot', add: true, x: s.x + rand(-50, 50), y: s.y + rand(-20, 20), vx: 0, vy: rand(-50, -25), life: rand(0.6, 1.1), color: '#ff3355', size: rand(1.5, 3), drag: 0.99 });
        }
      }
      if (s.used) {
        if (s.kind !== 'grandaltar') s.fade -= dt * 0.08;
        continue;
      }
      const inside = Math.hypot(s.x - player.x, s.y - player.y) < s.r;
      s.charge = inside ? s.charge + dt : Math.max(0, s.charge - dt * 2);
      if (s.charge >= s.need) {
        s.used = true;
        if (s.kind === 'totem') activateTotem(s);
        else if (s.kind === 'grandaltar') activateGrandAltar(s);
        else if (s.kind === 'portal') { enterPortal(); return; }
        else activateAltar(s);
      }
    }
  }

  function activateTotem(s) {
    run.usedBonfire = true;
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
    // o chefão aparece só depois de um tempo, para dar tempo de se posicionar
    summons.push({ x: s.x, y: s.y - 90, t: SUMMON_TIME, max: SUMMON_TIME, final: false });
    showBanner('Um chefão está vindo!', '#ff3355');
  }

  function activateGrandAltar(s) {
    Sound.play('altar');
    sparks(s.x, s.y - 60, '#c77dff', 80, 420);
    ringFx(s.x, s.y, 200, '#c77dff');
    smoke(s.x, s.y, 12, '#2a1a36');
    shake = 16;
    run.finalSpawned = true; // o relógio não invoca outro
    summons.push({ x: s.x, y: s.y + 150, t: SUMMON_TIME + 0.5, max: SUMMON_TIME + 0.5, final: true });
    showBanner('O chefão final está vindo!', '#c77dff');
  }

  // Invocações em andamento: círculo no chão e coluna de luz até o chefão nascer.
  function updateSummons(dt) {
    for (const m of summons) {
      m.t -= dt;
      const color = m.final ? '#c77dff' : '#ff3355';
      if (Math.random() < dt * 30) {
        const a = rand(0, TAU);
        const d = rand(10, 70);
        fx({ kind: 'dot', add: true, x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d * 0.6, vy: rand(-160, -60), life: rand(0.4, 0.8), color, size: rand(2, 4), drag: 0.98 });
      }
      if (m.t <= 0) {
        sparks(m.x, m.y, color, 50, 380);
        ringFx(m.x, m.y, 120, color);
        shake = Math.max(shake, 10);
        if (m.final) {
          run.finalSpawned = false;
          spawnFinal(m.x, m.y);
        } else {
          spawnBoss(m.x, m.y, 1.3);
          showBanner('Você invocou um chefão!', '#ff3355');
        }
      }
    }
    summons = summons.filter((m) => m.t > 0);
  }

  // ============================================================
  // Inimigos
  // ============================================================
  function pickEnemyType() {
    return STAGES[run.stage].pick(time, Math.random());
  }

  function spawnPoint() {
    const a = rand(0, TAU);
    // nasce bem fora da tela, para dar tempo de ver chegando
    const d = Math.hypot(W, H) / 2 + 110;
    return { x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d };
  }

  function spawnEnemy(type, x, y, hpMul) {
    const T = ENEMY_TYPES[type];
    if (x === undefined) ({ x, y } = spawnPoint());
    // Fica mais forte com o tempo (7 min = 8x a vida) e com a dificuldade.
    const D = DIFFS[run.diff];
    const m = time / 60;
    const hp = T.hp * (1 + m * 0.7 + m * m * 0.04) * D.hp * threatHp() * (hpMul || 1);
    const base = CHARACTERS[player.char].speed;
    const e = {
      type, x, y, r: T.r, hp, maxHp: hp,
      // fica sempre abaixo de 60% da velocidade base do personagem
      speed: base * Math.min(0.6, T.speed * (1 + Math.min(time / 600, 0.1))),
      dmg: T.dmg * (1 + m * 0.14) * D.dmg * threatDmg(),
      xp: T.xp, color: T.color, boss: !!T.boss, final: !!T.final, armor: T.armor || 1,
      flash: 0, kbx: 0, kby: 0, orbitCd: 0, phase: rand(0, TAU), summonT: 3, dead: false,
      lungeCd: rand(1, 3), windup: 0, dashT: 0, dashX: 0, dashY: 0, missileT: 2.5,
      slamT: 2.5, slamWind: 0, fireT: 3, bornAt: time, elite: false,
      fuse: 0, throwT: rand(2, 5), waveT: 3, starT: 2.5, rainT: 4,
    };
    enemies.push(e);
    return e;
  }

  // Mini-chefe: versão maior e dourada de um inimigo comum, com bem mais vida.
  function spawnElite(type) {
    const e = spawnEnemy(type || pickEnemyType(), undefined, undefined, 5);
    e.elite = true;
    e.r = Math.round(e.r * 1.4);
    e.dmg *= 1.5;
    e.speed *= 0.92;
    e.xp *= 6;
    Sound.play('growl');
    return e;
  }

  function spawnFinal(x, y) {
    run.finalSpawned = true;
    const e = spawnEnemy(STAGES[run.stage].final, x, y);
    e.bornAt = time;
    smoke(x, y, 16, '#2a1a24');
    Sound.play('boss');
    showBanner(`${ENEMY_TYPES[e.type].name} chegou! Derrote-o para vencer.`, '#ff4f6a');
    shake = 12;
    for (const s of structures) if (s.kind === 'grandaltar') s.used = true;
    return e;
  }

  function spawnBoss(x, y, extraMul) {
    bossesSpawned++;
    const order = STAGES[run.stage].bosses;
    const type = order[(bossesSpawned - 1) % order.length];
    // Cada chefão seguinte é mais forte que o anterior.
    const mul = (1 + (bossesSpawned - 1) * 0.5) * (extraMul || 1);
    const e = spawnEnemy(type, x, y, mul);
    e.bornAt = time;
    smoke(x, y, 12, '#2a1a24');
    Sound.play('boss');
    return e;
  }

  function updateSpawning(dt) {
    // Começo tranquilo (pouquinhos até a primeira horda), depois acelera aos poucos.
    // enquanto o chefão final vive, a horda aperta
    // com o chefão final vivo a horda aperta; depois de vencê-lo, a Ameaça aumenta ainda mais
    const rush = run.cleared ? 1.3 * (1 + threat() * 0.1) : run.finalSpawned ? 1.6 : 1;
    const rate = spawnRate(time) * DIFFS[run.diff].spawn * rush;
    spawnAcc += rate * dt;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      if (enemies.length >= MAX_ENEMIES) continue;
      // a cada 15 inimigos, nasce um mini-chefe (no máximo 3 ao mesmo tempo)
      run.spawned++;
      if (run.spawned % 15 === 0 && enemies.filter((e) => e.elite && !e.dead).length < 3) spawnElite();
      else spawnEnemy(pickEnemyType());
    }

    if (time >= nextSwarm) {
      // Enxame: um anel de inimigos fechando em volta do jogador.
      nextSwarm += 50;
      const n = 8 + Math.floor(time / 15);
      const d = Math.hypot(W, H) / 2 + 20;
      const sw = STAGES[run.stage].swarm;
      const type = time > 100 ? sw[1] : sw[0];
      for (let i = 0; i < n && enemies.length < MAX_ENEMIES + 40; i++) {
        const a = (i / n) * TAU;
        spawnEnemy(type, player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
      }
      showBanner('Cuidado, um enxame!');
      Sound.play('swarm');
    }

    const stageT = time - run.stageStart;
    if (!run.finalSpawned && stageT >= STAGE_TIME) {
      const p = spawnPoint();
      spawnFinal(p.x, p.y);
    }

    if (time >= nextBoss && stageT < STAGE_TIME - 20 && !run.finalSpawned) {
      nextBoss += BOSS_INTERVAL;
      const p = spawnPoint();
      spawnBoss(p.x, p.y);
      showBanner('Um chefão apareceu!');
    }

    // Depois da vitória, um chefão a cada minuto (o final também volta), cada vez mais forte.
    if (run.cleared && time >= run.nextOver) {
      run.nextOver = time + 60;
      const S = STAGES[run.stage];
      const list = [...S.bosses, S.final];
      const type = list[run.overIdx++ % list.length];
      const p = spawnPoint();
      const e = spawnEnemy(type, p.x, p.y, 1 + bossesSpawned * 0.3);
      e.bornAt = time;
      bossesSpawned++;
      smoke(p.x, p.y, 12, '#2a1a24');
      Sound.play('boss');
      showBanner(`${ENEMY_TYPES[type].name} voltou mais forte! (Ameaça ${threat()})`, '#ff4f6a');
    }
  }

  function damageEnemy(e, base, kx, ky) {
    if (e.dead) return;
    let dmg = base * effDmgMul() * e.armor;
    const crit = Math.random() < player.crit;
    if (crit) dmg *= player.critMul;
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

  // Chance de uma moeda dourada cair: maior na dificuldade alta, com Sorte e com a bênção Ganância.
  const coinChance = (base) => base * DIFFS[run.diff].coins * player.coinMul * (1 + effLuck() * 0.08);
  const dropCoin = (x, y) => pickups.push({ kind: 'coin', x, y, v: 1 });

  function killEnemy(e) {
    e.dead = true;
    kills++;
    Sound.play(e.boss ? 'bossdeath' : 'kill');
    burst(e.x, e.y, e.color, e.boss ? 40 : 7, e.boss ? 280 : 150);
    ringFx(e.x, e.y, e.r * 1.4, '#ffffff');
    smoke(e.x, e.y, e.boss ? 14 : 1);
    if (player.lifesteal > 0 && Math.random() < player.lifesteal && player.hp < player.maxHp) {
      heal(3);
      sparks(player.x, player.y - 15, '#ff3a5a', 4, 120);
    }
    if (e.boss) {
      for (let i = 0; i < 12; i++) dropXp(e.x + rand(-50, 50), e.y + rand(-50, 50), 5);
      // chefão: 1 moeda; chefão final: 2 + 1 por nível de dificuldade
      const nCoins = e.final ? 2 + run.diff : 1;
      for (let i = 0; i < nCoins; i++) dropCoin(e.x - 40 + i * 30, e.y + 30);
      pickups.push({ kind: 'chest', x: e.x, y: e.y });
      pickups.push({ kind: 'heart', x: e.x + 34, y: e.y, v: 50 });
      player.bossKills++;
      if (player.char === 'mercenario') addText(player.x, player.y - 50, '+10% de dano', '#ffd36b', true);
      if (e.final && time - e.bornAt < 45) completeChallenge('relampago');
      if (e.final && !run.cleared) stageClear();
      const fight = time - e.bornAt;
      if (e.type === 'boss' && fight < 30) completeChallenge('ogro');
      if (e.type === 'lich' && fight < 40) completeChallenge('lich');
      if (e.type === 'robo' && !e.missileHit) completeChallenge('robo');
      if (player.bossKills >= 3) completeChallenge('trinca');
      shake = 14;
      sparks(e.x, e.y, '#ffd36b', 50, 420);
      if (player.char === 'mago') {
        player.luck += 1;
        addText(player.x, player.y - 50, '+1 Sorte', '#5fe8ff', true);
      }
      showBanner(e.final ? 'Fase concluída!' : 'Chefão derrotado! Pegue o baú.', '#ffd36b');
    } else if (e.elite) {
      run.eliteKills++;
      dropXp(e.x, e.y, e.xp);
      if (Math.random() < coinChance(0.06)) dropCoin(e.x + 20, e.y + 10);
      if (Math.random() < 0.15) pickups.push({ kind: 'heart', x: e.x + 20, y: e.y, v: 25 });
      if (Math.random() < 0.04) pickups.push({ kind: 'magnet', x: e.x - 20, y: e.y });
      if (Math.random() < 0.08 * (1 + effLuck() * 0.2)) pickups.push({ kind: 'chest', x: e.x, y: e.y });
      sparks(e.x, e.y, '#ffd36b', 22, 300);
      shake = Math.max(shake, 5);
    } else {
      dropXp(e.x, e.y, e.xp);
      if (e.type === 'fireslime' && Math.random() < 0.35) epools.push({ x: e.x, y: e.y, r: 28, life: 2.6, dmg: e.dmg * 0.7 });
      if (Math.random() < 0.0015 * (1 + effLuck() * 0.1)) pickups.push({ kind: 'magnet', x: e.x, y: e.y });
      else if (Math.random() < 0.005 * (1 + effLuck() * 0.15)) pickups.push({ kind: 'heart', x: e.x, y: e.y, v: 25 });
      else if (Math.random() < coinChance(0.0007)) dropCoin(e.x, e.y);
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
    run.bestHitless = Math.max(run.bestHitless, time - run.lastHurt);
    run.lastHurt = time;
    shake = Math.max(shake, 7);
    hurtFlash = 1;
    Sound.play('hurt');
    sparks(player.x, player.y - 15, '#ff4444', 8, 220);
    addText(player.x, player.y - 40, '-' + dmg, '#ff5555', true);
    if (player.hp <= 0 && run.revives > 0) {
      // Segunda Chance: volta com metade da vida e empurra os inimigos
      run.revives--;
      player.hp = Math.round(player.maxHp * 0.5);
      player.invuln = 3;
      areaDamage(player.x, player.y, 220, 0, 900);
      ringFx(player.x, player.y, 220, '#ffd36b');
      sparks(player.x, player.y - 20, '#ffd36b', 60, 420);
      Sound.play('levelup');
      showBanner('Segunda Chance!', '#ffd36b');
      return;
    }
    if (player.hp <= 0) {
      player.hp = 0;
      burst(player.x, player.y, CHARACTERS[player.char].accent, 40, 260);
      smoke(player.x, player.y, 10);
      gameOver();
    }
  }

  // Explosão de inimigo (bombardeiro): fere o jogador, não os outros inimigos.
  function enemyBlast(x, y, r, dmg) {
    Sound.play('explosion');
    explosions.push({ x, y, r, life: 0.4 });
    sparks(x, y, '#ffb347', 16, 320);
    smoke(x, y, 5, '#4a4040');
    shake = Math.max(shake, 5);
    if (Math.hypot(player.x - x, player.y - y) < r + player.r * 0.5 && player.invuln <= 0 && state === 'playing') hurtPlayer(dmg);
  }

  function enemyShot(e, kind, speed, r, dmg) {
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    eshots.push({ kind, x: e.x, y: e.y - e.r * 0.4, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, life: 3 });
  }

  // Faixas em leque saindo do inimigo, apontadas para o jogador.
  function laneFan(e, kind, offsets, o) {
    const base = Math.atan2(player.y - e.y, player.x - e.x);
    for (const off of offsets) {
      lanes.push(Object.assign({ kind, x: e.x, y: e.y, a: base + off, len: 640, w: 60, t: 1.1, max: 1.1, pos: 0, burn: 1.4, dmg: e.dmg, hit: false }, o));
    }
  }

  // Comportamentos especiais. Devolve true quando o inimigo deve ficar parado neste quadro.
  const ENEMY_BEHAVIOR = {
    // Bruxa: lança uma maldição lenta de longe.
    witch(e, dt, d) {
      e.throwT -= dt;
      if (e.throwT <= 0 && d < 420) {
        e.throwT = rand(5, 8);
        enemyShot(e, 'curse', 200, 9, e.dmg);
      }
      return false;
    },
    hydra(e, dt) {
      const angry = e.hp < e.maxHp * 0.5 ? 0.7 : 1;
      e.fireT -= dt;
      if (e.fireT <= 0) {
        // três cabeças cospem faixas de veneno
        e.fireT = 5 * angry;
        laneFan(e, 'fire', [-0.5, 0, 0.5], { len: 720, w: 56, t: 1.3, max: 1.3, burn: 1.6, tint: 'poison', dmg: e.dmg * 0.8 });
        Sound.play('warn');
      }
      e.rainT -= dt;
      if (e.rainT <= 0) {
        e.rainT = 4.2 * angry;
        for (let i = 0; i < 5; i++) {
          const tx = player.x + (i === 0 ? 0 : rand(-200, 200));
          const ty = player.y + (i === 0 ? 0 : rand(-150, 150));
          strikes.push({ x: tx, y: ty, r: 52, t: 1.3, max: 1.3, dmg: e.dmg * 0.5, look: 'poison', fromX: e.x, fromY: e.y });
        }
      }
      return false;
    },
    pharaoh(e, dt) {
      const angry = e.hp < e.maxHp * 0.5 ? 0.7 : 1;
      e.waveT -= dt;
      if (e.waveT <= 0) {
        // ondas de areia em cruz, apontadas para o jogador
        e.waveT = 4.4 * angry;
        laneFan(e, 'wave', [0, Math.PI / 2, Math.PI, -Math.PI / 2], { len: 760, w: 62, col: '230,190,110', dmg: e.dmg });
        Sound.play('warn');
      }
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = 8;
        for (let i = 0; i < 4 && enemies.length < MAX_ENEMIES + 60; i++) {
          const a = (i / 4) * TAU;
          spawnEnemy('mummy', e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80);
        }
        sparks(e.x, e.y - 30, '#ffd36b', 20, 240);
      }
      return false;
    },
    // Múmia: cospe veneno numa área marcada no chão, que vira uma poça tóxica.
    mummy(e, dt, d) {
      e.throwT -= dt;
      // no máximo uma cusparada a cada 1,5 s somando todas as múmias (para não poluir a tela)
      if (e.throwT <= 0 && d < 380 && time >= (run.nextPoison || 0)) {
        e.throwT = rand(4.5, 7);
        run.nextPoison = time + 1.5;
        const lead = player.moving ? 50 : 0;
        strikes.push({ x: player.x + player.dirX * lead, y: player.y + player.dirY * lead, r: 52, t: 1.2, max: 1.2, dmg: e.dmg * 0.5, look: 'poison', fromX: e.x, fromY: e.y });
        Sound.play('growl');
      }
      return false;
    },
    bomber(e, dt, d) {
      if (e.fuse > 0) {
        e.fuse -= dt;
        if (Math.floor(e.fuse * 12) % 2 === 0) e.flash = 0.05;
        if (e.fuse <= 0) {
          enemyBlast(e.x, e.y, 78, e.dmg * 3);
          e.dead = true;
        }
        return true;
      }
      if (d < 70) {
        e.fuse = 0.9;
        strikes.push({ x: e.x, y: e.y, r: 78, t: 0.9, max: 0.9, dmg: 0, owner: e, mark: true });
        Sound.play('whistle');
      }
      return false;
    },
    yeti(e, dt, d) {
      e.throwT -= dt;
      if (e.throwT <= 0 && d < 420) {
        e.throwT = rand(4.5, 7);
        enemyShot(e, 'snow', 250, 9, e.dmg);
      }
      return false;
    },
    crystalguard(e, dt, d) {
      e.throwT -= dt;
      if (e.throwT <= 0 && d < 380) {
        e.throwT = rand(3.5, 6);
        enemyShot(e, 'shard', 330, 6, e.dmg * 0.8);
        sparks(e.x, e.y - e.r, '#9af0ff', 6, 160);
      }
      return false;
    },
    icetroll(e, dt) {
      // regenera a vida aos poucos
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
      return false;
    },
    ceifador(e, dt) {
      const angry = e.hp < e.maxHp * 0.5 ? 0.7 : 1;
      e.waveT -= dt;
      if (e.waveT <= 0) {
        // cinco ondas de alma em leque
        e.waveT = 4.6 * angry;
        laneFan(e, 'wave', [-0.8, -0.4, 0, 0.4, 0.8], { len: 700, w: 56, col: '200,120,255', dmg: e.dmg });
        Sound.play('warn');
      }
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = 7;
        for (let i = 0; i < 5 && enemies.length < MAX_ENEMIES + 60; i++) {
          const a = (i / 5) * TAU;
          spawnEnemy('ghost', e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
        }
        sparks(e.x, e.y - 30, '#c77dff', 20, 240);
      }
      return false;
    },
    titan(e, dt) {
      const angry = e.hp < e.maxHp * 0.5 ? 0.7 : 1;
      e.rainT -= dt;
      if (e.rainT <= 0) {
        // chuva de meteoros marcados em volta do jogador
        e.rainT = 3.8 * angry;
        for (let i = 0; i < 7; i++) {
          const tx = player.x + (i === 0 ? 0 : rand(-220, 220));
          const ty = player.y + (i === 0 ? 0 : rand(-170, 170));
          strikes.push({ x: tx, y: ty, r: 60, t: 1.5 + i * 0.07, max: 1.5 + i * 0.07, dmg: e.dmg * 0.9, look: 'rock' });
        }
        Sound.play('warn');
      }
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 5.5 * angry;
        laneFan(e, 'fire', [-0.55, 0, 0.55], { len: 760, w: 58, t: 1.3, max: 1.3, burn: 1.6, tint: 'lava', dmg: e.dmg * 0.8 });
      }
      return false;
    },
    rainha(e, dt) {
      const angry = e.hp < e.maxHp * 0.5 ? 0.75 : 1;
      e.starT -= dt;
      if (e.starT <= 0) {
        // estrela de gelo: seis faixas, fique entre elas
        e.starT = 4.4 * angry;
        const off = [];
        for (let i = 0; i < 6; i++) off.push((i / 6) * TAU);
        laneFan(e, 'fire', off, { len: 820, w: 54, t: 1.3, max: 1.3, burn: 1.4, tint: 'ice', dmg: e.dmg * 0.8 });
        Sound.play('warn');
      }
      e.rainT -= dt;
      if (e.rainT <= 0) {
        // estacas de gelo caindo num círculo em volta do jogador
        e.rainT = 5.5 * angry;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + rand(0, 0.5);
          strikes.push({ x: player.x + Math.cos(a) * 110, y: player.y + Math.sin(a) * 85, r: 55, t: 1.4, max: 1.4, dmg: e.dmg * 0.8, look: 'ice' });
        }
        strikes.push({ x: player.x, y: player.y, r: 55, t: 1.9, max: 1.9, dmg: e.dmg * 0.8, look: 'ice' });
      }
      return false;
    },
  };

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
        const w = Math.sin(time * 3 + e.phase) * 22;
        vx += -dy * w;
        vy += dx * w;
      }
      if (e.type === 'werewolf' || e.type === 'yak' || e.type === 'sandworm') {
        // Agacha (aviso) e dá um bote rápido na direção do jogador.
        e.lungeCd -= dt;
        if (e.dashT > 0) {
          e.dashT -= dt;
          const boost = e.type === 'werewolf' ? 3.4 : 2.4;
          vx = e.dashX * e.speed * boost;
          vy = e.dashY * e.speed * boost;
        } else if (e.windup > 0) {
          e.windup -= dt;
          vx = 0;
          vy = 0;
          if (e.windup <= 0) {
            e.dashT = e.type === 'werewolf' ? 0.5 : 0.26;
            e.dashX = dx;
            e.dashY = dy;
            smoke(e.x, e.y + 8, 2, '#8a7a64');
          }
        } else if (e.lungeCd <= 0 && d < (e.type === 'yak' ? 210 : 360)) {
          e.windup = e.type === 'yak' ? 0.55 : 0.65;
          Sound.play('growl');
          e.lungeCd = rand(2.5, 4);
        }
      }
      // com a Ameaça alta, os chefões atacam com mais frequência
      const adt = e.boss ? dt * threatAtk() : dt;
      if (ENEMY_BEHAVIOR[e.type]) {
        const stop = ENEMY_BEHAVIOR[e.type](e, adt, d, dx, dy);
        if (stop) { vx = 0; vy = 0; }
      }
      if (e.type === 'boss') {
        // Rei Ogro: para, marca uma faixa no chão e solta uma onda de choque por ela.
        e.slamT -= adt;
        if (e.slamWind > 0) {
          e.slamWind -= dt;
          vx = 0;
          vy = 0;
        } else if (e.slamT <= 0 && d < 650) {
          e.slamT = Math.max(2.6, 4.2 - bossesSpawned * 0.2);
          e.slamWind = 1.05;
          const base = Math.atan2(dy, dx);
          // a partir do segundo Ogro, são três ondas em leque
          const fan = bossesSpawned > 3 ? [-0.42, 0, 0.42] : [0];
          for (const off of fan) {
            lanes.push({ kind: 'wave', x: e.x, y: e.y, a: base + off, len: 640, w: 66, t: 1.05, max: 1.05, pos: 0, dmg: e.dmg * 1.1, hit: false });
          }
          Sound.play('warn');
          Sound.play('growl');
        }
      }
      if (e.type === 'robo') {
        // Marca áreas no chão; os mísseis caem depois de um tempo para dar chance de desviar.
        e.missileT -= adt;
        if (e.missileT <= 0) {
          e.missileT = 3.4;
          const n = 5 + Math.min(4, Math.floor(bossesSpawned / 2));
          const lead = player.moving ? 90 : 0;
          for (let i = 0; i < n; i++) {
            const tx = player.x + player.dirX * lead + (i === 0 ? 0 : rand(-190, 190));
            const ty = player.y + player.dirY * lead + (i === 0 ? 0 : rand(-150, 150));
            strikes.push({ x: tx, y: ty, r: 58, t: 1.6 + i * 0.08, max: 1.6 + i * 0.08, dmg: e.dmg * 0.9, src: e });
          }
          sparks(e.x, e.y - e.r, '#ff4a3a', 18, 260);
          Sound.play('warn');
          smoke(e.x, e.y - e.r, 6, '#5a5a60');
        }
      }
      if (e.type === 'lich') {
        // O Lich ateia fogo em 3 colunas na direção do jogador:
        // para escapar, saia delas ou fique no vão entre uma e outra.
        e.fireT -= adt;
        if (e.fireT <= 0 && d < 700) {
          e.fireT = Math.max(3.2, 5 - bossesSpawned * 0.2);
          const a = Math.atan2(dy, dx);
          const nx = -Math.sin(a);
          const ny = Math.cos(a);
          const gap = 112;
          for (const k of [-1, 0, 1]) {
            lanes.push({ kind: 'fire', x: e.x - Math.cos(a) * 40 + nx * gap * k, y: e.y - Math.sin(a) * 40 + ny * gap * k, a, len: 780, w: 54, t: 1.3, max: 1.3, burn: 1.5, dmg: e.dmg * 0.8 });
          }
          sparks(e.x, e.y - 30, '#7fffd0', 16, 220);
          Sound.play('warn');
        }
        // e invoca esqueletos ao seu redor
        e.summonT -= adt;
        if (e.summonT <= 0) {
          e.summonT = 6;
          for (let i = 0; i < 3 && enemies.length < MAX_ENEMIES + 60; i++) {
            const a = (i / 3) * TAU;
            spawnEnemy(STAGES[run.stage].fodder, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
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

      // a área de dano é um pouco menor que o desenho, para dar para passar raspando
      if (d < (e.r + player.r) * 0.75 && player.invuln <= 0 && state === 'playing') hurtPlayer(e.dmg);
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
  // Quantidade de projéteis: a parte inteira dos da arma + a parte inteira dos extras.
  const shots = (w) => Math.max(1, Math.floor(w.s.count + 1e-9)) + Math.floor(player.extraProj + 1e-9);
  const cooldown = (w) => Math.max(0.12, w.s.cd * w.s.cdMul * effCd());

  // ---------- Mira ----------
  // Os disparos saem um pouco acima dos pés do personagem.
  const AIM_Y = 13;

  // Alvo preferido: o inimigo mais perto, dando prioridade a quem está na frente
  // (para onde o personagem está andando ou olhando).
  function aimScore(e) {
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    const front = (dx * player.dirX + dy * player.dirY) / d; // 1 = na frente, -1 = atrás
    return d * (1 - 0.3 * front);
  }

  function aimTarget(exclude, maxDist) {
    let best = null;
    let bs = Infinity;
    for (const e of enemies) {
      if (e.dead || (exclude && exclude.has(e))) continue;
      if (maxDist && Math.hypot(e.x - player.x, e.y - player.y) > maxDist) continue;
      const sc = aimScore(e);
      if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  }

  // Vários alvos diferentes, do preferido para o menos preferido.
  function aimTargets(n, maxDist) {
    const list = enemiesOnScreen().filter((e) => !maxDist || Math.hypot(e.x - player.x, e.y - player.y) <= maxDist);
    list.sort((a, b) => aimScore(a) - aimScore(b));
    return list.slice(0, n);
  }

  // Alcance de cada arma: ela só dispara quando há um inimigo dentro dele.
  // (calculado pela distância que o projétil percorre antes de sumir)
  const RANGE = { caveiras: 520, missil: 560, arco: 620, facas: 450, raio: 420, fogo: 540, metralhadora: 520, meteoro: 470, bombardeio: 470 };
  const weaponRange = (id, w) => (id === 'bumerangue' ? w.s.range + 40 : RANGE[id]);

  // Ângulo do ponto de disparo até o centro do inimigo.
  const aimAngle = (t) => Math.atan2(t.y - (player.y - AIM_Y), t.x - player.x);

  const WEAPON_UPDATE = {
    missil(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const target = aimTarget(null, RANGE.missil);
      if (!target) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('ice');
      const n = shots(w);
      const base = aimAngle(target);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.16;
        projectiles.push({
          kind: 'missil', x: player.x, y: player.y - AIM_Y,
          vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
          r: 6, dmg: w.s.dmg, pierce: Math.floor(w.s.pierce + 1e-9), life: 1.4, hit: new Set(),
        });
      }
    },

    arco(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const n = shots(w);
      // Cada flecha mira um inimigo diferente, do mais perto ao mais longe.
      let targets = aimTargets(n, RANGE.arco);
      if (!targets.length) { const t = aimTarget(null, RANGE.arco); targets = t ? [t] : []; }
      if (!targets.length) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('arrow');
      for (let i = 0; i < n; i++) {
        const t = targets[i % targets.length];
        // flechas extras no mesmo alvo saem um pouco abertas
        const a = aimAngle(t) + (i >= targets.length ? rand(-0.25, 0.25) : 0);
        projectiles.push({
          kind: 'arrow', x: player.x, y: player.y - AIM_Y, speed: 560,
          vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
          r: 5, dmg: w.s.dmg, pierce: Math.floor(w.s.pierce + 1e-9), life: 2, hit: new Set(), target: t, turn: 9,
        });
      }
    },

    facas(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      // Mira sozinha no inimigo mais próximo e corrige a rota em voo.
      const target = aimTarget(null, RANGE.facas);
      if (!target) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('knife');
      const n = shots(w);
      const base = aimAngle(target);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.14;
        projectiles.push({
          kind: 'knife', x: player.x, y: player.y - AIM_Y, speed: 620,
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          r: 5, dmg: w.s.dmg, pierce: Math.floor(w.s.pierce + 1e-9), life: 0.8, hit: new Set(), target, turn: 6,
        });
      }
    },

    raio(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const starts = aimTargets(shots(w), RANGE.raio);
      if (!starts.length) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('zap');
      const n = shots(w);
      for (let i = 0; i < n && i < starts.length; i++) {
        chainLightning(starts[i], Math.floor(w.s.bounces + 1e-9), w.s.dmg, 170 * player.areaMul);
      }
      shake = Math.max(shake, 3);
    },

    fogo(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const n = shots(w);
      const targets = aimTargets(n, RANGE.fogo);
      if (!targets.length) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('fire');
      const radius = w.s.area * player.areaMul;
      for (let i = 0; i < n; i++) {
        const t = targets[i % targets.length];
        const a = aimAngle(t);
        projectiles.push({
          kind: 'fireball', x: player.x, y: player.y - AIM_Y,
          vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
          r: 8, dmg: w.s.dmg, pierce: 0, life: 1.6, hit: new Set(),
          tx: t.x, ty: t.y, radius, burn: w.s.burn >= 0.99 ? w.s.burn : 0,
        });
      }
    },

    laminas(w, dt) {
      const n = Math.floor(w.s.count + 1e-9) + Math.floor(player.extraProj + 1e-9);
      const radius = w.s.area * player.areaMul;
      const dmg = w.s.dmg;
      const br = 10 * Math.sqrt(player.areaMul);
      w.angle += w.s.spin * dt;
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

    aura(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      w.timer = Math.max(0.15, w.s.cd * w.s.cdMul);
      areaDamage(player.x, player.y, auraRadius(w), w.s.dmg, 0);
    },

    tremor(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      // só estremece quando algum inimigo está dentro da onda
      if (!nearestEnemy(player.x, player.y, null, w.s.area * player.areaMul)) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('tremor');
      const ring = {
        x: player.x, y: player.y, r: 0,
        maxR: w.s.area * player.areaMul,
        dmg: w.s.dmg, knock: w.s.knock,
        hit: new Set(), delay: 0,
      };
      rings.push(ring);
      // ondas extras saem uma depois da outra
      const waves = Math.floor(w.s.count + 1e-9);
      for (let i = 1; i < waves; i++) rings.push({ ...ring, hit: new Set(), delay: 0.35 * i });
      shake = Math.max(shake, 4);
      for (let i = 0; i < 10; i++) {
        const a = rand(0, TAU);
        fx({ kind: 'rock', x: player.x, y: player.y, vx: Math.cos(a) * rand(120, 260), vy: Math.sin(a) * rand(120, 260), life: rand(0.35, 0.6), color: '#8a7a64', size: rand(2.5, 4.5) });
      }
    },
  };

  // (continuação) armas novas
  Object.assign(WEAPON_UPDATE, {
    caveiras(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const n = shots(w);
      const targets = aimTargets(n, RANGE.caveiras);
      if (!targets.length) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('ice');
      for (let i = 0; i < n; i++) {
        const t = targets[i % targets.length];
        const a = aimAngle(t) + (i - (n - 1) / 2) * 0.35;
        projectiles.push({
          kind: 'skull', x: player.x, y: player.y - AIM_Y, speed: 330,
          vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
          r: 8, dmg: w.s.dmg, pierce: 0, life: 2.2, hit: new Set(), target: t, turn: 5, blast: w.s.area * player.areaMul,
        });
      }
    },

    metralhadora(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const target = aimTarget(null, RANGE.metralhadora);
      if (!target) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('knife');
      const n = shots(w);
      const base = aimAngle(target);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.1 + rand(-0.025, 0.025);
        projectiles.push({
          kind: 'bullet', x: player.x, y: player.y - AIM_Y,
          vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, speed: 760,
          r: 4, dmg: w.s.dmg, pierce: 0, bounces: Math.floor(w.s.bounces + 1e-9), life: 0.9, hit: new Set(),
        });
      }
      fx({ kind: 'dot', add: true, x: player.x + Math.cos(base) * 20, y: player.y - AIM_Y + Math.sin(base) * 20, life: 0.06, color: '#ffe08a', size: 6 });
    },

    espadao(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      if (!nearestEnemy(player.x, player.y, null, w.s.area * player.areaMul + 60)) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('knife');
      const n = shots(w);
      for (let i = 0; i < n; i++) {
        spins.push({ t: 0, dur: 0.36, delay: i * 0.4, a0: rand(0, TAU), r: w.s.area * player.areaMul, dmg: w.s.dmg, knock: w.s.knock, hit: new Set() });
      }
      shake = Math.max(shake, 3);
    },

    bombardeio(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      // fileira de bombas atravessando o alvo
      const t = aimTarget(null, RANGE.bombardeio);
      if (!t) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('whistle');
      const a = Math.atan2(t.y - player.y, t.x - player.x) + Math.PI / 2 + rand(-0.4, 0.4);
      const n = shots(w);
      const radius = w.s.area * player.areaMul;
      const step = radius * 1.1;
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * step;
        const fall = 0.55 + i * 0.09;
        meteors.push({ x: t.x + Math.cos(a) * o, y: t.y + Math.sin(a) * o, r: radius, t: fall, max: fall, dmg: w.s.dmg, bomb: true });
      }
    },

    bumerangue(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const target = aimTarget(null, weaponRange('bumerangue', w));
      if (!target) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      Sound.play('knife');
      const n = shots(w);
      const base = aimAngle(target);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.5;
        projectiles.push({
          kind: 'boomerang', x: player.x, y: player.y - AIM_Y,
          vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
          r: 12, dmg: w.s.dmg, pierce: Infinity, life: 5, hit: new Set(),
          dist: 0, range: w.s.range, back: false,
        });
      }
    },

    meteoro(w, dt) {
      w.timer -= dt;
      if (w.timer > 0) return;
      const n = shots(w);
      const targets = aimTargets(n, RANGE.meteoro);
      if (!targets.length) { w.timer = 0.1; return; }
      w.timer = cooldown(w);
      const radius = w.s.area * player.areaMul;
      for (let i = 0; i < n; i++) {
        const t = targets[i % targets.length];
        const fall = 0.65 + i * 0.12;
        meteors.push({ x: t.x, y: t.y, r: radius, t: fall, max: fall, dmg: w.s.dmg });
      }
    },
  });

  function auraRadius(w) {
    return w.s.area * player.areaMul;
  }

  function updateWeapons(dt) {
    for (const id in weapons) WEAPON_UPDATE[id](weapons[id], dt);
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
    if (burn) hazards.push({ x, y, r: radius * 0.8, life: 2.5, tick: 0, dmg: Math.max(1, Math.round(dmg * 0.15 * burn)) });
    shake = Math.max(shake, 4);
  }

  function steer(p, target, dt) {
    const desired = Math.atan2(target.y - p.y, target.x - p.x);
    const cur = Math.atan2(p.vy, p.vx);
    let diff = desired - cur;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    // perto do alvo vira bem mais rápido, para não ficar dando voltas em volta dele
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    const turn = p.turn * (d < 160 ? 1 + (160 - d) / 25 : 1);
    const a = cur + clamp(diff, -turn * dt, turn * dt);
    p.vx = Math.cos(a) * p.speed;
    p.vy = Math.sin(a) * p.speed;
  }

  function updateProjectiles(dt) {
    for (const p of projectiles) {
      // Flechas e facas perseguem o alvo até acertar o primeiro; depois seguem reto atravessando.
      if ((p.kind === 'arrow' || p.kind === 'knife' || p.kind === 'skull') && p.hit.size === 0) {
        if (!p.target || p.target.dead) p.target = nearestEnemy(p.x, p.y, p.hit, 500);
        if (p.target) steer(p, p.target, dt);
      }

      if (p.kind === 'boomerang') {
        // vai até o alcance e volta para a mão, podendo acertar de novo na volta
        if (!p.back) {
          p.dist += Math.hypot(p.vx, p.vy) * dt;
          if (p.dist >= p.range) { p.back = true; p.hit = new Set(); }
        } else {
          const dx = player.x - p.x;
          const dy = player.y - 12 - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.vx = (dx / d) * 640;
          p.vy = (dy / d) * 640;
          if (d < 24) p.life = 0;
        }
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
          if (p.kind === 'skull') {
            // explode em almas: dano em área pequena
            areaDamage(p.x, p.y, p.blast, p.dmg * 0.6, 80);
            sparks(p.x, p.y, '#9dff6a', 10, 220);
            ringFx(p.x, p.y, p.blast, '#9dff6a');
          }
          // as balas da metralhadora quase não empurram (senão a horda nunca chega perto)
          const kb = p.kind === 'bullet' ? 0.02 : 0.3;
          damageEnemy(e, p.dmg, p.vx * kb, p.vy * kb);
          if (p.kind === 'bullet' && p.bounces > 0) {
            // ricocheteia para o inimigo mais próximo que ainda não levou essa bala
            const next = nearestEnemy(e.x, e.y, p.hit, 260);
            if (next) {
              p.bounces--;
              const a = Math.atan2(next.y - p.y, next.x - p.x);
              p.vx = Math.cos(a) * p.speed;
              p.vy = Math.sin(a) * p.speed;
              p.life = 0.6;
              sparks(p.x, p.y, '#ffe08a', 3, 160);
              break;
            }
          }
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
      if (s.mark) {
        // só o aviso do bombardeiro: some quando ele explode ou morre
        s.t -= dt;
        if (s.owner.dead) s.t = 0;
        continue;
      }
      s.t -= dt;
      if (s.t <= 0.45 && !s.whistled && !['ice', 'poison', 'slam'].includes(s.look)) {
        s.whistled = true;
        Sound.play('whistle');
      }
      if (s.t > 0) continue;
      if (s.look === 'poison') {
        // vira poça de veneno
        Sound.play('hit');
        sparks(s.x, s.y, '#9dff6a', 16, 220);
        epools.push({ x: s.x, y: s.y, r: s.r, life: 3.5, dmg: s.dmg, poison: true });
        continue;
      }
      Sound.play(s.look === 'ice' ? 'ice' : s.look === 'slam' ? 'tremor' : 'explosion');
      if (s.look === 'slam') {
        ringFx(s.x, s.y, s.r, '#c8a878');
        for (let i = 0; i < 8; i++) {
          const a = rand(0, TAU);
          fx({ kind: 'rock', x: s.x, y: s.y, vx: Math.cos(a) * rand(100, 220), vy: Math.sin(a) * rand(100, 220), life: rand(0.3, 0.5), color: '#8a7a64', size: rand(2.5, 4) });
        }
      } else if (s.look === 'ice') {
        sparks(s.x, s.y, '#bff4ff', 18, 300);
        ringFx(s.x, s.y, s.r, '#bff4ff');
      } else {
        explosions.push({ x: s.x, y: s.y, r: s.r, life: 0.4 });
        sparks(s.x, s.y, '#ffb347', 16, 340);
      }
      smoke(s.x, s.y, 6, '#4a4040');
      shake = Math.max(shake, 6);
      const d = Math.hypot(player.x - s.x, player.y - s.y);
      if (d < s.r + player.r * 0.5 && player.invuln <= 0 && state === 'playing') {
        if (s.src) s.src.missileHit = true;
        hurtPlayer(s.dmg);
      }
    }
    strikes = strikes.filter((s) => s.t > 0);
  }

  // Ataques em faixa dos chefões: primeiro a marca no chão, depois o golpe.
  function updateLanes(dt) {
    for (const L of lanes) {
      const ca = Math.cos(L.a);
      const sa = Math.sin(L.a);
      const px = player.x - L.x;
      const py = player.y - L.y;
      const along = px * ca + py * sa;
      const across = Math.abs(-px * sa + py * ca);
      const inside = along > -player.r && along < L.len + player.r && across < L.w / 2 + player.r * 0.5;
      const canHit = player.invuln <= 0 && state === 'playing';
      if (L.t > 0) {
        L.t -= dt;
        if (L.t <= 0) {
          Sound.play(L.kind === 'wave' ? 'tremor' : 'fire');
          shake = Math.max(shake, L.kind === 'wave' ? 8 : 4);
        }
        continue;
      }
      if (L.kind === 'wave') {
        const prev = L.pos;
        L.pos += 950 * dt;
        const fx0 = L.x + ca * L.pos;
        const fy0 = L.y + sa * L.pos;
        for (let i = 0; i < (lowQuality ? 1 : 3); i++) {
          const off = rand(-L.w / 2, L.w / 2);
          fx({ kind: 'rock', x: fx0 - sa * off, y: fy0 + ca * off, vx: ca * rand(40, 160), vy: sa * rand(40, 160) - rand(60, 140), life: rand(0.3, 0.5), color: '#8a7a64', size: rand(2.5, 4.5) });
        }
        if (!L.hit && inside && along >= prev - 40 && along <= L.pos + 10 && canHit) {
          L.hit = true;
          hurtPlayer(L.dmg);
        }
        if (L.pos >= L.len) L.done = true;
      } else {
        L.burn -= dt;
        if (inside && canHit) hurtPlayer(L.dmg);
        if (Math.random() < dt * (lowQuality ? 15 : 45)) {
          const s = rand(0, L.len);
          const off = rand(-L.w / 2, L.w / 2);
          fx({ kind: 'dot', add: true, x: L.x + ca * s - sa * off, y: L.y + sa * s + ca * off, vy: rand(-90, -40), life: rand(0.3, 0.6), color: Math.random() < 0.5 ? '#ff8a2a' : LANE_COLORS[L.tint || 'lich'].spark, size: rand(2, 4), drag: 0.96 });
        }
        if (L.burn <= 0) L.done = true;
      }
    }
    lanes = lanes.filter((L) => !L.done);
  }

  function updateEnemyHazards(dt) {
    const canHit = () => player.invuln <= 0 && state === 'playing';
    for (const b of eshots) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (Math.random() < 0.4 && b.kind !== 'bone') fx({ kind: 'dot', add: true, x: b.x, y: b.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.25, color: b.kind === 'snow' ? '#ffffff' : b.kind === 'curse' ? '#c77dff' : '#9af0ff', size: rand(1.5, 2.5) });
      const rr = b.r + player.r * 0.6;
      if ((b.x - player.x) ** 2 + (b.y - (player.y - 12)) ** 2 < rr * rr && canHit()) {
        hurtPlayer(b.dmg);
        sparks(b.x, b.y, '#ffffff', 8, 160);
        b.life = 0;
      }
    }
    eshots = eshots.filter((b) => b.life > 0);
    for (const p of epools) {
      p.life -= dt;
      if (Math.hypot(player.x - p.x, (player.y - p.y) / 0.6) < p.r + player.r * 0.4 && canHit()) hurtPlayer(p.dmg);
    }
    epools = epools.filter((p) => p.life > 0);
  }

  // Giro do espadão: a lâmina dá uma volta completa e acerta quem estiver no caminho.
  function updateSpins(dt) {
    for (const sp of spins) {
      if (sp.delay > 0) {
        sp.delay -= dt;
        if (sp.delay <= 0) Sound.play('knife');
        continue;
      }
      const prev = sp.t / sp.dur;
      sp.t += dt;
      const cur = Math.min(1, sp.t / sp.dur);
      for (const e of enemies) {
        if (e.dead || sp.hit.has(e)) continue;
        const dx = e.x - player.x;
        const dy = e.y - (player.y - 10);
        const d = Math.hypot(dx, dy) || 1;
        if (d > sp.r + e.r) continue;
        // ângulo do inimigo medido a partir do começo do giro (0 a 1)
        let rel = (Math.atan2(dy, dx) - sp.a0) / TAU;
        rel -= Math.floor(rel);
        if (rel >= prev - 0.02 && rel <= cur + 0.02) {
          sp.hit.add(e);
          damageEnemy(e, sp.dmg, (dx / d) * sp.knock, (dy / d) * sp.knock);
        }
      }
      if (cur >= 1) sp.done = true;
    }
    spins = spins.filter((sp) => !sp.done);
  }

  // Meteoros da arma Chuva de Meteoros: caem um pouco depois de marcados.
  function updateMeteors(dt) {
    for (const m of meteors) {
      m.t -= dt;
      if (m.t <= 0) explode(m.x, m.y, m.r, m.dmg, 0);
    }
    meteors = meteors.filter((m) => m.t > 0);
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
          runCoins += p.v;
          Sound.play('chest');
          sparks(player.x, player.y - 10, '#ffd36b', 24, 260);
          ringFx(player.x, player.y, 60, '#ffd36b');
          addText(player.x, player.y - 50, '+1 moeda dourada', '#ffd36b', true);
        } else if (p.kind === 'magnet') {
          // puxa todo o XP, moedas e corações do mapa de uma vez
          for (const q of pickups) if (q.kind === 'xp' || q.kind === 'coin' || q.kind === 'heart') q.pulled = true;
          Sound.play('chest');
          ringFx(player.x, player.y, 160, '#ff4a5a');
          sparks(player.x, player.y - 10, '#ff4a5a', 20, 260);
          addText(player.x, player.y - 50, 'Ímã!', '#ff6a7a', true);
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
      if (d > 10) {
        // 60% do raio já é velocidade máxima, para não precisar esticar tanto o dedo
        const k = Math.min(1, d / (STICK_R * 0.6));
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
    updateAmbient(dt);

    updateSpawning(dt);
    updateStructures(dt);
    updateSummons(dt);
    updateWeapons(dt);
    updateProjectiles(dt);
    updateRings(dt);
    updateHazards(dt);
    updateEnemies(dt);
    updateStrikes(dt);
    updateLanes(dt);
    updateMeteors(dt);
    updateEnemyHazards(dt);
    updateSpins(dt);
    enemies = enemies.filter((e) => !e.dead);
    if (state !== 'playing') return; // morreu durante este quadro
    updatePickups(dt);
    run.maxThreat = Math.max(run.maxThreat, threat());
    run.checkT -= dt;
    if (run.checkT <= 0) {
      run.checkT = 0.5;
      checkChallenges();
    }

    if (pendingLevels > 0 || pendingChests > 0 || pendingShrines > 0) openChoices();
    updateMusic();
  }

  // Partículas de ambiente de cada mapa: vagalumes, brasas subindo ou neve caindo.
  function updateAmbient(dt) {
    if (lowQuality) return;
    const b = STAGES[run.stage].biome;
    const x = player.x + rand(-W / 2, W / 2);
    const y = player.y + rand(-H / 2, H / 2);
    // Difícil: almas roxas subindo; Pesadelo: cinzas vermelhas caindo
    if (run.diff === 1 && Math.random() < dt * 8) {
      fx({ kind: 'dot', add: true, x, y, vx: rand(-10, 10), vy: rand(-35, -15), life: rand(2, 3.5), color: Math.random() < 0.5 ? '#b07aff' : '#7a4ad0', size: rand(1.5, 3), drag: 1 });
    } else if (run.diff === 2 && Math.random() < dt * 14) {
      fx({ kind: 'dot', add: true, x, y: player.y - H / 2 + rand(-40, H * 0.5), vx: rand(-25, 5), vy: rand(25, 55), life: rand(2, 3.5), color: Math.random() < 0.6 ? '#ff2a2a' : '#5a0a10', size: rand(1.2, 2.6), drag: 1 });
    }
    if (b === 'grass' && Math.random() < dt * 4) {
      fx({ kind: 'dot', add: true, x, y, vx: rand(-14, 14), vy: rand(-14, 14), life: rand(2, 4), color: '#d8ff7a', size: rand(1.2, 2.2), drag: 1 });
    } else if (b === 'lava' && Math.random() < dt * 10) {
      fx({ kind: 'dot', add: true, x, y, vx: rand(-20, 20), vy: rand(-60, -25), life: rand(1.5, 3), color: Math.random() < 0.5 ? '#ff7a1a' : '#ffb347', size: rand(1.2, 2.6), drag: 1 });
    } else if (b === 'snow' && Math.random() < dt * 22) {
      fx({ kind: 'dot', x, y: player.y - H / 2 + rand(-40, H * 0.6), vx: rand(-30, -5), vy: rand(30, 60), life: rand(2.5, 4.5), color: '#ffffff', size: rand(1.4, 3), drag: 1 });
    }
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
    if (e.type === 'werewolf' && e.windup > 0) {
      // aviso do bote: faixa vermelha na direção do jogador
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(a);
      ctx.fillStyle = `rgba(255,50,50,${0.12 + (1 - e.windup / 0.65) * 0.22})`;
      ctx.fillRect(0, -e.r * 0.8, 300, e.r * 1.6);
      ctx.restore();
    }
    if (e.elite) {
      // mini-chefe: brilho dourado no chão
      const pulse = 0.5 + Math.sin(time * 5 + e.phase) * 0.5;
      Art.glow(ctx, e.x, e.y, e.r * 2.6, '#ffc040', 0.25 + pulse * 0.2);
      ctx.save();
      ctx.translate(e.x, e.y + e.r * 0.85);
      ctx.scale(1, 0.4);
      ctx.strokeStyle = `rgba(255,210,90,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 1.25, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    Art.drawEnemy(ctx, e, player.x >= e.x ? 1 : -1);
    if (e.elite) {
      // coroa acima da cabeça
      const cy = e.y - e.r * 1.9 + Math.sin(time * 3 + e.phase) * 2;
      const cw = 9;
      Art.poly(ctx, [e.x - cw, cy + 5, e.x - cw, cy - 3, e.x - cw / 2, cy + 1, e.x, cy - 6, e.x + cw / 2, cy + 1, e.x + cw, cy - 3, e.x + cw, cy + 5], Art.lin(ctx, 0, cy - 6, 0, cy + 5, '#fff3b0', '#e0a020'), 1.5);
    }
    if (e.boss || e.elite || e.type === 'skelknight') {
      const bw = e.r * 2;
      const y = e.y + e.r + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(e.x - bw / 2 - 1.5, y - 1.5, bw + 3, 8);
      ctx.fillStyle = e.boss ? '#ff4f8b' : e.elite ? '#ffc040' : '#ff9b4f';
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
    if (s.used || d > 280) return;
    const grand = s.kind === 'grandaltar';
    const portalS = s.kind === 'portal';
    const next = DIFFS[Math.min(2, run.diff + 1)];
    const label = s.kind === 'totem' ? 'Fogueira' : grand ? 'Altar Maior' : portalS ? `Portal: ${next.name}` : 'Altar de Invocação';
    const sub = s.kind === 'totem' ? 'Fique perto para escolher uma bênção'
      : grand ? 'Fique no centro para invocar o chefão final agora'
        : portalS ? 'Entre para ir à próxima dificuldade (mantém armas e bônus)' : 'Invoca um chefão';
    const color = s.kind === 'totem' ? BONFIRE_COLOR : grand ? '#c77dff' : portalS ? next.color : '#ff3355';
    const y = s.y - (s.kind === 'totem' ? 100 : grand ? 200 : portalS ? 150 : 64);
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
    } else if (s.kind === 'portal') {
      ctx.globalAlpha = 1;
      return;
    } else if (s.kind === 'grandaltar') {
      Art.grandAltarGround(ctx, s.x, s.y, s.r, time, s.used, s.charge / s.need);
    } else {
      Art.altar(ctx, s.x, s.y, s.r, time, s.used);
    }
    if (!s.used && s.charge > 0) {
      const k = s.charge / s.need;
      Art.glow(ctx, s.x, s.y, s.r * 1.5, s.kind === 'totem' ? BONFIRE_COLOR : s.kind === 'grandaltar' ? '#c77dff' : '#ff3355', k * 0.6);
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
      const color = s.kind === 'totem' ? BONFIRE_COLOR : s.kind === 'grandaltar' ? '#c77dff' : s.kind === 'portal' ? DIFFS[Math.min(2, run.diff + 1)].color : '#ff3355';
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
    } else if (p.kind === 'skull') {
      Art.glow(ctx, p.x, p.y, 22, '#9dff6a', 0.6);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(Math.cos(a) < 0 ? -1 : 1, 1);
      Art.ball(ctx, 0, 0, 7, '#e8f0d8', 1.4, false);
      ctx.fillStyle = '#1a2a1a';
      ctx.fillRect(0.5, -2.5, 2.5, 2.5);
      ctx.fillRect(4, -2.5, 2.5, 2.5);
      ctx.restore();
      if (Math.random() < 0.6) fx({ kind: 'dot', add: true, x: p.x, y: p.y, vx: -p.vx * 0.1, vy: -p.vy * 0.1, life: 0.3, color: '#9dff6a', size: rand(2, 3.5) });
    } else if (p.kind === 'bullet') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.strokeStyle = 'rgba(255,220,120,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      Art.poly(ctx, [6, 0, 1, -2.5, -5, -2.5, -5, 2.5, 1, 2.5], '#ffd36b', 1.1);
      ctx.restore();
    } else if (p.kind === 'boomerang') {
      Art.glow(ctx, p.x, p.y, 26, '#b07aff', 0.45);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(time * 18);
      ctx.beginPath();
      ctx.moveTo(-13, 5);
      ctx.quadraticCurveTo(0, -16, 13, 5);
      ctx.lineTo(8, 7);
      ctx.quadraticCurveTo(0, -6, -8, 7);
      ctx.closePath();
      ctx.fillStyle = Art.lin(ctx, -13, 0, 13, 0, '#c89aff', '#5a2a9a');
      ctx.fill();
      Art.outline(ctx, 1.6);
      ctx.restore();
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

  // Cores das faixas de fogo: tele = aviso, burn = chão queimando, outer/inner = chamas.
  const LANE_COLORS = {
    lich: { tele: '80,255,200', burn: '40,220,170', edge: '150,255,220', outer: '#22c8a0', inner: '#d8fff0', spark: '#7fffd0' },
    lava: { tele: '255,140,40', burn: '255,90,20', edge: '255,200,120', outer: '#ff5a1a', inner: '#ffe08a', spark: '#ffb347' },
    poison: { tele: '120,230,80', burn: '80,200,50', edge: '200,255,160', outer: '#5ad02a', inner: '#e8ffc0', spark: '#9dff6a' },
    ice: { tele: '130,210,255', burn: '90,170,240', edge: '220,245,255', outer: '#5ab8ff', inner: '#f0fbff', spark: '#d8f6ff' },
  };

  function drawLaneGround(L) {
    const fire = L.kind === 'fire';
    const LC = LANE_COLORS[L.tint || 'lich'];
    const wc = L.col || '255,60,60';
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate(L.a);
    const hw = L.w / 2;
    if (L.t > 0) {
      // aviso: a faixa vai enchendo até o golpe
      const k = 1 - L.t / L.max;
      const pulse = 0.5 + Math.sin(time * 18) * 0.5;
      ctx.fillStyle = fire ? `rgba(${LC.tele},${0.07 + k * 0.12})` : `rgba(${wc},${0.08 + k * 0.12})`;
      ctx.fillRect(0, -hw, L.len, L.w);
      ctx.fillStyle = fire ? `rgba(${LC.tele},${0.16 + k * 0.14})` : `rgba(${wc},${0.18 + k * 0.16})`;
      ctx.fillRect(0, -hw, L.len * k, L.w);
      ctx.strokeStyle = fire ? `rgba(${LC.edge},${0.5 + pulse * 0.4})` : `rgba(${wc},${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(0, -hw, L.len, L.w);
      ctx.setLineDash([]);
      if (!fire) {
        // setas mostrando a direção da onda
        ctx.strokeStyle = `rgba(${wc},${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 4;
        for (let x = 40; x < L.len; x += 70) {
          ctx.beginPath();
          ctx.moveTo(x, -hw * 0.45);
          ctx.lineTo(x + 16, 0);
          ctx.lineTo(x, hw * 0.45);
          ctx.stroke();
        }
      }
    } else if (!fire) {
      // rastro de terra rachada e a frente da onda
      const k = clamp(1 - L.pos / L.len, 0, 1);
      ctx.fillStyle = `rgba(70,50,35,${0.35 * k + 0.1})`;
      ctx.fillRect(0, -hw * 0.7, Math.min(L.pos, L.len), hw * 1.4);
      ctx.fillStyle = L.col ? `rgba(${L.col},0.85)` : 'rgba(230,200,150,0.85)';
      ctx.fillRect(Math.min(L.pos, L.len) - 14, -hw, 14, L.w);
      ctx.restore();
      Art.glow(ctx, L.x + Math.cos(L.a) * L.pos, L.y + Math.sin(L.a) * L.pos, L.w, L.col === '200,120,255' ? '#c77dff' : '#ffcf8a', 0.5);
      return;
    } else {
      const k = clamp(L.burn / 1.5, 0, 1);
      ctx.fillStyle = `rgba(${LC.burn},${0.25 * k})`;
      ctx.fillRect(0, -hw, L.len, L.w);
      ctx.strokeStyle = `rgba(${LC.edge},${0.6 * k})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, -hw, L.len, L.w);
    }
    ctx.restore();
  }

  function drawLaneFire(L) {
    const LC = LANE_COLORS[L.tint || 'lich'];
    const ca = Math.cos(L.a);
    const sa = Math.sin(L.a);
    const k = clamp(L.burn / 0.3, 0, 1);
    const step = lowQuality ? 70 : 42;
    for (let s = 20, i = 0; s < L.len; s += step, i++) {
      const off = (i % 2 ? 1 : -1) * L.w * 0.18;
      const x = L.x + ca * s - sa * off;
      const y = L.y + sa * s + ca * off;
      const h = (26 + Math.sin(time * 9 + i) * 8) * k;
      Art.flame(ctx, x, y, 11, h, Math.sin(time * 6 + i) * 3, LC.outer, LC.inner);
    }
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
    for (const s of structures) if (onScreen(s.x, s.y, 220)) drawStructureGround(s);

    // invocações: círculo crescendo no chão
    for (const m of summons) {
      const k = 1 - m.t / m.max;
      const c = m.final ? '199,125,255' : '255,51,85';
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(1, 0.6);
      ctx.fillStyle = `rgba(${c},${0.12 + k * 0.25})`;
      ctx.beginPath();
      ctx.arc(0, 0, 80 * k, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(${c},${0.6 + Math.sin(time * 16) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -time * 40;
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (weapons.aura) {
      const r = auraRadius(weapons.aura);
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
      const sc = s.look === 'ice' ? '120,200,255' : s.look === 'poison' ? '120,230,80' : s.look === 'slam' ? '230,180,110' : s.mark ? '255,140,40' : '255,40,50';
      if (s.mark) { s.x = s.owner.x; s.y = s.owner.y; }
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(1, 0.7);
      ctx.fillStyle = `rgba(${sc},${0.12 + k * 0.25})`;
      ctx.beginPath();
      ctx.arc(0, 0, s.r * k, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(${sc},${0.6 + pulse * 0.4})`;
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

    // chão em chamas dos slimes
    for (const p of epools) {
      const k = clamp(p.life / 0.6, 0, 1);
      Art.glow(ctx, p.x, p.y, p.r * 1.8, p.poison ? '#7aff4a' : '#ff5a1a', 0.55 * k);
      ctx.fillStyle = p.poison ? `rgba(110,210,60,${0.35 * k})` : `rgba(255,120,30,${0.3 * k})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.6, 0, 0, TAU);
      ctx.fill();
    }

    // faixas marcadas pelos chefões (onda do Ogro e fogo do Lich)
    for (const L of lanes) drawLaneGround(L);

    // alvos dos meteoros
    for (const m of meteors) {
      const k = 1 - m.t / m.max;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(1, 0.7);
      ctx.fillStyle = `rgba(255,150,40,${0.08 + k * 0.2})`;
      ctx.beginPath();
      ctx.arc(0, 0, m.r * k, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,60,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of pickups) {
      if (p.kind === 'chest' || !onScreen(p.x, p.y, 30)) continue;
      if (p.kind === 'xp') Art.drawGem(ctx, p, time);
      else if (p.kind === 'coin') Art.drawCoin(ctx, p, time);
      else if (p.kind === 'magnet') Art.drawMagnetPickup(ctx, p, time);
      else Art.drawHeart(ctx, p, time);
    }

    // ---------- Camada de objetos, ordenada de cima para baixo ----------
    const list = [];
    for (const e of enemies) if (onScreen(e.x, e.y, 80)) list.push({ y: e.y, e });
    for (const s of structures) {
      if ((s.kind === 'totem' && onScreen(s.x, s.y, 120)) || ((s.kind === 'grandaltar' || s.kind === 'portal') && onScreen(s.x, s.y, 260))) list.push({ y: s.y, s });
    }
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
      else if (o.s && o.s.kind === 'grandaltar') Art.grandAltarTop(ctx, o.s.x, o.s.y, o.s.r, time, o.s.used);
      else if (o.s && o.s.kind === 'portal') Art.portal(ctx, o.s.x, o.s.y, o.s.r, time, DIFFS[Math.min(2, run.diff + 1)].color, o.s.charge / o.s.need);
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
      if (s.t > 0.45 || s.mark) continue;
      const k = s.t / 0.45;
      const my = s.y - k * 520;
      if (s.look === 'rock') {
        const mx = s.x + k * 200;
        Art.flame(ctx, mx + 8, my - 12, 11, 40, 0, '#ff7a1a', '#ffe08a');
        Art.glow(ctx, mx, my, 32, '#ff6a1a', 0.7);
        Art.ball(ctx, mx, my, 12, '#6a4a3a', 1.8, false);
        continue;
      }
      if (s.look === 'slam') continue;
      if (s.look === 'poison') continue;
      if (s.look === 'ice') {
        Art.glow(ctx, s.x, my - 14, 24, '#9af0ff', 0.7);
        Art.poly(ctx, [s.x - 7, my - 34, s.x + 7, my - 34, s.x, my + 6], Art.lin(ctx, s.x - 7, 0, s.x + 7, 0, '#ffffff', '#5aa8e0'), 1.5);
        continue;
      }
      Art.glow(ctx, s.x, my - 14, 26, '#ff8a2a', 0.8);
      Art.poly(ctx, [s.x - 5, my - 30, s.x + 5, my - 30, s.x + 5, my - 6, s.x, my + 4, s.x - 5, my - 6], Art.lin(ctx, s.x - 5, 0, s.x + 5, 0, '#e2e6ea', '#7c8590'), 1.5);
      Art.poly(ctx, [s.x - 5, my - 10, s.x + 5, my - 10, s.x, my + 4], '#ff4a3a', 1.2);
      Art.flame(ctx, s.x, my - 30, 5, 24, 0, '#ff7a1a', '#ffe08a');
    }

    // bolhas de veneno das múmias voando em arco
    for (const s of strikes) {
      if (s.look !== 'poison') continue;
      const k = 1 - s.t / s.max;
      const bx = s.fromX + (s.x - s.fromX) * k;
      const by = s.fromY + (s.y - s.fromY) * k - Math.sin(k * Math.PI) * 120;
      Art.glow(ctx, bx, by, 20, '#9dff6a', 0.7);
      Art.ball(ctx, bx, by, 7, '#7ad040', 1.5);
    }

    // meteoros caindo na diagonal
    for (const m of meteors) {
      const k = m.t / m.max;
      const mx = m.x + k * 260;
      const my = m.y - k * 520;
      if (m.bomb) {
        // bomba caindo reto
        const by = m.y - k * 480;
        Art.oval(ctx, m.x, by - 8, 5.5, 11, '#4a5260', 1.6);
        Art.poly(ctx, [m.x - 5.5, by - 17, m.x + 5.5, by - 17, m.x + 3, by - 24, m.x - 3, by - 24], '#c02a2a', 1.3);
        continue;
      }
      Art.flame(ctx, mx + 10, my - 14, 10, 34 + k * 20, 0, '#ff7a1a', '#ffe08a');
      Art.glow(ctx, mx, my, 30, '#ff7a1a', 0.7);
      Art.ball(ctx, mx, my, 10, '#7a4a32', 1.6, false);
    }

    // coluna de luz das invocações
    for (const m of summons) {
      const k = 1 - m.t / m.max;
      const col = m.final ? '#c77dff' : '#ff3355';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const w = 20 + k * 40;
      const gr = ctx.createLinearGradient(m.x - w, 0, m.x + w, 0);
      gr.addColorStop(0, Art.rgba(col, 0));
      gr.addColorStop(0.5, Art.rgba(col, 0.25 + k * 0.4));
      gr.addColorStop(1, Art.rgba(col, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(m.x - w, m.y - 600, w * 2, 600);
      ctx.restore();
      Art.glow(ctx, m.x, m.y, 60 + k * 60, col, 0.4 + k * 0.4);
    }

    // chamas das poças dos slimes
    for (const p of epools) {
      const k = clamp(p.life / 0.6, 0, 1);
      if (p.poison) {
        // bolhas subindo da poça
        for (let i = 0; i < 4; i++) {
          const ph = (time * 0.8 + i * 0.27) % 1;
          Art.ball(ctx, p.x + Math.cos(i * 2.1) * p.r * 0.5, p.y + Math.sin(i * 2.1) * p.r * 0.25 - ph * 14, 3 + ph * 2, '#a8ff70', 1, false);
        }
        continue;
      }
      for (let i = 0; i < 3; i++) Art.flame(ctx, p.x + (i - 1) * p.r * 0.55, p.y + (i === 1 ? -3 : 3), 7, (16 + Math.sin(time * 10 + i * 2) * 5) * k, 0, '#ff5a1a', '#ffe08a');
    }

    // projéteis dos inimigos
    for (const b of eshots) {
      if (b.kind === 'snow') {
        Art.glow(ctx, b.x, b.y, 18, '#ffffff', 0.4);
        Art.ball(ctx, b.x, b.y, b.r, '#f4f8fc', 1.6);
      } else if (b.kind === 'curse') {
        Art.glow(ctx, b.x, b.y, 22, '#c77dff', 0.7);
        Art.ball(ctx, b.x, b.y, b.r, '#7a3ad0', 1.5);
        Art.glow(ctx, b.x, b.y, 8, '#ffffff', 0.6);
      } else if (b.kind === 'bone') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(time * 14);
        Art.poly(ctx, [-9, -2, 9, -2, 9, 2, -9, 2], '#efe8d2', 1.3);
        for (const x of [-9, 9]) for (const y of [-3, 3]) Art.ball(ctx, x, y, 3, '#efe8d2', 1.1, false);
        ctx.restore();
      } else {
        Art.glow(ctx, b.x, b.y, 16, '#9af0ff', 0.7);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        Art.poly(ctx, [12, 0, -4, -5, -8, 0, -4, 5], Art.lin(ctx, -8, 0, 12, 0, '#5aa8e0', '#ffffff'), 1.3);
        ctx.restore();
      }
    }

    // giro do espadão
    for (const sp of spins) {
      if (sp.delay > 0) continue;
      const k = sp.t / sp.dur;
      const a = sp.a0 + k * TAU;
      ctx.save();
      ctx.translate(player.x, player.y - 10);
      ctx.strokeStyle = `rgba(255,200,160,${0.35 * (1 - k * 0.5)})`;
      ctx.lineWidth = sp.r * 0.35;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, sp.r * 0.7, a - 1.6, a);
      ctx.stroke();
      ctx.rotate(a);
      Art.poly(ctx, [10, -5, sp.r, -4, sp.r + 14, 0, sp.r, 4, 10, 5], Art.lin(ctx, 0, -5, 0, 5, '#ffffff', '#8a94a0'), 2);
      Art.poly(ctx, [6, -11, 11, -11, 11, 11, 6, 11], '#6a4a2a', 1.5);
      Art.poly(ctx, [-8, -3, 6, -3, 6, 3, -8, 3], '#3a2418', 1.3);
      ctx.restore();
    }

    // labaredas do Lich
    for (const L of lanes) if (L.kind === 'fire' && L.t <= 0) drawLaneFire(L);

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
      // a bolinha para na borda da base
      const dx = stick.x - stick.ox;
      const dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      const k = d > STICK_R ? STICK_R / d : 1;
      ctx.globalAlpha = 0.85;
      Art.ball(ctx, stick.ox + dx * k, stick.oy + dy * k, 34, '#ffd36b', 3);
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
    const left = STAGE_TIME - (time - run.stageStart);
    const sb = run.cleared
      ? `☠ Ameaça ${threat()} · inimigos +${Math.round((threatHp() - 1) * 100)}% vida · sobe em ${fmtTime(30 - ((time - run.clearTime) % 30))}`
      : run.finalSpawned ? 'Derrote o chefão final!' : `Chefão final em ${fmtTime(Math.max(0, left))} · ou invoque no Altar Maior`;
    if ($('stagebar').textContent !== sb) $('stagebar').textContent = sb;
    $('stagebar').classList.toggle('alert', run.finalSpawned || left < 30);
    // medidor de Ameaça: enche até subir de nível
    $('threatbar').classList.toggle('hidden', !run.cleared);
    if (run.cleared) $('threatfill').style.width = (((time - run.clearTime) % 30) / 30 * 100) + '%';
    $('kills').textContent = kills;
    $('runcoins').textContent = Math.round(runCoins);

    const key = JSON.stringify([weapons, passiveLevels, boonsTaken].map((o) => Object.entries(o).map(([k, v]) => k + (v.level || v))));
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
      // bênçãos das fogueiras no canto da tela
      $('boonlist').innerHTML = Object.entries(boonsTaken).map(([id, v]) =>
        `<div class="boon" title="${BOONS[id].name}"><img src="${Art.icon(BOONS[id].icon)}" alt=""><span>${boonShort(id, v)}</span></div>`).join('');
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
    get lanes() { return lanes; },
    get run() { return run; },
    get time() { return time; },
    get lowQuality() { return lowQuality; },
    get zoom() { return zoom; },
    gainXp, startGame, addWeapon, spawnBoss, spawnEnemy, spawnElite, selectChar, persist, rollRarity,
    completeChallenge, checkChallenges, buildChoices, selectStage,
    get eshots() { return eshots; },
    get strikes() { return strikes; },
    setTime(v) { time = v; },
    get summons() { return summons; },
    get pickups() { return pickups; },
  };
})();
