'use strict';

// ============================================================
// Sons e música, todos gerados na hora com a Web Audio (sem arquivos).
// ============================================================
const Sound = (() => {
  let ac = null;
  let master;
  let sfxBus;
  let musicBus;
  let distBus; // guitarra distorcida do rock pesado
  let noiseBuf;
  let vol = { music: 0.6, sfx: 0.8 };
  let ducked = false;
  const lastPlay = {};

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(ac.destination);
    master = ac.createGain();
    master.connect(comp);
    sfxBus = ac.createGain();
    musicBus = ac.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    // distorção: ganho alto -> saturação -> corta os agudos ásperos
    distBus = ac.createGain();
    distBus.gain.value = 3;
    const shaper = ac.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 6);
    }
    shaper.curve = curve;
    const tone2 = ac.createBiquadFilter();
    tone2.type = 'lowpass';
    tone2.frequency.value = 3200;
    const out = ac.createGain();
    out.gain.value = 0.16;
    distBus.connect(shaper);
    shaper.connect(tone2);
    tone2.connect(out);
    out.connect(musicBus);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    return true;
  }

  // O navegador só libera o som depois de um toque ou tecla do jogador.
  function unlock() {
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    startScheduler();
  }

  function applyVolumes() {
    if (!ac) return;
    const t = ac.currentTime;
    sfxBus.gain.setTargetAtTime(vol.sfx * 0.9, t, 0.05);
    musicBus.gain.setTargetAtTime(vol.music * (ducked ? 0.35 : 1) * 0.55, t, 0.15);
  }

  function setVolumes(music, sfx) {
    vol = { music, sfx };
    applyVolumes();
  }

  function duck(on) {
    if (on === ducked) return;
    ducked = on;
    applyVolumes();
  }

  // ---------- Peças básicas ----------
  function tone(o) {
    const t = ac.currentTime + (o.delay || 0) + (o.at || 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const atk = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.lp) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.dest || sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  function noise(o) {
    const t = ac.currentTime + (o.delay || 0) + (o.at || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true; // ruídos longos (vento, gongo) passam de 1 segundo
    const f = ac.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q || 1;
    const g = ac.createGain();
    const atk = o.attack || 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.05);
  }

  const notes = (list, type, vol, step, dur, at) => list.forEach((f, i) => tone({ type, f0: f, dur, vol, delay: i * step, at }));

  // ---------- Efeitos ----------
  // gap = intervalo mínimo entre repetições (evita barulho demais com muitos inimigos)
  const SFX = {
    click: { gap: 0.03, play: () => tone({ type: 'triangle', f0: 900, f1: 600, dur: 0.06, vol: 0.12 }) },
    hit: { gap: 0.035, play: () => { noise({ filter: 'bandpass', f0: 2200, f1: 800, dur: 0.06, vol: 0.12, q: 2 }); tone({ type: 'square', f0: 300, f1: 160, dur: 0.05, vol: 0.03 }); } },
    crit: { gap: 0.06, play: () => { tone({ type: 'square', f0: 1400, f1: 700, dur: 0.08, vol: 0.06 }); noise({ filter: 'highpass', f0: 3000, dur: 0.08, vol: 0.1 }); } },
    kill: { gap: 0.03, play: () => { tone({ type: 'triangle', f0: 380 + Math.random() * 80, f1: 110, dur: 0.14, vol: 0.13 }); noise({ f0: 1200, f1: 300, dur: 0.12, vol: 0.06 }); } },
    ice: { gap: 0.06, play: () => { tone({ type: 'sine', f0: 1800, f1: 900, dur: 0.1, vol: 0.06 }); tone({ type: 'triangle', f0: 2600, f1: 1800, dur: 0.07, vol: 0.03 }); } },
    knife: { gap: 0.06, play: () => noise({ filter: 'bandpass', f0: 4000, f1: 1800, dur: 0.08, vol: 0.08, q: 3 }) },
    arrow: { gap: 0.08, play: () => { noise({ filter: 'bandpass', f0: 1500, f1: 3500, dur: 0.12, vol: 0.08, q: 4 }); tone({ type: 'triangle', f0: 180, f1: 90, dur: 0.06, vol: 0.06 }); } },
    zap: { gap: 0.1, play: () => { for (let i = 0; i < 4; i++) tone({ type: 'sawtooth', f0: 600 + Math.random() * 1600, f1: 200, dur: 0.06, vol: 0.05, delay: i * 0.03, lp: 4000 }); noise({ filter: 'highpass', f0: 2500, dur: 0.18, vol: 0.08 }); } },
    fire: { gap: 0.1, play: () => noise({ f0: 500, f1: 2400, dur: 0.18, vol: 0.08, attack: 0.04 }) },
    explosion: { gap: 0.06, play: () => { noise({ f0: 1400, f1: 80, dur: 0.55, vol: 0.32 }); tone({ type: 'sine', f0: 110, f1: 35, dur: 0.45, vol: 0.3 }); } },
    tremor: { gap: 0.2, play: () => { tone({ type: 'sine', f0: 70, f1: 30, dur: 0.6, vol: 0.4 }); noise({ f0: 400, f1: 60, dur: 0.5, vol: 0.2 }); } },
    gem: { gap: 0.035, play: () => tone({ type: 'sine', f0: 1300 + Math.random() * 400, f1: 1900, dur: 0.07, vol: 0.05 }) },
    coin: { gap: 0.05, play: () => { tone({ type: 'square', f0: 988, dur: 0.07, vol: 0.05, lp: 3000 }); tone({ type: 'square', f0: 1319, dur: 0.14, vol: 0.05, delay: 0.06, lp: 3000 }); } },
    heal: { gap: 0.1, play: () => notes([523, 659, 784, 1047], 'sine', 0.08, 0.06, 0.18) },
    levelup: { gap: 0.2, play: () => { notes([523, 659, 784, 1047], 'triangle', 0.12, 0.08, 0.25); notes([1047, 1319, 1568], 'sine', 0.05, 0.08, 0.3, 0.32); } },
    select: { gap: 0.05, play: () => { tone({ type: 'triangle', f0: 660, dur: 0.08, vol: 0.1 }); tone({ type: 'triangle', f0: 990, dur: 0.14, vol: 0.1, delay: 0.07 }); } },
    chest: { gap: 0.2, play: () => { notes([784, 988, 1175, 1568, 1976], 'square', 0.04, 0.05, 0.2); noise({ filter: 'highpass', f0: 5000, dur: 0.5, vol: 0.05, attack: 0.1 }); } },
    hurt: { gap: 0.15, play: () => { tone({ type: 'sawtooth', f0: 240, f1: 90, dur: 0.22, vol: 0.14, lp: 1800 }); noise({ f0: 900, f1: 200, dur: 0.15, vol: 0.12 }); } },
    death: { gap: 1, play: () => { notes([392, 330, 262, 196], 'triangle', 0.14, 0.18, 0.4); tone({ type: 'sine', f0: 120, f1: 40, dur: 1.2, vol: 0.25, delay: 0.5 }); } },
    boss: { gap: 1, play: () => { tone({ type: 'sawtooth', f0: 90, f1: 45, dur: 1.4, vol: 0.25, lp: 500, attack: 0.1 }); tone({ type: 'sawtooth', f0: 92, f1: 46, dur: 1.4, vol: 0.2, lp: 500, attack: 0.1 }); noise({ f0: 300, f1: 80, dur: 1.2, vol: 0.15, attack: 0.2 }); } },
    bossdeath: { gap: 1, play: () => { noise({ f0: 2000, f1: 60, dur: 1.2, vol: 0.4 }); tone({ type: 'sine', f0: 140, f1: 30, dur: 1.1, vol: 0.4 }); notes([523, 659, 784, 1047, 1319], 'triangle', 0.1, 0.1, 0.3, 0.6); } },
    warn: { gap: 0.3, play: () => { for (let i = 0; i < 3; i++) tone({ type: 'square', f0: 880, dur: 0.07, vol: 0.06, delay: i * 0.13, lp: 2500 }); } },
    whistle: { gap: 0.06, play: () => tone({ type: 'sine', f0: 2200, f1: 500, dur: 0.45, vol: 0.05 }) },
    growl: { gap: 0.5, play: () => { tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 0.45, vol: 0.12, lp: 700, attack: 0.05 }); noise({ f0: 500, f1: 200, dur: 0.4, vol: 0.06, attack: 0.05 }); } },
    bonfire: { gap: 0.5, play: () => { noise({ f0: 300, f1: 3000, dur: 0.6, vol: 0.15, attack: 0.15 }); notes([392, 494, 587, 784], 'sine', 0.08, 0.09, 0.5, 0.25); } },
    altar: { gap: 0.5, play: () => { tone({ type: 'sawtooth', f0: 55, dur: 1.5, vol: 0.18, lp: 400, attack: 0.3 }); tone({ type: 'sawtooth', f0: 82, dur: 1.5, vol: 0.12, lp: 400, attack: 0.3 }); tone({ type: 'sawtooth', f0: 77.8, dur: 1.5, vol: 0.12, lp: 400, attack: 0.3 }); } },
    swarm: { gap: 1, play: () => { tone({ type: 'sawtooth', f0: 147, dur: 0.6, vol: 0.12, lp: 900, attack: 0.08 }); tone({ type: 'sawtooth', f0: 220, dur: 0.9, vol: 0.12, lp: 900, attack: 0.08, delay: 0.35 }); } },
    buy: { gap: 0.2, play: () => notes([784, 1047, 1319, 1568], 'square', 0.05, 0.06, 0.18) },
    denied: { gap: 0.2, play: () => tone({ type: 'square', f0: 180, f1: 120, dur: 0.2, vol: 0.08, lp: 1200 }) },
  };

  function play(name) {
    if (!ac || vol.sfx <= 0 || ac.state !== 'running') return;
    const s = SFX[name];
    if (!s) return;
    const now = ac.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < s.gap) return;
    lastPlay[name] = now;
    s.play();
  }

  // ============================================================
  // Música gerada em tempo real (lá menor, 4 acordes em loop)
  // ============================================================
  const PROG = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]]; // Am, F, C, G
  const MODES = {
    menu: { bpm: 78, drums: false, bass: 'soft', arp: 'slow' },
    game: { bpm: 112, drums: true, bass: 'drive', arp: 'eighth' },
    boss: { bpm: 132, drums: true, bass: 'boss', arp: 'sixteenth' },
    // Difícil: lento e sombrio, órgão, sino de igreja e batida de coração
    dark: { bpm: 92, style: 'dark' },
    darkboss: { bpm: 116, style: 'dark', boss: true },
    // Pesadelo: rock pesado com guitarra distorcida e bumbo duplo
    metal: { bpm: 168, style: 'metal' },
    metalboss: { bpm: 188, style: 'metal', boss: true },
    // Vulcão: tambores tribais e escala frígia (normal), gongos e drones (difícil), metal oriental (pesadelo)
    lava: { bpm: 118, style: 'lava', level: 0 },
    lavaboss: { bpm: 138, style: 'lava', level: 0, boss: true },
    lavadark: { bpm: 90, style: 'lava', level: 1 },
    lavadarkboss: { bpm: 112, style: 'lava', level: 1, boss: true },
    lavametal: { bpm: 176, style: 'lava', level: 2 },
    lavametalboss: { bpm: 196, style: 'lava', level: 2, boss: true },
    // Neve: caixinha de música e sininhos (normal), vento e coro gelado (difícil), black metal (pesadelo)
    snow: { bpm: 100, style: 'snow', level: 0 },
    snowboss: { bpm: 124, style: 'snow', level: 0, boss: true },
    snowdark: { bpm: 70, style: 'snow', level: 1 },
    snowdarkboss: { bpm: 92, style: 'snow', level: 1, boss: true },
    snowmetal: { bpm: 200, style: 'snow', level: 2 },
    snowmetalboss: { bpm: 216, style: 'snow', level: 2, boss: true },
  };
  const MODES2 = {
    // Pântano: banjo, sapos e bolhas (normal), drones e sinos afogados (difícil), doom arrastado (pesadelo)
    swamp: { bpm: 104, style: 'swamp', level: 0 },
    swampboss: { bpm: 124, style: 'swamp', level: 0, boss: true },
    swampdark: { bpm: 76, style: 'swamp', level: 1 },
    swampdarkboss: { bpm: 96, style: 'swamp', level: 1, boss: true },
    swampmetal: { bpm: 84, style: 'swamp', level: 2 },
    swampmetalboss: { bpm: 100, style: 'swamp', level: 2, boss: true },
    // Deserto: alaúde e darbuka em escala hijaz (normal), vento e drones (difícil), metal árabe (pesadelo)
    desert: { bpm: 112, style: 'desert', level: 0 },
    desertboss: { bpm: 132, style: 'desert', level: 0, boss: true },
    desertdark: { bpm: 84, style: 'desert', level: 1 },
    desertdarkboss: { bpm: 104, style: 'desert', level: 1, boss: true },
    desertmetal: { bpm: 180, style: 'desert', level: 2 },
    desertmetalboss: { bpm: 198, style: 'desert', level: 2, boss: true },
  };
  Object.assign(MODES, MODES2);
  // Lá hijaz (A Bb C# D E F G)
  const DESERT_SCALE = [0, 1, 4, 5, 7, 8, 10, 12];
  const DESERT_ROOTS = [0, 1, 0, -2];
  // Mi menor pentatônica para o pântano
  const SWAMP_SCALE = [-5, -2, 0, 2, 5, 7, 10, 12];
  const SWAMP_ROOTS = [-5, -5, 0, -2];

  // Mi frígio dominante (E F G# A B C D), em semitons a partir do lá 220
  const LAVA_SCALE = [-5, -4, -1, 0, 2, 3, 5, 7];
  const LAVA_ROOTS = [-5, -4, -5, -2];
  // Ré dórico (D E F G A B C)
  const SNOW_PROG = [[-7, -4, 0], [-9, -5, -2], [-2, 2, 5], [-4, 0, 3]]; // Dm, C, G, Am
  // Lá menor frígio: Am, Bb, Dm, E (soa mais de morte)
  const DARK_PROG = [[0, 3, 7], [1, 5, 8], [-7, -4, 0], [-5, -1, 2]];
  // Riffs em quintas: E, F, E, Bb (trítono)
  const METAL_ROOTS = [-5, -4, -5, 1];
  let mode = null;
  let step = 0;
  let nextTime = 0;
  let timer = null;
  const hz = (semi) => 220 * Math.pow(2, semi / 12);

  function music(m) {
    if (m === mode) return;
    mode = m;
    if (ac) startScheduler();
  }

  function startScheduler() {
    if (timer || !ac) return;
    nextTime = ac.currentTime + 0.1;
    timer = setInterval(tick, 25);
  }

  function tick() {
    if (!ac || ac.state !== 'running') return;
    if (!mode || mode === 'off' || vol.music <= 0) {
      nextTime = ac.currentTime + 0.05;
      return;
    }
    const M = MODES[mode];
    const stepDur = 60 / M.bpm / 4;
    if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.02;
    while (nextTime < ac.currentTime + 0.15) {
      scheduleStep(M, step, nextTime, stepDur);
      nextTime += stepDur;
      step = (step + 1) % 64;
    }
  }

  function scheduleStep(M, s, t, sd) {
    if (M.style === 'dark') return scheduleDark(M, s, t, sd);
    if (M.style === 'metal') return scheduleMetal(M, s, t, sd);
    if (M.style === 'lava') return scheduleLava(M, s, t, sd);
    if (M.style === 'snow') return scheduleSnow(M, s, t, sd);
    if (M.style === 'swamp') return scheduleSwamp(M, s, t, sd);
    if (M.style === 'desert') return scheduleDesert(M, s, t, sd);
    const at = t - ac.currentTime;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const chord = PROG[bar];
    const dest = musicBus;
    // acorde de fundo no começo de cada compasso
    if (i === 0) {
      for (const n of chord) tone({ type: 'sine', f0: hz(n), dur: sd * 16, vol: 0.022, attack: 0.4, at, dest });
      tone({ type: 'triangle', f0: hz(chord[0] - 12), dur: sd * 16, vol: 0.02, attack: 0.5, at, dest, lp: 600 });
    }
    // baixo
    if (M.bass === 'soft' && (i === 0 || i === 8)) {
      tone({ type: 'triangle', f0: hz(chord[0] - 24), dur: sd * 7, vol: 0.09, attack: 0.02, at, dest, lp: 500 });
    } else if (M.bass === 'drive' && [0, 3, 6, 8, 11, 14].includes(i)) {
      tone({ type: 'sawtooth', f0: hz(chord[0] - 24), dur: sd * 2.5, vol: 0.07, at, dest, lp: 420 });
    } else if (M.bass === 'boss' && i % 2 === 0) {
      tone({ type: 'sawtooth', f0: hz(chord[0] - 24 + (i % 8 === 6 ? 7 : 0)), dur: sd * 1.8, vol: 0.08, at, dest, lp: 650 });
    }
    // arpejo
    const arpEvery = M.arp === 'slow' ? 4 : M.arp === 'eighth' ? 2 : 1;
    if (i % arpEvery === 0) {
      const k = Math.floor(i / arpEvery);
      const n = chord[k % 3] + (k % 6 >= 3 ? 12 : 0) + 12;
      tone({ type: M.arp === 'slow' ? 'sine' : 'square', f0: hz(n), dur: sd * arpEvery * 0.9, vol: M.arp === 'slow' ? 0.035 : 0.022, at, dest, lp: 1800 });
    }
    // bateria
    if (M.drums) {
      const kick = mode === 'boss' ? i % 4 === 0 : (i === 0 || i === 8 || i === 10);
      if (kick) tone({ type: 'sine', f0: 140, f1: 40, dur: 0.18, vol: 0.32, at, dest });
      if (i === 4 || i === 12) noise({ filter: 'bandpass', f0: 1800, dur: 0.12, vol: 0.12, q: 0.8, at, dest });
      if (i % 2 === 0) noise({ filter: 'highpass', f0: 7000, dur: 0.035, vol: i % 4 === 2 ? 0.05 : 0.03, at, dest });
    }
  }

  function scheduleDark(M, s, t, sd) {
    const at = t - ac.currentTime;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const chord = DARK_PROG[bar];
    const dest = musicBus;
    if (i === 0) {
      // órgão grave e coro desafinado
      for (const n of chord) {
        tone({ type: 'sawtooth', f0: hz(n - 12), dur: sd * 16, vol: 0.016, attack: 0.6, at, dest, lp: 900 });
        tone({ type: 'sawtooth', f0: hz(n - 12), detune: 12, dur: sd * 16, vol: 0.012, attack: 0.8, at, dest, lp: 700 });
      }
      tone({ type: 'sine', f0: hz(chord[0] - 36), dur: sd * 16, vol: 0.09, attack: 0.3, at, dest });
      // sino de igreja a cada dois compassos
      if (bar % 2 === 0) {
        tone({ type: 'sine', f0: hz(chord[0] + 24), dur: 2.6, vol: 0.05, at, dest });
        tone({ type: 'sine', f0: hz(chord[0] + 24) * 2.76, dur: 1.4, vol: 0.02, at, dest });
      }
    }
    // melodia lenta e triste
    if (i % 4 === 0) {
      const k = (bar * 4 + i / 4) % 8;
      const n = chord[[0, 1, 2, 1, 0, 2, 1, 0][k]] + 12;
      tone({ type: 'triangle', f0: hz(n), dur: sd * 3.8, vol: 0.03, attack: 0.05, at, dest, lp: 1400 });
    }
    // batida de coração
    if (i === 0 || i === 3 || (M.boss && (i === 8 || i === 11))) {
      tone({ type: 'sine', f0: 90, f1: 40, dur: 0.25, vol: i % 8 === 0 ? 0.3 : 0.2, at, dest });
    }
    if (M.boss && i % 2 === 0) tone({ type: 'sawtooth', f0: hz(chord[0] - 24), dur: sd * 1.6, vol: 0.06, at, dest, lp: 500 });
    if (M.boss && (i === 4 || i === 12)) noise({ filter: 'bandpass', f0: 600, dur: 0.25, vol: 0.12, q: 1.2, at, dest });
  }

  function scheduleMetal(M, s, t, sd) {
    const at = t - ac.currentTime;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const root = METAL_ROOTS[bar];
    const dest = musicBus;
    // guitarra: quintas abafadas em galope, acorde aberto no começo do compasso
    const gallop = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15];
    if (i === 0 || i === 8) {
      for (const n of [root - 12, root - 5, root]) tone({ type: 'sawtooth', f0: hz(n), dur: sd * 3.5, vol: 0.08, at, dest: distBus });
    } else if (gallop.includes(i)) {
      for (const n of [root - 12, root - 5]) tone({ type: 'sawtooth', f0: hz(n), dur: sd * 0.7, vol: 0.07, at, dest: distBus, lp: 1400 });
    }
    // baixo acompanhando
    if (i % 2 === 0) tone({ type: 'square', f0: hz(root - 24), dur: sd * 1.5, vol: 0.06, at, dest, lp: 400 });
    // bumbo duplo
    if (M.boss || i % 2 === 0) tone({ type: 'sine', f0: 150, f1: 45, dur: 0.12, vol: 0.3, at, dest });
    // caixa
    if (i === 4 || i === 12 || (M.boss && i % 4 === 2)) noise({ filter: 'bandpass', f0: 1900, dur: 0.14, vol: 0.16, q: 0.7, at, dest });
    // prato de ataque no começo de cada compasso e chimbal
    if (i === 0) noise({ filter: 'highpass', f0: 5000, dur: 0.9, vol: 0.08, at, dest });
    else if (i % 2 === 0) noise({ filter: 'highpass', f0: 8000, dur: 0.04, vol: 0.04, at, dest });
    // grito agudo da guitarra solo no fim do riff
    if (bar === 3 && (i === 8 || i === 12)) tone({ type: 'sawtooth', f0: hz(root + 19), f1: hz(root + 12), dur: sd * 4, vol: 0.05, at, dest: distBus });
  }

  function scheduleLava(M, s, t, sd) {
    const at = t - ac.currentTime;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const root = LAVA_ROOTS[bar];
    const dest = musicBus;
    const tom = (f, v) => tone({ type: 'sine', f0: f, f1: f * 0.45, dur: 0.3, vol: v, at, dest });
    if (M.level === 0) {
      // drone de lava, tambores tribais e melodia de encantador de serpentes
      if (i === 0) {
        tone({ type: 'sawtooth', f0: hz(root - 24), dur: sd * 16, vol: 0.05, attack: 0.3, at, dest, lp: 260 });
        tone({ type: 'sawtooth', f0: hz(root - 17), dur: sd * 16, vol: 0.025, attack: 0.4, at, dest, lp: 400 });
      }
      if ([0, 3, 6, 10, 12].includes(i) || (M.boss && i % 2 === 0)) tom(i % 8 === 0 ? 110 : 160, i % 8 === 0 ? 0.3 : 0.16);
      if (i === 4 || i === 12) noise({ filter: 'bandpass', f0: 2500, dur: 0.06, vol: 0.06, q: 2, at, dest });
      if (i % 2 === 0) {
        const k = (bar * 8 + i / 2) % 16;
        const pat = [0, 1, 2, 1, 3, 2, 1, 0, 4, 5, 4, 3, 2, 1, 2, 0];
        if (k % 5 !== 4) tone({ type: 'square', f0: hz(LAVA_SCALE[pat[k]] + 12), dur: sd * 1.8, vol: 0.022, at, dest, lp: 1600 });
      }
    } else if (M.level === 1) {
      // gongo, drones graves e estrondos distantes
      if (i === 0) {
        tone({ type: 'sine', f0: hz(root - 36), dur: sd * 16, vol: 0.1, attack: 0.5, at, dest });
        tone({ type: 'sawtooth', f0: hz(root - 23), dur: sd * 16, vol: 0.02, attack: 1, at, dest, lp: 300 });
        if (bar % 2 === 0) {
          tone({ type: 'sine', f0: 98, dur: 3.5, vol: 0.12, at, dest });
          tone({ type: 'sine', f0: 98 * 2.7, dur: 2.2, vol: 0.03, at, dest });
          noise({ filter: 'bandpass', f0: 400, dur: 2.5, vol: 0.05, q: 0.6, at, dest });
        }
      }
      if (i === 8 && bar % 2 === 1) noise({ filter: 'lowpass', f0: 180, dur: 1.2, vol: 0.25, at, dest });
      if (i % 4 === 2) {
        const n = LAVA_SCALE[(bar * 3 + i) % 8];
        tone({ type: 'triangle', f0: hz(n), dur: sd * 3.5, vol: 0.03, attack: 0.08, at, dest, lp: 900 });
      }
      if (M.boss && i % 4 === 0) tom(90, 0.28);
    } else {
      // metal com escala oriental: palhetada em semicolcheia alternando tônica e meio tom
      const n = i % 4 === 3 ? root + 1 : root;
      tone({ type: 'sawtooth', f0: hz(n - 12), dur: sd * 0.8, vol: 0.07, at, dest: distBus, lp: 1600 });
      if (i === 0 || i === 8) for (const k of [root - 12, root - 5, root]) tone({ type: 'sawtooth', f0: hz(k), dur: sd * 3, vol: 0.06, at, dest: distBus });
      tone({ type: 'square', f0: hz(root - 24), dur: sd * 0.9, vol: 0.05, at, dest, lp: 380 });
      tone({ type: 'sine', f0: 150, f1: 45, dur: 0.1, vol: M.boss || i % 2 === 0 ? 0.28 : 0.18, at, dest });
      if (i === 4 || i === 12) noise({ filter: 'bandpass', f0: 1900, dur: 0.14, vol: 0.16, q: 0.7, at, dest });
      if (bar === 3 && i >= 12) tom(220 - (i - 12) * 30, 0.2);
      if (i === 0) noise({ filter: 'highpass', f0: 5000, dur: 0.9, vol: 0.08, at, dest });
      if (bar === 1 && i % 4 === 0) tone({ type: 'sawtooth', f0: hz(LAVA_SCALE[(i / 4 + 4) % 8] + 12), dur: sd * 3.5, vol: 0.045, at, dest: distBus });
    }
  }

  function scheduleSnow(M, s, t, sd) {
    const at = t - ac.currentTime;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const chord = SNOW_PROG[bar];
    const dest = musicBus;
    if (M.level === 0) {
      // caixinha de música, sininhos de trenó e um coro suave
      if (i === 0) for (const n of chord) tone({ type: 'sine', f0: hz(n + 12), dur: sd * 16, vol: 0.016, attack: 0.6, at, dest });
      if (i === 0 || i === 8) tone({ type: 'triangle', f0: hz(chord[0] - 12), dur: sd * 7, vol: 0.06, at, dest, lp: 600 });
      if (i % 2 === 0) {
        const k = i / 2;
        const n = chord[k % 3] + (k >= 4 ? 24 : 12) + 12;
        tone({ type: 'sine', f0: hz(n), dur: 0.9, vol: 0.03, at, dest });
        tone({ type: 'sine', f0: hz(n) * 3, dur: 0.3, vol: 0.006, at, dest });
      }
      if (i % 2 === 1 || M.boss) noise({ filter: 'highpass', f0: 9000, dur: 0.05, vol: 0.025, at, dest });
      if (i === 0 || i === 8 || (M.boss && i % 4 === 0)) tone({ type: 'sine', f0: 120, f1: 50, dur: 0.15, vol: 0.18, at, dest });
    } else if (M.level === 1) {
      // vento uivando, coro gelado e notas soltas e dissonantes
      if (i === 0) {
        noise({ filter: 'bandpass', f0: 500, f1: 1400, dur: sd * 16, vol: 0.05, q: 4, attack: 1, at, dest });
        for (const n of chord) tone({ type: 'sawtooth', f0: hz(n), detune: -10, dur: sd * 16, vol: 0.012, attack: 1.2, at, dest, lp: 800 });
        tone({ type: 'sine', f0: hz(chord[0] - 24), dur: sd * 16, vol: 0.07, attack: 0.8, at, dest });
      }
      if (i === 6 || i === 13) {
        const n = chord[(bar + i) % 3] + 24 + (i === 13 ? 1 : 0);
        tone({ type: 'sine', f0: hz(n), dur: 1.8, vol: 0.03, at, dest });
      }
      if (i === 0 || i === 3 || (M.boss && (i === 8 || i === 11))) tone({ type: 'sine', f0: 80, f1: 38, dur: 0.3, vol: 0.25, at, dest });
    } else {
      // black metal: palhetada de trêmolo na melodia e bumbo em blast beat
      const mel = chord[[0, 1, 2, 1][Math.floor(i / 4)]];
      tone({ type: 'sawtooth', f0: hz(mel), dur: sd * 0.95, vol: 0.05, at, dest: distBus, lp: 2400 });
      tone({ type: 'sawtooth', f0: hz(mel - 12), dur: sd * 0.95, vol: 0.04, at, dest: distBus, lp: 1400 });
      if (i === 0) for (const n of chord) tone({ type: 'sawtooth', f0: hz(n - 12), dur: sd * 16, vol: 0.012, attack: 0.5, at, dest, lp: 900 });
      tone({ type: 'sine', f0: 140, f1: 45, dur: 0.08, vol: 0.22, at, dest });
      if (i % 2 === 1) noise({ filter: 'bandpass', f0: 2000, dur: 0.08, vol: 0.1, q: 0.7, at, dest });
      if (i === 0) noise({ filter: 'highpass', f0: 4500, dur: 1.2, vol: 0.09, at, dest });
      if (M.boss || i % 2 === 0) noise({ filter: 'highpass', f0: 8000, dur: 0.03, vol: 0.03, at, dest });
    }
  }

  function scheduleSwamp(M, s, t, sd) {
    const at = t - ac.currentTime;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const root = SWAMP_ROOTS[bar];
    const dest = musicBus;
    if (M.level === 0) {
      // banjo dedilhado, baixo de tuba, sapos coaxando e bolhas
      if (i % 2 === 0) {
        const k = (bar * 8 + i / 2) % 8;
        const n = SWAMP_SCALE[[0, 2, 4, 2, 5, 4, 2, 1][k]] + 12;
        tone({ type: 'triangle', f0: hz(n), dur: 0.22, vol: 0.05, at, dest, lp: 2600 });
        tone({ type: 'square', f0: hz(n), dur: 0.08, vol: 0.012, at, dest, lp: 3000 });
      }
      if (i === 0 || i === 8) tone({ type: 'triangle', f0: hz(root - 24), dur: sd * 3, vol: 0.09, at, dest, lp: 400 });
      if (i === 4 || i === 12) tone({ type: 'triangle', f0: hz(root - 17), dur: sd * 2, vol: 0.06, at, dest, lp: 400 });
      if (i === 6 && bar % 2 === 0) tone({ type: 'square', f0: 110, f1: 70, dur: 0.18, vol: 0.05, at, dest, lp: 500 });
      if (i === 14 && bar % 2 === 1) tone({ type: 'sine', f0: 300, f1: 900, dur: 0.08, vol: 0.03, at, dest });
      if (i === 4 || i === 12 || (M.boss && i % 4 === 0)) noise({ filter: 'bandpass', f0: 1500, dur: 0.08, vol: 0.06, q: 1, at, dest });
      if (i === 0 || (M.boss && i === 8)) tone({ type: 'sine', f0: 110, f1: 45, dur: 0.18, vol: 0.22, at, dest });
    } else if (M.level === 1) {
      // drones de lodo e sinos afogados
      if (i === 0) {
        tone({ type: 'sawtooth', f0: hz(root - 24), dur: sd * 16, vol: 0.035, attack: 1, at, dest, lp: 300 });
        tone({ type: 'sawtooth', f0: hz(root - 23), dur: sd * 16, vol: 0.02, attack: 1, at, dest, lp: 300 });
        noise({ filter: 'lowpass', f0: 300, dur: sd * 16, vol: 0.04, attack: 1, at, dest });
      }
      if (i === 0 || i === 10) {
        const n = SWAMP_SCALE[(bar * 2 + i) % 8] + 12;
        tone({ type: 'sine', f0: hz(n), dur: 2.4, vol: 0.035, at, dest, lp: 900 });
        tone({ type: 'sine', f0: hz(n) * 2.4, dur: 1.2, vol: 0.008, at, dest });
      }
      if (i === 0 || i === 3 || (M.boss && (i === 8 || i === 11))) tone({ type: 'sine', f0: 70, f1: 35, dur: 0.35, vol: 0.25, at, dest });
    } else {
      // doom: guitarra arrastada e muito grave, bateria lenta e pesada
      if (i % 4 === 0) {
        const n = i === 12 ? root + 1 : root;
        for (const k of [n - 24, n - 17, n - 12]) tone({ type: 'sawtooth', f0: hz(k), dur: sd * 3.8, vol: 0.07, at, dest: distBus, lp: 1200 });
      }
      tone({ type: 'square', f0: hz(root - 24), dur: sd * 0.9, vol: 0.04, at, dest, lp: 250 });
      if (i === 0 || i === 6 || i === 10 || (M.boss && i % 2 === 0)) tone({ type: 'sine', f0: 120, f1: 35, dur: 0.25, vol: 0.32, at, dest });
      if (i === 8) noise({ filter: 'bandpass', f0: 1600, dur: 0.3, vol: 0.18, q: 0.7, at, dest });
      if (i === 0) noise({ filter: 'highpass', f0: 4000, dur: 1.6, vol: 0.08, at, dest });
    }
  }

  function scheduleDesert(M, s, t, sd) {
    const at = t - ac.currentTime;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const root = DESERT_ROOTS[bar];
    const dest = musicBus;
    // darbuka: dum (grave) e tek (agudo)
    const dum = () => tone({ type: 'sine', f0: 130, f1: 60, dur: 0.22, vol: 0.26, at, dest });
    const tek = () => noise({ filter: 'bandpass', f0: 3200, dur: 0.05, vol: 0.08, q: 2, at, dest });
    if (M.level === 0) {
      if (i === 0 || i === 6 || (M.boss && i === 10)) dum();
      if ([3, 4, 8, 11, 12, 14].includes(i)) tek();
      if (i === 0) tone({ type: 'sawtooth', f0: hz(root - 24), dur: sd * 16, vol: 0.035, attack: 0.4, at, dest, lp: 350 });
      if (i % 2 === 0) {
        const k = (bar * 8 + i / 2) % 16;
        const pat = [0, 1, 2, 3, 4, 3, 2, 1, 4, 5, 6, 5, 4, 3, 1, 0];
        if (k % 4 !== 3) {
          // alaúde: ataque rápido e som curto
          tone({ type: 'sawtooth', f0: hz(DESERT_SCALE[pat[k]] + root + 12), dur: 0.25, vol: 0.03, at, dest, lp: 2200 });
          tone({ type: 'triangle', f0: hz(DESERT_SCALE[pat[k]] + root + 24), dur: 0.12, vol: 0.012, at, dest });
        }
      }
    } else if (M.level === 1) {
      if (i === 0) {
        noise({ filter: 'bandpass', f0: 350, f1: 900, dur: sd * 16, vol: 0.05, q: 3, attack: 1.2, at, dest });
        tone({ type: 'sine', f0: hz(root - 36), dur: sd * 16, vol: 0.1, attack: 0.6, at, dest });
        tone({ type: 'sawtooth', f0: hz(root - 17), dur: sd * 16, vol: 0.015, attack: 1, at, dest, lp: 500 });
      }
      if (i === 4 || i === 12) {
        const n = DESERT_SCALE[(bar * 3 + i) % 8] + root;
        tone({ type: 'triangle', f0: hz(n), dur: sd * 6, vol: 0.03, attack: 0.15, at, dest, lp: 1100 });
      }
      if (i === 0 || (M.boss && i % 4 === 0)) dum();
      if (M.boss && i % 4 === 2) tek();
    } else {
      // metal árabe: riff na escala hijaz, bumbo duplo e darbuka por cima
      const k = [0, 0, 1, 0, 2, 0, 1, 0][Math.floor(i / 2)];
      const n = DESERT_SCALE[k] + root;
      tone({ type: 'sawtooth', f0: hz(n - 12), dur: sd * 0.8, vol: 0.07, at, dest: distBus, lp: 1700 });
      if (i === 0 || i === 8) for (const q of [root - 12, root - 5]) tone({ type: 'sawtooth', f0: hz(q), dur: sd * 3, vol: 0.06, at, dest: distBus });
      tone({ type: 'sine', f0: 150, f1: 45, dur: 0.1, vol: M.boss || i % 2 === 0 ? 0.28 : 0.16, at, dest });
      if (i === 4 || i === 12) noise({ filter: 'bandpass', f0: 1900, dur: 0.14, vol: 0.16, q: 0.7, at, dest });
      if (i % 4 === 3) tek();
      if (i === 0) noise({ filter: 'highpass', f0: 5000, dur: 0.9, vol: 0.08, at, dest });
      if (bar === 2 && i % 4 === 0) tone({ type: 'sawtooth', f0: hz(DESERT_SCALE[(i / 4 + 3) % 8] + root + 12), dur: sd * 3.5, vol: 0.045, at, dest: distBus });
    }
  }

  // Pausa o áudio quando o jogo sai da tela (troca de aba ou de app).
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else ac.resume();
  });

  return { unlock, play, music, setVolumes, duck };
})();
