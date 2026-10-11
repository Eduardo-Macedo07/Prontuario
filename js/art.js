'use strict';

// ============================================================
// Arte do jogo: personagens, inimigos, cenário, itens e ícones.
// Tudo é desenhado com formas no canvas, com contorno escuro,
// sombreado e brilho para dar um visual cartoon com volume.
// ============================================================
const Art = (() => {
  const TAU = Math.PI * 2;
  const OUT = '#1a1222';
  const SCALE = 2; // resolução extra dos sprites guardados em cache

  // ---------- Cores ----------
  const rgbCache = new Map();
  function hexToRgb(h) {
    let c = rgbCache.get(h);
    if (c) return c;
    let s = h.replace('#', '');
    if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
    const n = parseInt(s, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(h, c);
    return c;
  }

  function mix(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
  }
  const light = (c, t) => mix(c, '#ffffff', t);
  const dark = (c, t) => mix(c, '#000000', t);

  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ---------- Formas básicas ----------
  function outline(g, lw) {
    g.lineWidth = lw === undefined ? 2 : lw;
    g.strokeStyle = OUT;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }

  function radial(g, x, y, r, color) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.05, x, y, r * 1.05);
    gr.addColorStop(0, light(color, 0.4));
    gr.addColorStop(0.55, color);
    gr.addColorStop(1, dark(color, 0.4));
    return gr;
  }

  function lin(g, x0, y0, x1, y1, c0, c1) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    return gr;
  }

  function shineAt(g, x, y, rx, ry) {
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.ellipse(x, y, rx, ry, -0.5, 0, TAU);
    g.fill();
  }

  // Esfera sombreada com contorno e reflexo.
  function ball(g, x, y, r, color, lw, shine = true) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fillStyle = radial(g, x, y, r, color);
    g.fill();
    if (lw !== 0) outline(g, lw);
    if (shine) shineAt(g, x - r * 0.38, y - r * 0.42, r * 0.3, r * 0.18);
  }

  function oval(g, x, y, rx, ry, color, lw, shine = true) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fillStyle = radial(g, x, y, Math.max(rx, ry), color);
    g.fill();
    if (lw !== 0) outline(g, lw);
    if (shine) shineAt(g, x - rx * 0.38, y - ry * 0.42, rx * 0.3, ry * 0.18);
  }

  function path(g, pts) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  }

  function poly(g, pts, fill, lw) {
    path(g, pts);
    g.fillStyle = fill;
    g.fill();
    if (lw !== 0) outline(g, lw);
  }

  function shadow(g, x, y, rx, ry) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
  }

  // ---------- Luz (brilho aditivo) ----------
  const glowCache = new Map();
  function glowSprite(color) {
    let c = glowCache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(color, 1));
      gr.addColorStop(0.25, rgba(color, 0.5));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      glowCache.set(color, c);
    }
    return c;
  }

  // Em modo de qualidade reduzida, brilhos pequenos são pulados.
  let low = false;
  function setLowQuality(v) { low = v; }

  function glow(g, x, y, r, color, alpha) {
    if (r <= 0 || (low && r < 18)) return;
    const op = g.globalCompositeOperation;
    const a = g.globalAlpha;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a * (alpha === undefined ? 1 : alpha);
    g.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = op;
    g.globalAlpha = a;
  }

  // Chama em forma de gota, desenhada com luz aditiva.
  function flame(g, x, y, w, h, sway, outer, inner) {
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    for (const [k, color, a] of [[1, outer, 0.75], [0.55, inner, 0.6]]) {
      const ww = w * k;
      const hh = h * k;
      g.beginPath();
      g.moveTo(x - ww, y);
      g.quadraticCurveTo(x - ww * 1.1, y - hh * 0.55, x + sway * k, y - hh);
      g.quadraticCurveTo(x + ww * 1.1, y - hh * 0.55, x + ww, y);
      g.quadraticCurveTo(x, y + ww * 0.6, x - ww, y);
      g.fillStyle = lin(g, x, y, x, y - hh, rgba(color, a), rgba(color, 0));
      g.fill();
    }
    g.globalCompositeOperation = op;
  }

  // ---------- Cache de sprites ----------
  const sprites = new Map();
  function sprite(key, size, draw) {
    let s = sprites.get(key);
    if (!s) {
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(size * SCALE);
      const g = c.getContext('2d');
      g.scale(SCALE, SCALE);
      g.translate(size / 2, size / 2);
      draw(g);
      s = { c, size };
      sprites.set(key, s);
    }
    return s;
  }

  // Versão branca do sprite, usada quando o inimigo leva dano.
  function whiteVersion(key, base) {
    const k = key + ':w';
    let s = sprites.get(k);
    if (!s) {
      const c = document.createElement('canvas');
      c.width = base.c.width;
      c.height = base.c.height;
      const g = c.getContext('2d');
      g.drawImage(base.c, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(0, 0, c.width, c.height);
      s = { c, size: base.size };
      sprites.set(k, s);
    }
    return s;
  }

  function blit(g, s, x, y, sx, sy, rot) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale(sx || 1, sy || 1);
    g.drawImage(s.c, -s.size / 2, -s.size / 2, s.size, s.size);
    g.restore();
  }

  function eye(g, x, y, r, pupil) {
    ball(g, x, y, r, '#ffffff', 1.2, false);
    g.fillStyle = pupil || '#111';
    g.beginPath();
    g.arc(x + r * 0.35, y + r * 0.1, r * 0.55, 0, TAU);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x + r * 0.15, y - r * 0.25, r * 0.2, 0, TAU);
    g.fill();
  }

  // ============================================================
  // Personagens (desenhados olhando para a direita; o chão é y = 0)
  // ============================================================
  function feet(g, t, moving, color) {
    const step = moving ? Math.sin(t * 10) * 3.5 : 0;
    oval(g, -4 + step, -1.5, 3.6, 2.4, color, 1.6, false);
    oval(g, 5 - step, -1.5, 3.6, 2.4, color, 1.6, false);
  }

  // ---------- Rei Gelado (o mago) ----------
  function frostSword(g, t) {
    g.save();
    g.translate(13, -11);
    g.rotate(0.55 + Math.sin(t * 3) * 0.05);
    glow(g, 0, -20, 18, '#59d8ff', 0.5);
    poly(g, [-2.4, -3, 2.4, -3, 1.8, -27, 0, -33, -1.8, -27], lin(g, -2, 0, 2, 0, '#eaf8ff', '#6fa7d6'), 1.5);
    g.strokeStyle = '#3fd0ff';
    g.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      const y = -8 - i * 5;
      g.beginPath();
      g.moveTo(-0.8, y);
      g.lineTo(0.8, y - 2);
      g.stroke();
    }
    poly(g, [-7, -4, -2, -1.5, 2, -1.5, 7, -4, 5, 0.5, -5, 0.5], '#2f3b55', 1.4);
    poly(g, [-1.2, 0.5, 1.2, 0.5, 1.2, 6, -1.2, 6], '#3b2a20', 1.2);
    ball(g, 0, 7.5, 1.9, '#5fe8ff', 1.1, false);
    g.restore();
  }

  function pauldron(g, x, y, side) {
    poly(g, [x + side * 1, y - 3, x + side * 6, y - 12, x + side * 5.5, y - 1], lin(g, x, y, x + side * 6, y - 12, '#7f93b8', '#e0efff'), 1.4);
    ball(g, x, y, 5.8, '#8296bb', 1.8);
    poly(g, [x + side * 3, y + 1, x + side * 11, y - 3, x + side * 5, y + 4], lin(g, x, y, x + side * 11, y, '#a7bcda', '#eef7ff'), 1.4);
  }

  function heroMago(g, t, o) {
    const wave = Math.sin(t * 6) * 1.5;
    // capa
    poly(g, [-9, -27, 7, -27, 11, -3, 5, 1 + wave, -3, -2, -12, 1 - wave, -14, -6], lin(g, 0, -27, 0, 2, '#3a54a0', '#0d1430'));
    feet(g, t, o.moving, '#2a3348');
    // armadura
    oval(g, 0, -13, 10, 10.5, '#6f86ab');
    g.strokeStyle = '#8cecff';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(1, -16); g.lineTo(1, -9);
    g.moveTo(-1.5, -14.5); g.lineTo(3.5, -11);
    g.stroke();
    glow(g, 1, -12.5, 8, '#59d8ff', 0.6);
    // pelagem no colarinho
    oval(g, 0, -20.5, 10.5, 4, '#e6eef8', 1.6, false);
    frostSword(g, t);
    pauldron(g, -10, -19, -1);
    pauldron(g, 10, -19, 1);
    // coroa de espinhos (atrás do elmo)
    const spikes = [[-6, -33, -11, -42], [-3, -36, -4.5, -47], [1, -37, 1, -51], [5, -36, 6.5, -47], [8, -33, 13, -42]];
    for (const [bx, by, tx, ty] of spikes) {
      poly(g, [bx - 2.3, by + 1.5, tx, ty, bx + 2.3, by + 1.5], lin(g, bx, by, tx, ty, '#7f93b5', '#e4f3ff'), 1.5);
    }
    // elmo
    ball(g, 1, -29, 8.5, '#56688a');
    g.fillStyle = '#05070d';
    g.beginPath();
    g.ellipse(4, -27.5, 4.6, 4, 0, 0, TAU);
    g.fill();
    glow(g, 4.4, -28.5, 10, '#5fe8ff', 0.9);
    g.fillStyle = '#e6ffff';
    g.beginPath();
    g.arc(2.6, -28.4, 1.1, 0, TAU);
    g.arc(6.2, -28.4, 1.1, 0, TAU);
    g.fill();
    ball(g, 1, -35, 2, '#5fe8ff', 1.2);
  }

  // ---------- Maníaco (bobo da corte psicopata) ----------
  function horn(g, bx, by, tx, ty, color) {
    const mx = (bx + tx) / 2;
    const my = (by + ty) / 2 - 6;
    g.beginPath();
    g.moveTo(bx - 3.2, by);
    g.quadraticCurveTo(mx - 2, my - 3, tx, ty);
    g.quadraticCurveTo(mx + 3, my + 3, bx + 3.2, by);
    g.closePath();
    g.fillStyle = lin(g, bx, by, tx, ty, light(color, 0.2), dark(color, 0.3));
    g.fill();
    outline(g, 1.6);
    ball(g, tx, ty, 2.4, '#f2c443', 1.3);
  }

  function bomb(g, x, y, t) {
    ball(g, x, y, 5.2, '#3a3a48', 1.8);
    g.fillStyle = '#c9a23a';
    g.fillRect(x - 1.6, y - 6.4, 3.2, 2);
    g.strokeStyle = '#6b5a3a';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(x, y - 6);
    g.quadraticCurveTo(x + 2, y - 9, x + 4, y - 9.5);
    g.stroke();
    const f = 0.7 + Math.sin(t * 40) * 0.3;
    glow(g, x + 4, y - 9.5, 6 + 5 * f, '#ffb020', 1);
    g.fillStyle = '#fff6c0';
    g.beginPath();
    g.arc(x + 4, y - 9.5, 1.3, 0, TAU);
    g.fill();
    ball(g, x - 4, y + 2.5, 2.6, '#f1e3cf', 1.2, false);
  }

  function heroManiaco(g, t, o) {
    feet(g, t, o.moving, '#2b1a2e');
    // faca na mão de trás
    poly(g, [-12, -11, -19, -21, -16, -21.5, -10.5, -13], lin(g, -12, -11, -19, -21, '#9aa4b0', '#f2f6fa'), 1.3);
    ball(g, -11, -11, 2.6, '#f1e3cf', 1.2, false);
    // corpo arlequim
    g.save();
    g.beginPath();
    g.ellipse(0, -13, 9.5, 10, 0, 0, TAU);
    g.clip();
    g.fillStyle = '#c8283c';
    g.fillRect(-12, -25, 24, 24);
    g.fillStyle = '#24121c';
    for (let i = -2; i <= 2; i++) {
      for (let j = 0; j < 5; j++) {
        if (((i + j) & 1) === 0) continue;
        const cx = i * 5;
        const cy = -25 + j * 6;
        path(g, [cx, cy - 3, cx + 2.5, cy, cx, cy + 3, cx - 2.5, cy]);
        g.fill();
      }
    }
    const sh = g.createRadialGradient(-3, -17, 1, 0, -13, 12);
    sh.addColorStop(0, 'rgba(255,255,255,0.3)');
    sh.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = sh;
    g.fillRect(-12, -25, 24, 24);
    g.restore();
    g.beginPath();
    g.ellipse(0, -13, 9.5, 10, 0, 0, TAU);
    outline(g, 2);
    // cinto com granadas
    oval(g, 0, -6.5, 9, 2.6, '#4a2f1f', 1.4, false);
    ball(g, -6, -6, 2.4, '#6a8a32', 1.2);
    ball(g, -2, -5.2, 2.4, '#6a8a32', 1.2);
    // gola de babados
    const ruff = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rr = i % 2 ? 6.5 : 10.5;
      ruff.push(Math.cos(a) * rr, -20.5 + Math.sin(a) * rr * 0.45);
    }
    poly(g, ruff, '#f2ead8', 1.5);
    bomb(g, 13, -11, t);
    // chapéu (pontas de trás)
    const sway = Math.sin(t * 5) * 2.5;
    horn(g, -3, -35, -15, -41 + sway, '#7b3fa0');
    horn(g, 6, -35, 18, -40 - sway, '#3f9a4a');
    // cabeça com maquiagem branca
    ball(g, 1, -29, 8.5, '#f4efe4');
    g.fillStyle = OUT;
    path(g, [-0.5, -28.5, 0.6, -26, -0.5, -23.8, -1.6, -26]);
    g.fill();
    path(g, [5, -34.5, 5.9, -33, 5, -32, 4.1, -33]);
    g.fill();
    // olhos desiguais
    const j = Math.sin(t * 23) * 0.4;
    ball(g, 5, -30.5, 3, '#ffffff', 1.3, false);
    g.fillStyle = '#d0142a';
    g.beginPath();
    g.arc(5.8 + j, -30.3, 1.4, 0, TAU);
    g.fill();
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(5.8 + j, -30.3, 0.6, 0, TAU);
    g.fill();
    ball(g, -0.5, -30.5, 1.8, '#ffffff', 1.1, false);
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(0, -30.4, 0.8, 0, TAU);
    g.fill();
    // sorriso costurado
    g.beginPath();
    g.moveTo(-3.5, -25.5);
    g.quadraticCurveTo(2, -19, 9, -26.5);
    g.quadraticCurveTo(3, -23.2, -3.5, -25.5);
    g.closePath();
    g.fillStyle = '#5a0d16';
    g.fill();
    outline(g, 1.3);
    g.fillStyle = '#fff8e0';
    for (let i = 0; i < 4; i++) g.fillRect(-0.6 + i * 2.2, -24.4, 1.4, 1.5);
    g.strokeStyle = OUT;
    g.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      const x = -2.5 + i * 2.6;
      g.beginPath();
      g.moveTo(x, -26.6);
      g.lineTo(x + 0.6, -22.4);
      g.stroke();
    }
    // chapéu (ponta do meio e aba)
    horn(g, 1.5, -36, 2 + sway, -52, '#7b3fa0');
    oval(g, 1.5, -35.5, 8, 2.8, '#2a1534', 1.6, false);
  }

  // ---------- Golem de Pedra ----------
  const ROCK_BODY = [-14, -8, -15, -20, -9, -29, 5, -31, 14, -23, 15, -9, 8, -1, -8, -1];
  const ROCK_JIT = [1, 0.85, 1.05, 0.9, 1, 0.8, 0.95];

  function rock(g, x, y, r) {
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      pts.push(x + Math.cos(a) * r * ROCK_JIT[i], y + Math.sin(a) * r * ROCK_JIT[i]);
    }
    poly(g, pts.map((v, i) => (i % 2 ? v + 2.5 : v)), '#3f3a36');
    poly(g, pts, lin(g, x - r, y - r, x + r, y + r, '#b3aca2', '#5e5750'));
  }

  function heroGolem(g, t, o) {
    const rage = o.rage || 0;
    const step = o.moving ? Math.sin(t * 8) * 2.5 : 0;
    oval(g, -6 + step, -1, 5, 3, '#5a534d', 1.6, false);
    oval(g, 7 - step, -1, 5, 3, '#5a534d', 1.6, false);
    rock(g, -18, -12 + step * 0.5, 7.5);
    // corpo: lateral escura embaixo e face clara em cima dão a sensação de bloco
    poly(g, ROCK_BODY.map((v, i) => (i % 2 ? v + 4 : v)), '#3f3a36');
    poly(g, ROCK_BODY, lin(g, -10, -30, 10, 0, '#b8b1a6', '#615a53'));
    oval(g, -6, -25, 6, 2.8, '#5f9a3c', 1.2);
    oval(g, 6, -27.5, 4, 2, '#6aa845', 1.2);
    // rachaduras de lava que brilham mais com pouca vida
    const lava = mix('#ff7a1a', '#ffe08a', rage);
    if (rage > 0.1) glow(g, 0, -14, 14 + rage * 12, '#ff6a1a', rage * 0.9);
    g.strokeStyle = lava;
    g.globalAlpha = 0.35 + rage * 0.65;
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(-9, -6); g.lineTo(-4, -12); g.lineTo(-6, -17);
    g.moveTo(3, -4); g.lineTo(6, -11); g.lineTo(11, -13);
    g.moveTo(-1, -18); g.lineTo(2, -22);
    g.stroke();
    g.globalAlpha = 1;
    // rosto
    poly(g, [-1, -25, 11, -25, 12, -17, 0, -16], lin(g, 0, -25, 0, -16, '#8d867d', '#5e5750'), 1.6);
    const eyeC = mix('#ffbe28', '#ff2a10', rage);
    glow(g, 6, -21, 9, eyeC, 0.9);
    g.fillStyle = eyeC;
    g.fillRect(2, -22.5, 3.5, 2.2);
    g.fillRect(7, -22.5, 3.5, 2.2);
    rock(g, 18, -12 - step * 0.5, 7.5);
  }

  const HEROES = { mago: heroMago, maniaco: heroManiaco, golem: heroGolem };

  function drawHero(g, id, x, y, s, t, f, o) {
    o = o || {};
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    shadow(g, 0, 0, id === 'golem' ? 21 : 14, id === 'golem' ? 7 : 5);
    const bob = o.moving ? -Math.abs(Math.sin(t * 10)) * 3 : Math.sin(t * 3);
    g.translate(0, bob);
    if (o.moving) g.rotate(Math.sin(t * 10) * 0.06);
    if (f < 0) g.scale(-1, 1);
    HEROES[id](g, t, o);
    g.restore();
  }

  // ============================================================
  // Inimigos (sprites em cache, olhando para a direita, centro = 0,0)
  // ============================================================
  function ogre(g, r, color, isBoss) {
    if (isBoss) {
      // capa
      poly(g, [-r * 0.9, -r * 0.4, r * 0.6, -r * 0.5, r * 0.8, r * 1.05, -r * 1.05, r * 1.0], lin(g, 0, -r, 0, r, '#8a1c2c', '#3a0a14'));
      // clava
      g.save();
      g.translate(r * 1.0, r * 0.2);
      g.rotate(-0.5);
      poly(g, [-r * 0.12, r * 0.2, r * 0.12, r * 0.2, r * 0.3, -r * 1.2, -r * 0.3, -r * 1.2], lin(g, -r * 0.3, 0, r * 0.3, 0, '#a8743e', '#5a3a1c'), 2);
      for (let i = 0; i < 3; i++) poly(g, [r * 0.25, -r * (0.5 + i * 0.3), r * 0.48, -r * (0.6 + i * 0.3), r * 0.28, -r * (0.68 + i * 0.3)], '#d8d0c0', 1.2);
      g.restore();
    }
    ball(g, -r * 0.85, r * 0.3, r * 0.32, dark(color, 0.1), 1.8);
    poly(g, [-r * 0.65, -r * 0.55, -r * 1.05, -r * 1.3, -r * 0.3, -r * 0.8], lin(g, 0, -r * 0.5, 0, -r * 1.3, '#cbbf9c', '#fff6dc'), 1.6);
    poly(g, [r * 0.35, -r * 0.75, r * 0.7, -r * 1.4, r * 0.75, -r * 0.6], lin(g, 0, -r * 0.5, 0, -r * 1.3, '#cbbf9c', '#fff6dc'), 1.6);
    ball(g, 0, 0, r, color, 2.2);
    g.globalAlpha = 0.5;
    oval(g, r * 0.1, r * 0.4, r * 0.55, r * 0.38, light(color, 0.35), 0, false);
    g.globalAlpha = 1;
    eye(g, r * 0.15, -r * 0.22, r * 0.16, '#3a0a0a');
    eye(g, r * 0.55, -r * 0.22, r * 0.16, '#3a0a0a');
    g.strokeStyle = OUT;
    g.lineWidth = Math.max(2, r * 0.09);
    g.beginPath();
    g.moveTo(-r * 0.05, -r * 0.5); g.lineTo(r * 0.3, -r * 0.36);
    g.moveTo(r * 0.75, -r * 0.5); g.lineTo(r * 0.45, -r * 0.36);
    g.stroke();
    g.beginPath();
    g.moveTo(r * 0.05, r * 0.2);
    g.quadraticCurveTo(r * 0.38, r * 0.05, r * 0.72, r * 0.2);
    g.lineWidth = Math.max(1.5, r * 0.06);
    g.stroke();
    poly(g, [r * 0.12, r * 0.18, r * 0.2, -r * 0.02, r * 0.28, r * 0.15], '#fff6dc', 1.1);
    poly(g, [r * 0.55, r * 0.15, r * 0.63, -r * 0.05, r * 0.7, r * 0.18], '#fff6dc', 1.1);
    ball(g, r * 0.95, r * 0.25, r * 0.34, dark(color, 0.1), 1.8);
    if (isBoss) {
      poly(g, [-r * 0.45, -r * 0.82, -r * 0.48, -r * 1.25, -r * 0.22, -r * 1.02, 0, -r * 1.35, r * 0.22, -r * 1.02, r * 0.48, -r * 1.25, r * 0.45, -r * 0.82],
        lin(g, 0, -r * 1.35, 0, -r * 0.8, '#fff0a0', '#d6a12a'), 1.8);
      ball(g, 0, -r * 0.95, r * 0.08, '#ff3b6b', 1);
    }
  }

  const ENEMY_DRAW = {
    slime(g, r) {
      g.beginPath();
      g.moveTo(-r * 1.05, r * 0.55);
      g.bezierCurveTo(-r * 1.15, -r * 0.6, -r * 0.4, -r * 1.0, 0, -r * 0.98);
      g.bezierCurveTo(r * 0.5, -r * 1.0, r * 1.15, -r * 0.6, r * 1.05, r * 0.55);
      g.quadraticCurveTo(0, r * 0.85, -r * 1.05, r * 0.55);
      g.closePath();
      g.fillStyle = radial(g, 0, 0, r * 1.1, '#5fd35f');
      g.fill();
      outline(g, 2);
      shineAt(g, -r * 0.45, -r * 0.5, r * 0.32, r * 0.18);
      eye(g, r * 0.12, -r * 0.22, r * 0.22);
      eye(g, r * 0.6, -r * 0.2, r * 0.2);
      g.strokeStyle = OUT;
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(r * 0.38, r * 0.12, r * 0.15, 0.2, Math.PI - 0.2);
      g.stroke();
    },

    bat(g, r, frame) {
      const flap = [-0.9, -0.3, 0.4, -0.3][frame];
      for (const side of [-1, 1]) {
        g.save();
        g.scale(side, 1);
        g.rotate(flap * 0.6);
        g.beginPath();
        g.moveTo(r * 0.4, -r * 0.2);
        g.lineTo(r * 2.3, -r * 0.9);
        g.lineTo(r * 2.0, r * 0.1);
        g.quadraticCurveTo(r * 1.6, -r * 0.1, r * 1.4, r * 0.45);
        g.quadraticCurveTo(r * 1.0, r * 0.1, r * 0.6, r * 0.5);
        g.closePath();
        g.fillStyle = lin(g, 0, -r, 0, r, '#7a52bf', '#2e1a52');
        g.fill();
        outline(g, 1.6);
        g.restore();
      }
      poly(g, [-r * 0.65, -r * 0.45, -r * 0.5, -r * 1.35, -r * 0.1, -r * 0.8], '#8a5ad0', 1.4);
      poly(g, [r * 0.65, -r * 0.45, r * 0.5, -r * 1.35, r * 0.1, -r * 0.8], '#8a5ad0', 1.4);
      ball(g, 0, 0, r, '#8a5ad0', 1.8);
      glow(g, r * 0.35, -r * 0.15, r * 0.9, '#ff3344', 0.6);
      g.fillStyle = '#ff4455';
      g.beginPath();
      g.arc(r * 0.12, -r * 0.15, r * 0.17, 0, TAU);
      g.arc(r * 0.58, -r * 0.15, r * 0.17, 0, TAU);
      g.fill();
      poly(g, [r * 0.15, r * 0.3, r * 0.25, r * 0.65, r * 0.33, r * 0.3], '#fff', 1);
      poly(g, [r * 0.45, r * 0.3, r * 0.55, r * 0.65, r * 0.63, r * 0.3], '#fff', 1);
    },

    skeleton(g, r) {
      g.save();
      g.translate(r * 0.8, r * 0.35);
      g.rotate(-0.6);
      poly(g, [-r * 0.1, 0, r * 0.1, 0, r * 0.08, -r * 1.3, 0, -r * 1.48, -r * 0.08, -r * 1.3], lin(g, -r * 0.1, 0, r * 0.1, 0, '#c9b9a0', '#7c6a55'), 1.3);
      poly(g, [-r * 0.32, -r * 0.02, r * 0.32, -r * 0.02, r * 0.32, r * 0.1, -r * 0.32, r * 0.1], '#5a4a3a', 1.2);
      g.restore();
      oval(g, -r * 0.05, r * 0.45, r * 0.65, r * 0.5, '#cfc6ad', 1.6, false);
      g.strokeStyle = '#8c8470';
      g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-r * 0.45, r * (0.28 + i * 0.2));
        g.quadraticCurveTo(-r * 0.05, r * (0.38 + i * 0.2), r * 0.35, r * (0.28 + i * 0.2));
        g.stroke();
      }
      ball(g, r * 0.05, -r * 0.3, r * 0.8, '#efe8d2', 1.8);
      g.fillStyle = '#1d1418';
      g.beginPath();
      g.ellipse(r * 0.18, -r * 0.35, r * 0.18, r * 0.22, 0, 0, TAU);
      g.ellipse(r * 0.6, -r * 0.35, r * 0.18, r * 0.22, 0, 0, TAU);
      g.fill();
      glow(g, r * 0.4, -r * 0.35, r * 0.7, '#ff4b3a', 0.5);
      g.fillStyle = '#ff6b4a';
      g.beginPath();
      g.arc(r * 0.2, -r * 0.33, r * 0.07, 0, TAU);
      g.arc(r * 0.62, -r * 0.33, r * 0.07, 0, TAU);
      g.fill();
      poly(g, [r * 0.4, -r * 0.1, r * 0.48, r * 0.02, r * 0.32, r * 0.02], '#1d1418', 0);
      g.fillStyle = '#fffbea';
      g.fillRect(r * 0.05, r * 0.1, r * 0.65, r * 0.16);
      g.strokeStyle = OUT;
      g.lineWidth = 1;
      g.strokeRect(r * 0.05, r * 0.1, r * 0.65, r * 0.16);
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(r * (0.05 + i * 0.16), r * 0.1);
        g.lineTo(r * (0.05 + i * 0.16), r * 0.26);
        g.stroke();
      }
    },

    brute(g, r) { ogre(g, r, '#d0603a', false); },
    boss(g, r) { ogre(g, r, '#a8325e', true); },

    lich(g, r) {
      g.save();
      g.translate(r * 0.95, 0);
      poly(g, [-r * 0.06, r * 0.9, r * 0.06, r * 0.9, r * 0.06, -r * 1.1, -r * 0.06, -r * 1.1], '#4a3a2a', 1.3);
      glow(g, 0, -r * 1.25, r * 0.8, '#4fe0d0', 0.9);
      ball(g, 0, -r * 1.25, r * 0.22, '#8ffff0', 1.4);
      g.restore();
      g.beginPath();
      g.moveTo(0, -r * 1.0);
      g.quadraticCurveTo(r * 0.9, -r * 0.6, r * 0.95, r * 0.9);
      for (let i = 1; i <= 4; i++) g.lineTo(r * (0.95 - i * 0.475), r * (i % 2 ? 0.75 : 0.95));
      g.quadraticCurveTo(-r * 0.9, -r * 0.6, 0, -r * 1.0);
      g.closePath();
      g.fillStyle = lin(g, 0, -r, 0, r, '#2f5a78', '#0f1d2c');
      g.fill();
      outline(g, 2);
      g.strokeStyle = '#4fe0d0';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(r * 0.1, -r * 0.05);
      g.lineTo(r * 0.1, r * 0.8);
      g.stroke();
      oval(g, r * 0.1, -r * 0.45, r * 0.5, r * 0.46, '#16222e', 1.6, false);
      ball(g, r * 0.18, -r * 0.4, r * 0.32, '#d6e4dc', 1.4);
      glow(g, r * 0.22, -r * 0.45, r * 0.55, '#4fe0d0', 0.9);
      g.fillStyle = '#b8fff6';
      g.beginPath();
      g.arc(r * 0.1, -r * 0.45, r * 0.07, 0, TAU);
      g.arc(r * 0.32, -r * 0.45, r * 0.07, 0, TAU);
      g.fill();
      for (let i = -2; i <= 2; i++) {
        const bx = r * 0.1 + i * r * 0.18;
        poly(g, [bx - r * 0.06, -r * 0.82, bx, -r * (1.05 + (2 - Math.abs(i)) * 0.08), bx + r * 0.06, -r * 0.82], '#e8e2cf', 1);
      }
    },
  };

  function enemySprite(type, r, frame, flash) {
    const key = `${type}:${r}:${frame}`;
    const base = sprite(key, r * 5.2, (g) => ENEMY_DRAW[type](g, r, frame));
    return flash ? whiteVersion(key, base) : base;
  }

  function drawEnemy(g, e, face) {
    shadow(g, e.x, e.y + e.r * 0.85, e.r * 0.95, e.r * 0.38);
    let sx = face;
    let sy = 1;
    let oy = 0;
    let rot = 0;
    let frame = 0;
    if (e.type === 'slime') {
      const q = Math.sin(e.phase * 6) * 0.1;
      sx *= 1 + q;
      sy = 1 - q;
      oy = e.r * q * 0.8;
    } else if (e.type === 'bat') {
      frame = Math.floor(e.phase * 14) % 4;
      oy = Math.sin(e.phase * 7) * 3 - 6;
    } else {
      oy = -Math.abs(Math.sin(e.phase * 7)) * 2.5;
      rot = Math.sin(e.phase * 7) * 0.07;
    }
    blit(g, enemySprite(e.type, e.r, frame, e.flash > 0), e.x, e.y + oy, sx, sy, rot);
  }

  // ============================================================
  // Itens
  // ============================================================
  function gemSprite(color) {
    return sprite('gem:' + color, 22, (g) => {
      const s = 5.5;
      poly(g, [0, -s * 1.5, s, -s * 0.2, 0, s * 1.4, -s, -s * 0.2], color, 1.4);
      poly(g, [0, -s * 1.5, s, -s * 0.2, 0, -s * 0.1], light(color, 0.45), 0);
      poly(g, [0, -s * 0.1, s, -s * 0.2, 0, s * 1.4], dark(color, 0.3), 0);
      path(g, [0, -s * 1.5, s, -s * 0.2, 0, s * 1.4, -s, -s * 0.2]);
      outline(g, 1.4);
      shineAt(g, -s * 0.35, -s * 0.6, s * 0.22, s * 0.4);
    });
  }

  function drawGem(g, p, t) {
    const color = p.v >= 5 ? '#ff5fd0' : p.v >= 2 ? '#3ff0a0' : '#4fc9ff';
    const sc = p.v >= 5 ? 1.35 : 1;
    const bob = Math.sin(t * 4 + p.x * 0.1) * 1.5;
    glow(g, p.x, p.y + bob, 13 * sc, color, 0.35);
    blit(g, gemSprite(color), p.x, p.y + bob, sc, sc);
  }

  const heartSprite = () => sprite('heart', 26, (g) => {
    g.beginPath();
    g.moveTo(0, 8);
    g.bezierCurveTo(-11, 0, -9, -10, -3.5, -8);
    g.quadraticCurveTo(-1, -7, 0, -4);
    g.quadraticCurveTo(1, -7, 3.5, -8);
    g.bezierCurveTo(9, -10, 11, 0, 0, 8);
    g.closePath();
    g.fillStyle = radial(g, 0, -1, 10, '#ff4f6a');
    g.fill();
    outline(g, 1.8);
    shineAt(g, -4, -4.5, 2.4, 1.5);
  });

  function drawHeart(g, p, t) {
    const s = 1 + Math.sin(t * 6) * 0.08;
    glow(g, p.x, p.y, 16, '#ff4f6a', 0.35);
    blit(g, heartSprite(), p.x, p.y, s, s);
  }

  function drawChest(g, x, y, t) {
    const bob = Math.sin(t * 3) * 1.5;
    // raios dourados girando
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const a = t * 0.8 + (i / 8) * TAU;
      g.fillStyle = 'rgba(255,211,107,0.12)';
      g.beginPath();
      g.moveTo(x, y - 6);
      g.lineTo(x + Math.cos(a - 0.12) * 60, y - 6 + Math.sin(a - 0.12) * 60);
      g.lineTo(x + Math.cos(a + 0.12) * 60, y - 6 + Math.sin(a + 0.12) * 60);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = op;
    glow(g, x, y - 6, 40, '#ffd36b', 0.5);
    shadow(g, x, y + 11, 18, 5);
    const yy = y + bob;
    poly(g, [x - 16, yy - 6, x + 16, yy - 6, x + 16, yy + 10, x - 16, yy + 10], lin(g, 0, yy - 6, 0, yy + 10, '#a8703a', '#5e3a1a'), 2);
    poly(g, [x - 17, yy - 7, x - 13, yy - 19, x + 13, yy - 19, x + 17, yy - 7], lin(g, 0, yy - 19, 0, yy - 7, '#d69a52', '#8a5a2b'), 2);
    g.fillStyle = '#f2c443';
    for (const bx of [-10, 7]) {
      g.fillRect(x + bx, yy - 18.5, 3.5, 28);
      g.strokeStyle = OUT;
      g.lineWidth = 1;
      g.strokeRect(x + bx, yy - 18.5, 3.5, 28);
    }
    ball(g, x, yy - 5, 3.4, '#ffd36b', 1.4);
  }

  // ============================================================
  // Estruturas
  // ============================================================
  // Fogueira (estilo Dark Souls): círculo de pedras, cinzas e uma espada espiralada fincada.
  function bonfireGround(g, x, y, t, color, lit) {
    g.save();
    g.translate(x, y);
    g.scale(1.45, 1.45);
    x = 0;
    y = 0;
    if (lit) glow(g, x, y - 8, 90 + Math.sin(t * 9) * 6, color, 0.3);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      ball(g, x + Math.cos(a) * 21, y + Math.sin(a) * 9, 4.3, '#7b766f', 1.4);
    }
    oval(g, x, y, 17, 7, '#4a4440', 1.6, false);
    oval(g, x, y - 1, 12, 4.5, '#6e6660', 0, false);
    g.strokeStyle = '#2a1d16';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - 12, y + 2); g.lineTo(x + 8, y - 4);
    g.moveTo(x - 8, y - 4); g.lineTo(x + 12, y + 2);
    g.stroke();
    g.strokeStyle = '#e8e2cf';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 4, y + 4); g.lineTo(x + 5, y + 3);
    g.stroke();
    if (lit) glow(g, x, y - 2, 22, color, 0.45);
    else glow(g, x, y - 1, 10, '#ff6a2a', 0.35);
    g.restore();
  }

  function bonfireTop(g, x, y, t, color, lit) {
    g.save();
    g.translate(x, y);
    g.scale(1.45, 1.45);
    x = 0;
    y = 0;
    g.save();
    g.translate(x, y - 2);
    g.rotate(0.12);
    const heat = lit ? '#ff9a4a' : '#6a625a';
    poly(g, [-1.2, 0, 1.2, 0, 2.6, -30, -2.6, -30], lin(g, 0, 0, 0, -30, heat, '#a3a9b2'), 1.5);
    // espiral da lâmina
    g.strokeStyle = '#3a3330';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(-3.5, -3);
    for (let k = 0; k < 6; k++) g.quadraticCurveTo(k % 2 ? -5 : 5, -5 - k * 3.2, k % 2 ? -3.5 : 3.5, -6.4 - k * 3.2);
    g.stroke();
    g.strokeStyle = lit ? '#ffb070' : '#8a827a';
    g.lineWidth = 0.9;
    g.stroke();
    poly(g, [-8, -30, 8, -30, 7, -33.5, -7, -33.5], '#4a4440', 1.4);
    poly(g, [-1.5, -33.5, 1.5, -33.5, 1.5, -43, -1.5, -43], '#3a2a20', 1.2);
    ball(g, 0, -45, 2.6, '#6a625a', 1.3);
    g.restore();
    if (lit) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.4;
        const h = 22 + Math.sin(t * 11 + i * 1.7) * 7;
        flame(g, x + Math.cos(a) * 7, y + Math.sin(a) * 3, 5, h, Math.sin(t * 7 + i) * 3, dark(color, 0.15), light(color, 0.35));
      }
      flame(g, x, y, 7, 34 + Math.sin(t * 9) * 6, Math.sin(t * 5) * 2, dark(color, 0.1), light(color, 0.5));
    }
    g.restore();
  }

  function altar(g, x, y, r, t, used) {
    const color = used ? '#555555' : '#ff3355';
    if (!used) glow(g, x, y, r * 2.2, '#ff2244', 0.25 + Math.sin(t * 3) * 0.08);
    g.beginPath();
    g.ellipse(x, y, r, r * 0.55, 0, 0, TAU);
    g.fillStyle = lin(g, x, y - r, x, y + r, used ? '#3a3236' : '#3a1420', used ? '#1e1a1c' : '#1a0810');
    g.fill();
    outline(g, 3);
    g.save();
    g.translate(x, y);
    g.scale(1, 0.55);
    // estrela de cinco pontas com brilho
    const star = () => {
      g.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * TAU) / 5;
        const px = Math.cos(a) * r * 0.8;
        const py = Math.sin(a) * r * 0.8;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
    };
    if (!used) {
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      star();
      g.strokeStyle = 'rgba(255,40,80,0.35)';
      g.lineWidth = 8;
      g.stroke();
      g.globalCompositeOperation = op;
    }
    star();
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    g.stroke();
    // runas girando na borda
    g.fillStyle = color;
    for (let i = 0; i < 10; i++) {
      const a = t * 0.6 + (i / 10) * TAU;
      g.save();
      g.translate(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
      g.rotate(a);
      g.fillRect(-3, -1, 6, 2);
      g.fillRect(-1, -3, 2, 6);
      g.restore();
    }
    g.restore();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * TAU) / 4;
      const px = x + Math.cos(a) * (r + 12);
      const py = y + Math.sin(a) * (r + 12) * 0.6;
      poly(g, [px - 6, py, px - 6, py - 22, px + 6, py - 22, px + 6, py], lin(g, px - 6, 0, px + 6, 0, '#5a5260', '#2a2430'), 1.6);
      oval(g, px, py - 22, 7, 2.5, '#6a6270', 1.4, false);
      if (!used) {
        glow(g, px, py - 30, 18, '#ff5533', 0.6);
        flame(g, px, py - 22, 4.5, 16 + Math.sin(t * 12 + i) * 4, Math.sin(t * 8 + i) * 2, '#ff4422', '#ffe080');
      }
    }
  }

  // ============================================================
  // Chão (gerado em blocos e guardado em cache)
  // ============================================================
  const CHUNK = 512;
  const chunks = new Map();

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeChunk(cx, cy) {
    const c = document.createElement('canvas');
    c.width = c.height = CHUNK;
    const g = c.getContext('2d');
    const R = rng((Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) + 12345);
    const rr = (a, b) => a + R() * (b - a);
    g.fillStyle = '#3f7a3a';
    g.fillRect(0, 0, CHUNK, CHUNK);
    // Manchas de tons de verde. Cada bloco também desenha as manchas dos vizinhos
    // que invadem o seu espaço, então as bordas entre blocos não aparecem.
    const tones = ['#44803d', '#3b7337', '#47853f', '#39702f', '#417c3a'];
    g.globalAlpha = 0.5;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const B = rng((Math.imul(cx + ox, 83492791) ^ Math.imul(cy + oy, 2971215073)) + 777);
        for (let i = 0; i < 40; i++) {
          const x = B() * CHUNK + ox * CHUNK;
          const y = B() * CHUNK + oy * CHUNK;
          const rx = 30 + B() * 60;
          const ry = 20 + B() * 40;
          const rot = B() * 3;
          g.fillStyle = tones[Math.floor(B() * tones.length)];
          if (x + rx < -10 || x - rx > CHUNK + 10 || y + rx < -10 || y - rx > CHUNK + 10) continue;
          g.beginPath();
          g.ellipse(x, y, rx, ry, rot, 0, TAU);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    // textura de folhinhas
    for (let i = 0; i < 380; i++) {
      g.strokeStyle = R() < 0.5 ? 'rgba(20,50,20,0.25)' : 'rgba(140,200,110,0.18)';
      g.lineWidth = 1.5;
      const x = rr(0, CHUNK);
      const y = rr(0, CHUNK);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rr(-2, 2), y - rr(3, 6));
      g.stroke();
    }
    const M = 40; // margem para nada cortar na borda do bloco
    const inner = () => [rr(M, CHUNK - M), rr(M, CHUNK - M)];
    if (R() < 0.45) {
      const [x, y] = inner();
      g.globalAlpha = 0.7;
      g.fillStyle = '#7a5a3a';
      g.beginPath();
      g.ellipse(x, y, rr(18, 34), rr(10, 18), rr(0, 3), 0, TAU);
      g.fill();
      g.globalAlpha = 1;
      for (let k = 0; k < 6; k++) ball(g, x + rr(-16, 16), y + rr(-8, 8), rr(1.5, 3), '#a08a70', 0.8, false);
    }
    // tufos de grama cartoon
    for (let i = 0; i < 12; i++) {
      const [x, y] = inner();
      const c1 = R() < 0.5 ? '#5fae4a' : '#6cbf52';
      for (let k = -1; k <= 1; k++) {
        poly(g, [x + k * 4 - 2, y, x + k * 6, y - rr(9, 14), x + k * 4 + 2, y], lin(g, 0, y - 12, 0, y, c1, '#2f6a2a'), 0);
      }
    }
    // flores
    for (let i = 0; i < 8; i++) {
      const [x, y] = inner();
      const col = ['#ffffff', '#f2d14b', '#ff8fb0', '#a8c8ff'][Math.floor(R() * 4)];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        ball(g, x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.2, col, 0.8, false);
      }
      ball(g, x, y, 1.8, '#f2a23a', 0.8, false);
    }
    // pedras
    for (let i = 0; i < 5; i++) {
      const [x, y] = inner();
      const s = rr(4, 9);
      shadow(g, x + 1, y + s * 0.5, s * 1.1, s * 0.4);
      oval(g, x, y, s * 1.2, s * 0.8, '#8a918c', 1.4);
    }
    // cogumelos
    for (let i = 0; i < 2; i++) {
      if (R() < 0.5) continue;
      const [x, y] = inner();
      g.fillStyle = '#f2ead8';
      g.fillRect(x - 1.5, y - 5, 3, 6);
      g.strokeStyle = OUT;
      g.lineWidth = 1;
      g.strokeRect(x - 1.5, y - 5, 3, 6);
      oval(g, x, y - 6, 6, 4, '#d8323a', 1.3);
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x - 2, y - 7, 1, 0, TAU);
      g.arc(x + 2.5, y - 6, 0.8, 0, TAU);
      g.fill();
    }
    // arbustos
    for (let i = 0; i < 2; i++) {
      if (R() < 0.35) continue;
      const [x, y] = inner();
      shadow(g, x, y + 8, 22, 6);
      for (const [ox, oy, r] of [[-11, 0, 10], [11, 1, 9], [0, -6, 12], [0, 4, 10]]) ball(g, x + ox, y + oy, r, '#3f8f3a', 1.8);
      if (R() < 0.5) for (let k = 0; k < 4; k++) ball(g, x + rr(-12, 12), y + rr(-8, 6), 2, '#e0304a', 0.8, false);
    }
    return c;
  }

  function drawGround(g, camX, camY, W, H) {
    const x0 = Math.floor(camX / CHUNK);
    const y0 = Math.floor(camY / CHUNK);
    const x1 = Math.floor((camX + W) / CHUNK);
    const y1 = Math.floor((camY + H) / CHUNK);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = cx + ',' + cy;
        let c = chunks.get(key);
        if (!c) {
          c = makeChunk(cx, cy);
          chunks.set(key, c);
          if (chunks.size > 40) chunks.delete(chunks.keys().next().value);
        }
        g.drawImage(c, cx * CHUNK, cy * CHUNK);
      }
    }
  }

  let vigCanvas = null;
  function vignette(g, W, H) {
    if (!vigCanvas || vigCanvas.width !== W || vigCanvas.height !== H) {
      vigCanvas = document.createElement('canvas');
      vigCanvas.width = W;
      vigCanvas.height = H;
      const v = vigCanvas.getContext('2d');
      const gr = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      gr.addColorStop(0, 'rgba(10,8,20,0)');
      gr.addColorStop(1, 'rgba(10,8,20,0.6)');
      v.fillStyle = gr;
      v.fillRect(0, 0, W, H);
    }
    g.drawImage(vigCanvas, 0, 0, W, H);
  }

  // ============================================================
  // Ícones de armas e passivas (viram imagens para a interface)
  // ============================================================
  const ICONS = {
    missil(g) {
      glow(g, 0, 0, 26, '#59d8ff', 0.6);
      poly(g, [16, -16, 4, -2, -14, 14, -2, 2], lin(g, -14, 14, 16, -16, '#5fb0e8', '#f0fbff'), 2);
      poly(g, [-4, -12, 2, -4, -10, -2], '#bfeaff', 1.5);
      poly(g, [10, 4, 4, 2, 12, 12], '#bfeaff', 1.5);
    },
    arco(g) {
      g.beginPath();
      g.arc(-6, 0, 18, -1.2, 1.2);
      g.strokeStyle = OUT;
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = '#a8743e';
      g.lineWidth = 3.5;
      g.stroke();
      g.strokeStyle = '#e8e2cf';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-6 + Math.cos(-1.2) * 18, Math.sin(-1.2) * 18);
      g.lineTo(-6 + Math.cos(1.2) * 18, Math.sin(1.2) * 18);
      g.stroke();
      g.strokeStyle = OUT;
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(14, 0); g.stroke();
      g.strokeStyle = '#8a5a2b';
      g.lineWidth = 2;
      g.stroke();
      poly(g, [20, 0, 12, -5, 12, 5], '#e8eef6', 1.5);
      poly(g, [-10, -1, -14, -6, -8, -1], '#e04040', 1);
      poly(g, [-10, 1, -14, 6, -8, 1], '#e04040', 1);
    },
    facas(g) {
      for (const s of [-1, 1]) {
        g.save();
        g.rotate(s * 0.7);
        poly(g, [-2.5, -18, 2.5, -18, 3, 4, -3, 4], lin(g, -3, 0, 3, 0, '#8d96a2', '#f4f8fc'), 1.6);
        poly(g, [-6, 4, 6, 4, 6, 7, -6, 7], '#5a4a3a', 1.4);
        poly(g, [-2, 7, 2, 7, 2, 17, -2, 17], '#7a3020', 1.4);
        g.restore();
      }
    },
    raio(g) {
      glow(g, 0, 0, 26, '#8fd8ff', 0.5);
      poly(g, [4, -20, -10, 2, -1, 2, -6, 20, 12, -4, 2, -4, 8, -20], lin(g, 0, -20, 0, 20, '#ffffff', '#ffd23f'), 2);
    },
    fogo(g) {
      glow(g, 0, 0, 26, '#ff7a1a', 0.7);
      flame(g, 4, 6, 8, 26, -8, '#ff7a1a', '#ffe08a');
      ball(g, -2, 6, 9, '#ff9a3a', 1.8);
      ball(g, -2, 6, 4.5, '#fff0b0', 0, false);
    },
    laminas(g) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        g.save();
        g.rotate(a);
        poly(g, [0, -6, 6, -10, 18, -4, 6, 2], lin(g, 0, -10, 0, 2, '#f4f8fc', '#8d96a2'), 1.6);
        g.restore();
      }
      ball(g, 0, 0, 5, '#6f86ab', 1.6);
    },
    aura(g) {
      glow(g, 0, 0, 26, '#ffe27a', 0.6);
      g.beginPath();
      g.arc(0, 0, 15, 0, TAU);
      g.strokeStyle = OUT;
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = '#ffd36b';
      g.lineWidth = 3.5;
      g.stroke();
      ball(g, 0, 0, 6, '#fff3b0', 1.5);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ball(g, Math.cos(a) * 15, Math.sin(a) * 15, 2.4, '#fff6cc', 1);
      }
    },
    tremor(g) {
      g.strokeStyle = 'rgba(200,170,120,0.9)';
      g.lineWidth = 2.5;
      for (const r of [14, 19]) {
        g.beginPath();
        g.ellipse(0, 6, r, r * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      }
      rock(g, 0, 2, 10);
      g.strokeStyle = '#ff9a3a';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-3, -2); g.lineTo(0, 3); g.lineTo(4, 1); g.stroke();
    },
    vigor(g) {
      g.save();
      g.scale(1.8, 1.8);
      g.translate(0, 1);
      g.beginPath();
      g.moveTo(0, 8);
      g.bezierCurveTo(-11, 0, -9, -10, -3.5, -8);
      g.quadraticCurveTo(-1, -7, 0, -4);
      g.quadraticCurveTo(1, -7, 3.5, -8);
      g.bezierCurveTo(9, -10, 11, 0, 0, 8);
      g.closePath();
      g.fillStyle = radial(g, 0, -1, 10, '#ff4f6a');
      g.fill();
      outline(g, 1.2);
      shineAt(g, -4, -4.5, 2.4, 1.5);
      g.restore();
    },
    boots(g) {
      poly(g, [-8, -16, 4, -16, 4, 4, 16, 6, 16, 14, -8, 14], lin(g, 0, -16, 0, 14, '#a8743e', '#5a3a1c'), 2);
      poly(g, [-9, -18, 5, -18, 5, -12, -9, -12], '#d6a12a', 1.6);
      poly(g, [6, -6, 18, -12, 14, -2], '#e8f6ff', 1.4);
    },
    might(g) {
      g.save();
      g.rotate(-0.78);
      poly(g, [-3, -20, 3, -20, 3, 6, -3, 6], lin(g, -3, 0, 3, 0, '#8d96a2', '#f4f8fc'), 1.8);
      poly(g, [0, -24, 3, -20, -3, -20], '#f4f8fc', 1.4);
      poly(g, [-10, 6, 10, 6, 10, 10, -10, 10], '#d6a12a', 1.6);
      poly(g, [-2.5, 10, 2.5, 10, 2.5, 18, -2.5, 18], '#5a3020', 1.4);
      ball(g, 0, 20, 3, '#d6a12a', 1.2);
      g.restore();
    },
    haste(g) {
      poly(g, [-12, -18, 12, -18, 2, 0, 12, 18, -12, 18, -2, 0], lin(g, 0, -18, 0, 18, '#bfeaff', '#7fb8e0'), 2);
      poly(g, [-6, 10, 6, 10, 9, 16, -9, 16], '#ffd36b', 0);
      poly(g, [-14, -21, 14, -21, 14, -17, -14, -17], '#a8743e', 1.6);
      poly(g, [-14, 17, 14, 17, 14, 21, -14, 21], '#a8743e', 1.6);
    },
    magnet(g) {
      g.beginPath();
      g.arc(0, -2, 12, Math.PI, 0);
      g.lineTo(12, 14);
      g.lineTo(5, 14);
      g.lineTo(5, -2);
      g.arc(0, -2, 5, 0, Math.PI, true);
      g.lineTo(-5, 14);
      g.lineTo(-12, 14);
      g.closePath();
      g.fillStyle = lin(g, 0, -14, 0, 14, '#ff6b6b', '#b02a2a');
      g.fill();
      outline(g, 2);
      poly(g, [-12, 8, -5, 8, -5, 14, -12, 14], '#e8eef6', 1.4);
      poly(g, [5, 8, 12, 8, 12, 14, 5, 14], '#e8eef6', 1.4);
    },
    regen(g) {
      glow(g, 0, 0, 24, '#6bff8a', 0.5);
      poly(g, [-5, -16, 5, -16, 5, -5, 16, -5, 16, 5, 5, 5, 5, 16, -5, 16, -5, 5, -16, 5, -16, -5, -5, -5], lin(g, 0, -16, 0, 16, '#9dffb0', '#2fa84a'), 2);
    },
    armor(g) {
      poly(g, [0, -18, 15, -12, 13, 4, 0, 18, -13, 4, -15, -12], lin(g, -15, -18, 15, 18, '#c9d6e6', '#5a6a82'), 2);
      poly(g, [0, -12, 9, -8, 8, 2, 0, 11, -8, 2, -9, -8], '#d6a12a', 1.4);
    },
    multi(g) {
      for (const [x, y] of [[-9, 6], [9, 6], [0, -9]]) {
        glow(g, x, y, 12, '#b07aff', 0.5);
        ball(g, x, y, 6.5, '#b07aff', 1.6);
      }
    },
    precisao(g) {
      g.strokeStyle = OUT;
      g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.stroke();
      g.strokeStyle = '#ff5a5a';
      g.lineWidth = 3;
      g.stroke();
      ball(g, 0, 0, 6, '#ff5a5a', 1.6);
      g.strokeStyle = '#fff';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(0, -20); g.lineTo(0, -9); g.moveTo(0, 20); g.lineTo(0, 9);
      g.moveTo(-20, 0); g.lineTo(-9, 0); g.moveTo(20, 0); g.lineTo(9, 0);
      g.stroke();
    },
    area(g) {
      glow(g, 0, 0, 24, '#7fe0ff', 0.4);
      for (const [r, c] of [[18, '#5fa8ff'], [12, '#7fe0ff'], [6, '#d8f6ff']]) {
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.strokeStyle = OUT;
        g.lineWidth = 4.5;
        g.stroke();
        g.strokeStyle = c;
        g.lineWidth = 2.5;
        g.stroke();
      }
    },
    sorte(g) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        ball(g, Math.cos(a) * 8, Math.sin(a) * 8 - 2, 7.5, '#4fbf4a', 1.6);
      }
      g.strokeStyle = OUT;
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(4, 12, 10, 18); g.stroke();
      g.strokeStyle = '#2f8a2a';
      g.lineWidth = 2;
      g.stroke();
    },
    heal(g) { ICONS.vigor(g); },
    xp(g) {
      glow(g, 0, 0, 26, '#4fc9ff', 0.6);
      const k = 3;
      poly(g, [0, -5.5 * k, 5.5 * k * 0.7, -1 * k, 0, 5 * k, -5.5 * k * 0.7, -1 * k], '#4fc9ff', 2);
      poly(g, [0, -5.5 * k, 5.5 * k * 0.7, -1 * k, 0, -0.5 * k], light('#4fc9ff', 0.45), 0);
      poly(g, [0, -0.5 * k, 5.5 * k * 0.7, -1 * k, 0, 5 * k], dark('#4fc9ff', 0.3), 0);
      path(g, [0, -5.5 * k, 5.5 * k * 0.7, -1 * k, 0, 5 * k, -5.5 * k * 0.7, -1 * k]);
      outline(g, 2);
    },
    coin(g) {
      glow(g, 0, 0, 26, '#ffd36b', 0.5);
      ball(g, 0, 0, 16, '#f2c443', 2.2);
      g.strokeStyle = '#a8761e';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 10.5, 0, TAU);
      g.stroke();
      g.fillStyle = '#a8761e';
      g.font = '900 15px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('$', 0, 1);
    },
    lock(g) {
      g.strokeStyle = OUT;
      g.lineWidth = 7;
      g.beginPath();
      g.arc(0, -4, 9, Math.PI, 0);
      g.lineTo(9, 2);
      g.moveTo(-9, 2);
      g.lineTo(-9, -4);
      g.stroke();
      g.strokeStyle = '#c9d0da';
      g.lineWidth = 3.5;
      g.stroke();
      poly(g, [-14, 0, 14, 0, 14, 20, -14, 20], lin(g, 0, 0, 0, 20, '#ffd36b', '#b8862a'), 2);
      ball(g, 0, 8, 3, '#3a2a10', 0, false);
      g.fillStyle = '#3a2a10';
      g.fillRect(-1.2, 8, 2.4, 6);
    },
  };

  // Moeda girando no chão.
  const coinSprite = () => sprite('coin', 24, (g) => {
    ball(g, 0, 0, 7, '#f2c443', 1.6);
    g.strokeStyle = '#a8761e';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(0, 0, 4.5, 0, TAU);
    g.stroke();
  });

  function drawCoin(g, p, t) {
    const spin = Math.max(0.2, Math.abs(Math.cos(t * 5 + p.x * 0.05)));
    glow(g, p.x, p.y, 12, '#ffd36b', 0.35);
    blit(g, coinSprite(), p.x, p.y + Math.sin(t * 4 + p.y) * 1.5, spin, 1);
  }

  // Silhueta escura de um personagem (para os bloqueados).
  let silCanvas = null;
  function drawHeroSilhouette(g, id, x, y, s, t) {
    const size = 420;
    if (!silCanvas) {
      silCanvas = document.createElement('canvas');
      silCanvas.width = silCanvas.height = size;
    }
    const c = silCanvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, size, size);
    drawHero(c, id, size / 2, size * 0.9, s, t, 1, {});
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = '#07050c';
    c.fillRect(0, 0, size, size);
    c.globalCompositeOperation = 'source-over';
    g.drawImage(silCanvas, x - size / 2, y - size * 0.9);
  }

  // Retrato parado de um personagem, como imagem (para a loja).
  const heroUrls = new Map();
  function heroIcon(id) {
    let url = heroUrls.get(id);
    if (!url) {
      const c = document.createElement('canvas');
      c.width = c.height = 200;
      const g = c.getContext('2d');
      drawHero(g, id, 100, 182, id === 'golem' ? 3.6 : 4.4, 0.4, 1, { rage: 0.4 });
      url = c.toDataURL();
      heroUrls.set(id, url);
    }
    return url;
  }

  const iconUrls = new Map();
  function icon(id) {
    let url = iconUrls.get(id);
    if (!url) {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const g = c.getContext('2d');
      g.translate(48, 48);
      g.scale(2, 2);
      (ICONS[id] || ICONS.heal)(g);
      url = c.toDataURL();
      iconUrls.set(id, url);
    }
    return url;
  }

  return {
    TAU, OUT,
    mix, light, dark, rgba,
    outline, ball, oval, poly, path, lin, shadow, glow, flame, sprite, blit,
    drawHero, drawHeroSilhouette, heroIcon, drawEnemy, drawGem, drawHeart, drawChest, drawCoin,
    bonfireGround, bonfireTop, altar,
    drawGround, vignette, icon, setLowQuality,
  };
})();
