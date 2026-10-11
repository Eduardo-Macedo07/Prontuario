'use strict';

// ============================================================
// Sons e música, todos gerados na hora com a Web Audio (sem arquivos).
// ============================================================
const Sound = (() => {
  let ac = null;
  let master;
  let sfxBus;
  let musicBus;
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
  };
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

  // Pausa o áudio quando o jogo sai da tela (troca de aba ou de app).
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else ac.resume();
  });

  return { unlock, play, music, setVolumes, duck };
})();
