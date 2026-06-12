/* ============================================================
   Fruit Ninja — vanilla JS canvas game
   No external assets: fruit art and sounds are generated in code.
   ============================================================ */

(() => {
  'use strict';

  // ---------- Canvas setup ----------

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildBackground();
  }
  window.addEventListener('resize', resize);

  // ---------- Background (wooden board) ----------

  let bgCanvas = null;

  function buildBackground() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = W;
    bgCanvas.height = H;
    const b = bgCanvas.getContext('2d');

    const base = b.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#8a5a2b');
    base.addColorStop(0.5, '#6f4518');
    base.addColorStop(1, '#52300e');
    b.fillStyle = base;
    b.fillRect(0, 0, W, H);

    // planks
    const plankH = 90;
    for (let y = 0; y < H; y += plankH) {
      b.fillStyle = 'rgba(0,0,0,0.18)';
      b.fillRect(0, y, W, 3);
      // grain lines
      b.strokeStyle = 'rgba(60,30,5,0.25)';
      b.lineWidth = 1.5;
      const n = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const gy = y + 10 + Math.random() * (plankH - 20);
        b.beginPath();
        b.moveTo(0, gy);
        for (let x = 0; x <= W; x += 60) {
          b.lineTo(x, gy + Math.sin(x * 0.02 + gy) * 4);
        }
        b.stroke();
      }
      // a few knots
      if (Math.random() < 0.7) {
        const kx = Math.random() * W, ky = y + plankH * 0.5;
        b.strokeStyle = 'rgba(40,20,2,0.35)';
        for (let r = 3; r < 14; r += 3.5) {
          b.beginPath();
          b.ellipse(kx, ky, r * 1.4, r, 0.2, 0, Math.PI * 2);
          b.stroke();
        }
      }
    }

    // vignette
    const v = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    b.fillStyle = v;
    b.fillRect(0, 0, W, H);
  }

  // ---------- Audio (synthesized with Web Audio API) ----------

  let audio = null;

  function initAudio() {
    if (audio) return;
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audio = null;
    }
  }

  function noiseBuffer(dur) {
    const len = Math.floor(audio.sampleRate * dur);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playSwoosh() {
    if (!audio) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.18);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(3500, t + 0.12);
    filter.Q.value = 1.2;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start(t);
  }

  function playSplat() {
    if (!audio) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.12);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start(t);

    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    const og = audio.createGain();
    og.gain.setValueAtTime(0.15, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  function playThrow() {
    if (!audio) return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.18);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  function playBombFuse() {
    if (!audio) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.1);
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start(t);
  }

  function playExplosion() {
    if (!audio) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.7);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.7);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start(t);

    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    const og = audio.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(og).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  function playCombo(n) {
    if (!audio) return;
    const t = audio.currentTime;
    const notes = [523, 659, 784, 1046, 1318];
    for (let i = 0; i < Math.min(n, notes.length); i++) {
      const osc = audio.createOscillator();
      osc.type = 'square';
      osc.frequency.value = notes[i];
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.0001, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.08, t + i * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.15);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.18);
    }
  }

  function playGameOver() {
    if (!audio) return;
    const t = audio.currentTime;
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => {
      const osc = audio.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.0001, t + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.1, t + i * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.3);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.35);
    });
  }

  // ---------- Fruit definitions ----------

  const FRUITS = [
    {
      name: 'watermelon', radius: 52, score: 1,
      skin: '#1e8a2e', flesh: '#ff4d5e', rim: '#c8f0c0', juice: '#ff4d5e',
      drawWhole(c, r) {
        c.fillStyle = this.skin;
        circle(c, 0, 0, r);
        c.fill();
        // dark stripes
        c.strokeStyle = '#0f5c1a';
        c.lineWidth = r * 0.16;
        for (let i = -2; i <= 2; i++) {
          c.beginPath();
          c.moveTo(i * r * 0.38, -Math.sqrt(Math.max(0, r * r - Math.pow(i * r * 0.38, 2))));
          c.quadraticCurveTo(i * r * 0.55, 0, i * r * 0.38, Math.sqrt(Math.max(0, r * r - Math.pow(i * r * 0.38, 2))));
          c.stroke();
        }
        glossy(c, r);
      },
      drawFace(c, r) {
        c.fillStyle = this.rim;
        circle(c, 0, 0, r);
        c.fill();
        c.fillStyle = this.flesh;
        circle(c, 0, 0, r * 0.86);
        c.fill();
        // seeds
        c.fillStyle = '#2b1500';
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.4;
          const d = r * (0.3 + (i % 3) * 0.17);
          c.beginPath();
          c.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.05, r * 0.085, a, 0, Math.PI * 2);
          c.fill();
        }
      }
    },
    {
      name: 'orange', radius: 38, score: 1,
      skin: '#ff9412', flesh: '#ffb340', rim: '#ffe2af', juice: '#ffa726',
      drawWhole(c, r) {
        c.fillStyle = this.skin;
        circle(c, 0, 0, r);
        c.fill();
        // pores
        c.fillStyle = 'rgba(200,100,0,0.5)';
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.85;
          circle(c, Math.cos(a) * d, Math.sin(a) * d, 1.2);
          c.fill();
        }
        // stem nub
        c.fillStyle = '#7cb342';
        circle(c, 0, -r * 0.92, r * 0.12);
        c.fill();
        glossy(c, r);
      },
      drawFace(c, r) {
        c.fillStyle = this.rim;
        circle(c, 0, 0, r);
        c.fill();
        c.fillStyle = this.flesh;
        circle(c, 0, 0, r * 0.85);
        c.fill();
        // segments
        c.strokeStyle = this.rim;
        c.lineWidth = r * 0.07;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
          c.stroke();
        }
        circle(c, 0, 0, r * 0.1);
        c.fillStyle = this.rim;
        c.fill();
      }
    },
    {
      name: 'apple', radius: 36, score: 1,
      skin: '#e53935', flesh: '#fff3d6', rim: '#e53935', juice: '#ef9a9a',
      drawWhole(c, r) {
        c.fillStyle = this.skin;
        circle(c, 0, 0, r);
        c.fill();
        // stem
        c.strokeStyle = '#5d4037';
        c.lineWidth = r * 0.12;
        c.beginPath();
        c.moveTo(0, -r * 0.85);
        c.quadraticCurveTo(r * 0.12, -r * 1.15, r * 0.25, -r * 1.2);
        c.stroke();
        // leaf
        c.fillStyle = '#66bb6a';
        c.beginPath();
        c.ellipse(r * 0.42, -r * 1.05, r * 0.28, r * 0.13, -0.5, 0, Math.PI * 2);
        c.fill();
        glossy(c, r);
      },
      drawFace(c, r) {
        c.fillStyle = this.rim;
        circle(c, 0, 0, r);
        c.fill();
        c.fillStyle = this.flesh;
        circle(c, 0, 0, r * 0.88);
        c.fill();
        // core + seeds
        c.fillStyle = '#efe0b8';
        c.beginPath();
        c.ellipse(0, 0, r * 0.3, r * 0.42, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#4e342e';
        c.beginPath();
        c.ellipse(-r * 0.1, 0, r * 0.06, r * 0.12, 0.3, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(r * 0.1, 0, r * 0.06, r * 0.12, -0.3, 0, Math.PI * 2);
        c.fill();
      }
    },
    {
      name: 'lemon', radius: 34, score: 1,
      skin: '#fdd835', flesh: '#fff59d', rim: '#fffde7', juice: '#fff176',
      drawWhole(c, r) {
        c.fillStyle = this.skin;
        c.beginPath();
        c.ellipse(0, 0, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#f9a825';
        circle(c, r * 1.0, 0, r * 0.13);
        c.fill();
        glossy(c, r * 0.9);
      },
      drawFace(c, r) {
        c.fillStyle = this.rim;
        circle(c, 0, 0, r * 0.95);
        c.fill();
        c.fillStyle = this.flesh;
        circle(c, 0, 0, r * 0.8);
        c.fill();
        c.strokeStyle = this.rim;
        c.lineWidth = r * 0.06;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
          c.stroke();
        }
      }
    },
    {
      name: 'kiwi', radius: 33, score: 1,
      skin: '#795548', flesh: '#8bc34a', rim: '#a1887f', juice: '#9ccc65',
      drawWhole(c, r) {
        c.fillStyle = this.skin;
        c.beginPath();
        c.ellipse(0, 0, r, r * 0.88, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(60,40,25,0.6)';
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.85;
          circle(c, Math.cos(a) * d, Math.sin(a) * d * 0.88, 1);
          c.fill();
        }
        glossy(c, r * 0.9);
      },
      drawFace(c, r) {
        c.fillStyle = this.rim;
        circle(c, 0, 0, r * 0.95);
        c.fill();
        c.fillStyle = this.flesh;
        circle(c, 0, 0, r * 0.85);
        c.fill();
        c.fillStyle = '#dcedc8';
        circle(c, 0, 0, r * 0.3);
        c.fill();
        // ring of seeds
        c.fillStyle = '#1b1b1b';
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          c.beginPath();
          c.ellipse(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.04, r * 0.08, a, 0, Math.PI * 2);
          c.fill();
        }
      }
    },
    {
      name: 'peach', radius: 38, score: 1,
      skin: '#ffab66', flesh: '#ffe0b2', rim: '#ff8a50', juice: '#ffcc80',
      drawWhole(c, r) {
        const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
        g.addColorStop(0, '#ffd180');
        g.addColorStop(1, '#ff7043');
        c.fillStyle = g;
        circle(c, 0, 0, r);
        c.fill();
        c.strokeStyle = 'rgba(200,80,30,0.5)';
        c.lineWidth = r * 0.06;
        c.beginPath();
        c.moveTo(0, -r * 0.95);
        c.quadraticCurveTo(r * 0.18, 0, 0, r * 0.95);
        c.stroke();
        c.fillStyle = '#66bb6a';
        c.beginPath();
        c.ellipse(r * 0.15, -r * 0.95, r * 0.25, r * 0.11, -0.4, 0, Math.PI * 2);
        c.fill();
        glossy(c, r);
      },
      drawFace(c, r) {
        c.fillStyle = this.rim;
        circle(c, 0, 0, r);
        c.fill();
        c.fillStyle = this.flesh;
        circle(c, 0, 0, r * 0.88);
        c.fill();
        c.fillStyle = '#8d6e63';
        c.beginPath();
        c.ellipse(0, 0, r * 0.22, r * 0.27, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#5d4037';
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(0, 0, r * 0.13, r * 0.18, 0.4, 0, Math.PI * 2);
        c.stroke();
      }
    }
  ];

  function circle(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
  }

  function glossy(c, r) {
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.ellipse(-r * 0.35, -r * 0.4, r * 0.32, r * 0.18, -0.6, 0, Math.PI * 2);
    c.fill();
  }

  // ---------- Entities ----------

  const GRAVITY = 1500; // px/s^2 (scaled below by screen height)

  function gravity() {
    return GRAVITY * (H / 800);
  }

  class Fruit {
    constructor(type, x, y, vx, vy) {
      this.type = type;
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.rot = Math.random() * Math.PI * 2;
      this.spin = (Math.random() - 0.5) * 6;
      this.r = type.radius * (0.9 + Math.random() * 0.2) * Math.min(1, W / 700 + 0.45);
      this.dead = false;
      this.isBomb = false;
    }
    update(dt) {
      this.vy += gravity() * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.spin * dt;
    }
    draw(c) {
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.rot);
      // shadow
      c.fillStyle = 'rgba(0,0,0,0.25)';
      circle(c, this.r * 0.12, this.r * 0.12, this.r);
      c.fill();
      this.type.drawWhole(c, this.r);
      c.restore();
    }
  }

  class Bomb extends Fruit {
    constructor(x, y, vx, vy) {
      super(FRUITS[0], x, y, vx, vy);
      this.r = 36 * Math.min(1, W / 700 + 0.45);
      this.isBomb = true;
      this.fuseT = 0;
    }
    update(dt) {
      super.update(dt);
      this.fuseT += dt;
      if (Math.random() < 0.3) {
        sparks.push(new Spark(
          this.x + Math.cos(this.rot - 1.2) * this.r * 1.25,
          this.y + Math.sin(this.rot - 1.2) * this.r * 1.25
        ));
      }
    }
    draw(c) {
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.rot);
      const r = this.r;
      // body
      const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#5a5a5a');
      g.addColorStop(1, '#111');
      c.fillStyle = g;
      circle(c, 0, 0, r);
      c.fill();
      // skull-ish warning glint
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.beginPath();
      c.ellipse(-r * 0.32, -r * 0.35, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2);
      c.fill();
      // cap + fuse
      c.fillStyle = '#333';
      c.save();
      c.rotate(-1.2);
      c.fillRect(r * 0.78, -r * 0.18, r * 0.35, r * 0.36);
      c.strokeStyle = '#caa472';
      c.lineWidth = r * 0.1;
      c.beginPath();
      c.moveTo(r * 1.1, 0);
      c.quadraticCurveTo(r * 1.35, -r * 0.25, r * 1.28, -r * 0.5);
      c.stroke();
      c.restore();
      c.restore();
    }
  }

  class Half {
    constructor(fruit, sliceAngle, side) {
      this.type = fruit.type;
      this.r = fruit.r;
      this.sliceAngle = sliceAngle;
      this.side = side; // +1 / -1
      const push = 140 + Math.random() * 120;
      const nx = Math.cos(sliceAngle + Math.PI / 2) * side;
      const ny = Math.sin(sliceAngle + Math.PI / 2) * side;
      this.x = fruit.x + nx * 6;
      this.y = fruit.y + ny * 6;
      this.vx = fruit.vx * 0.6 + nx * push;
      this.vy = fruit.vy * 0.6 + ny * push - 60;
      this.rot = sliceAngle;
      this.spin = side * (1.5 + Math.random() * 3);
      this.dead = false;
    }
    update(dt) {
      this.vy += gravity() * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.spin * dt;
      if (this.y - this.r > H + 60) this.dead = true;
    }
    draw(c) {
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.rot);
      // clip to the half-plane on our side, then draw the cut face
      c.beginPath();
      if (this.side > 0) c.rect(-this.r * 1.4, 0, this.r * 2.8, this.r * 1.5);
      else c.rect(-this.r * 1.4, -this.r * 1.5, this.r * 2.8, this.r * 1.5);
      c.clip();
      this.type.drawFace(c, this.r);
      c.restore();
    }
  }

  class JuiceDrop {
    constructor(x, y, color) {
      this.x = x; this.y = y;
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 380;
      this.vx = Math.cos(a) * s;
      this.vy = Math.sin(a) * s - 120;
      this.r = 2 + Math.random() * 5;
      this.color = color;
      this.life = 0.5 + Math.random() * 0.5;
      this.t = 0;
      this.dead = false;
    }
    update(dt) {
      this.t += dt;
      this.vy += gravity() * 0.8 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.t > this.life || this.y > H + 20) this.dead = true;
    }
    draw(c) {
      c.globalAlpha = Math.max(0, 1 - this.t / this.life);
      c.fillStyle = this.color;
      circle(c, this.x, this.y, this.r);
      c.fill();
      c.globalAlpha = 1;
    }
  }

  class Splat {
    constructor(x, y, color) {
      this.x = x; this.y = y;
      this.color = color;
      this.t = 0;
      this.life = 4;
      this.dead = false;
      this.blobs = [];
      const n = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 38;
        this.blobs.push({
          x: Math.cos(a) * d, y: Math.sin(a) * d,
          r: 5 + Math.random() * 16
        });
      }
    }
    update(dt) {
      this.t += dt;
      if (this.t > this.life) this.dead = true;
    }
    draw(c) {
      const fade = this.t < this.life - 1 ? 0.55 : 0.55 * (this.life - this.t);
      c.globalAlpha = Math.max(0, fade);
      c.fillStyle = this.color;
      for (const blob of this.blobs) {
        circle(c, this.x + blob.x, this.y + blob.y, blob.r);
        c.fill();
      }
      c.globalAlpha = 1;
    }
  }

  class Spark {
    constructor(x, y) {
      this.x = x; this.y = y;
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 90;
      this.vx = Math.cos(a) * s;
      this.vy = Math.sin(a) * s;
      this.life = 0.15 + Math.random() * 0.25;
      this.t = 0;
      this.dead = false;
    }
    update(dt) {
      this.t += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.t > this.life) this.dead = true;
    }
    draw(c) {
      const k = 1 - this.t / this.life;
      c.globalAlpha = k;
      c.fillStyle = Math.random() < 0.5 ? '#ffd740' : '#ff6e40';
      circle(c, this.x, this.y, 1.5 + k * 2);
      c.fill();
      c.globalAlpha = 1;
    }
  }

  class ScorePopup {
    constructor(x, y, text, color) {
      this.x = x; this.y = y;
      this.text = text;
      this.color = color || '#fff59d';
      this.t = 0;
      this.life = 0.8;
      this.dead = false;
    }
    update(dt) {
      this.t += dt;
      this.y -= 60 * dt;
      if (this.t > this.life) this.dead = true;
    }
    draw(c) {
      c.globalAlpha = Math.max(0, 1 - this.t / this.life);
      c.font = 'bold 26px Trebuchet MS, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = this.color;
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.lineWidth = 4;
      c.strokeText(this.text, this.x, this.y);
      c.fillText(this.text, this.x, this.y);
      c.globalAlpha = 1;
    }
  }

  // ---------- Game state ----------

  const STATE = { MENU: 0, PLAYING: 1, OVER: 2 };
  let state = STATE.MENU;

  let fruits = [];
  let halves = [];
  let drops = [];
  let splats = [];
  let sparks = [];
  let popups = [];

  let score = 0;
  let best = parseInt(localStorage.getItem('fruit-ninja-best') || '0', 10);
  let lives = 3;
  let spawnTimer = 0;
  let elapsed = 0;
  let shakeT = 0;
  let flashT = 0;
  let endingT = -1; // countdown after bomb hit before game-over screen

  // swipe combo tracking
  let comboCount = 0;
  let comboTimer = 0;
  let comboX = 0, comboY = 0;

  // ---------- Blade (pointer trail) ----------

  const trail = []; // {x, y, t}
  let pointerDown = false;
  let lastPointer = null;

  function pointerPos(e) {
    if (e.touches && e.touches.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onDown(e) {
    initAudio();
    if (audio && audio.state === 'suspended') audio.resume();
    pointerDown = true;
    lastPointer = pointerPos(e);
    trail.length = 0;
    trail.push({ ...lastPointer, t: performance.now() });
  }

  function onMove(e) {
    if (!pointerDown) return;
    const p = pointerPos(e);
    const now = performance.now();
    if (lastPointer) {
      const dx = p.x - lastPointer.x, dy = p.y - lastPointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4 && state === STATE.PLAYING && endingT < 0) {
        checkSlice(lastPointer, p, dist);
      }
      if (dist > 30) playSwooshThrottled();
    }
    trail.push({ x: p.x, y: p.y, t: now });
    if (trail.length > 24) trail.shift();
    lastPointer = p;
    e.preventDefault();
  }

  function onUp() {
    pointerDown = false;
    lastPointer = null;
  }

  let lastSwooshAt = 0;
  function playSwooshThrottled() {
    const now = performance.now();
    if (now - lastSwooshAt > 140) {
      lastSwooshAt = now;
      playSwoosh();
    }
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: true });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);

  // ---------- Slicing ----------

  function segCircleDist(p1, p2, cx, cy) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(cx - p1.x, cy - p1.y);
    let t = ((cx - p1.x) * dx + (cy - p1.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(cx - (p1.x + t * dx), cy - (p1.y + t * dy));
  }

  function checkSlice(p1, p2, dist) {
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    for (const f of fruits) {
      if (f.dead) continue;
      if (segCircleDist(p1, p2, f.x, f.y) <= f.r) {
        f.dead = true;
        if (f.isBomb) {
          hitBomb(f);
          return;
        }
        sliceFruit(f, angle);
      }
    }
  }

  function sliceFruit(f, angle) {
    halves.push(new Half(f, angle, 1));
    halves.push(new Half(f, angle, -1));
    const juice = f.type.juice;
    for (let i = 0; i < 18; i++) drops.push(new JuiceDrop(f.x, f.y, juice));
    splats.push(new Splat(f.x, f.y, juice));
    playSplat();

    let points = f.type.score;
    let label = '+' + points;
    let color = '#fff59d';
    // critical hit
    if (Math.random() < 0.08) {
      points += 5;
      label = 'CRITICAL +' + points;
      color = '#80d8ff';
    }
    score += points;
    popups.push(new ScorePopup(f.x, f.y - f.r, label, color));
    updateHUD();

    // combo window: fruits sliced within 350ms of each other
    comboCount++;
    comboTimer = 0.35;
    comboX = f.x; comboY = f.y;
  }

  function resolveCombo() {
    if (comboCount >= 3) {
      const bonus = comboCount;
      score += bonus;
      showComboPopup(comboCount + ' FRUIT COMBO! +' + bonus);
      playCombo(comboCount);
      updateHUD();
    }
    comboCount = 0;
  }

  function hitBomb(bomb) {
    playExplosion();
    flashT = 0.25;
    shakeT = 0.6;
    endingT = 1.1;
    for (let i = 0; i < 40; i++) sparks.push(new Spark(bomb.x, bomb.y));
    for (let i = 0; i < 24; i++) drops.push(new JuiceDrop(bomb.x, bomb.y, '#616161'));
    // blast nearby fruit away unsliced
    for (const f of fruits) {
      if (f.dead) continue;
      const d = Math.hypot(f.x - bomb.x, f.y - bomb.y) || 1;
      f.vx += ((f.x - bomb.x) / d) * 600;
      f.vy += ((f.y - bomb.y) / d) * 600 - 200;
    }
  }

  // ---------- Spawning ----------

  function launchOne(isBomb) {
    const margin = W * 0.15;
    const x = margin + Math.random() * (W - margin * 2);
    const y = H + 60;
    // aim roughly toward the middle, peak between 15% and 45% of height
    const targetX = W * 0.5 + (Math.random() - 0.5) * W * 0.5;
    const peakY = H * (0.15 + Math.random() * 0.3);
    const g = gravity();
    const vy = -Math.sqrt(2 * g * (y - peakY));
    const flightT = -vy / g; // time to apex
    const vx = (targetX - x) / (flightT * 2);

    if (isBomb) {
      fruits.push(new Bomb(x, y, vx, vy));
      playBombFuse();
    } else {
      const type = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      fruits.push(new Fruit(type, x, y, vx, vy));
    }
    playThrow();
  }

  function spawnWave() {
    // difficulty ramps with elapsed time
    const diff = Math.min(1, elapsed / 90);
    const count = 1 + Math.floor(Math.random() * (2 + diff * 3));
    const bombChance = 0.12 + diff * 0.15;
    let delay = 0;
    for (let i = 0; i < count; i++) {
      const isBomb = Math.random() < bombChance;
      setTimeout(() => {
        if (state === STATE.PLAYING && endingT < 0) launchOne(isBomb);
      }, delay);
      delay += 120 + Math.random() * 200;
    }
  }

  function spawnInterval() {
    const diff = Math.min(1, elapsed / 90);
    return 2.4 - diff * 1.3 + Math.random() * 0.5;
  }

  // ---------- HUD / screens ----------

  const $ = (id) => document.getElementById(id);
  const hud = $('hud');
  const scoreEl = $('score');
  const bestEl = $('best');
  const menuScreen = $('menu-screen');
  const overScreen = $('gameover-screen');
  const comboEl = $('combo-popup');

  function updateHUD() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score);
    document.querySelectorAll('.life').forEach((el, i) => {
      el.classList.toggle('lost', i < 3 - lives);
    });
  }

  let comboHideTimeout = null;
  function showComboPopup(text) {
    comboEl.textContent = text;
    comboEl.classList.remove('hidden');
    // restart CSS animation
    comboEl.style.animation = 'none';
    void comboEl.offsetWidth;
    comboEl.style.animation = '';
    clearTimeout(comboHideTimeout);
    comboHideTimeout = setTimeout(() => comboEl.classList.add('hidden'), 900);
  }

  function startGame() {
    initAudio();
    if (audio && audio.state === 'suspended') audio.resume();
    fruits = []; halves = []; drops = []; splats = []; sparks = []; popups = [];
    score = 0;
    lives = 3;
    elapsed = 0;
    spawnTimer = 0.8;
    comboCount = 0;
    endingT = -1;
    flashT = 0;
    shakeT = 0;
    state = STATE.PLAYING;
    menuScreen.classList.add('hidden');
    overScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    updateHUD();
  }

  function gameOver() {
    state = STATE.OVER;
    playGameOver();
    const isBest = score > best;
    if (isBest) {
      best = score;
      localStorage.setItem('fruit-ninja-best', String(best));
    }
    $('final-score').textContent = 'Score: ' + score;
    $('new-best').classList.toggle('hidden', !isBest);
    hud.classList.add('hidden');
    overScreen.classList.remove('hidden');
  }

  $('play-btn').addEventListener('click', startGame);
  $('replay-btn').addEventListener('click', startGame);

  // ---------- Update & render ----------

  function update(dt) {
    if (state === STATE.PLAYING) {
      if (endingT >= 0) {
        endingT -= dt;
        if (endingT <= 0) {
          gameOver();
        }
      } else {
        elapsed += dt;
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnWave();
          spawnTimer = spawnInterval();
        }
        if (comboCount > 0) {
          comboTimer -= dt;
          if (comboTimer <= 0) resolveCombo();
        }
      }

      for (const f of fruits) {
        f.update(dt);
        // missed fruit fell off-screen
        if (!f.dead && f.vy > 0 && f.y - f.r > H + 70) {
          f.dead = true;
          if (!f.isBomb && endingT < 0) {
            lives--;
            updateHUD();
            if (lives <= 0) {
              endingT = 0.6;
            }
          }
        }
      }
      fruits = fruits.filter(f => !f.dead);
    }

    for (const h of halves) h.update(dt);
    for (const d of drops) d.update(dt);
    for (const s of splats) s.update(dt);
    for (const s of sparks) s.update(dt);
    for (const p of popups) p.update(dt);
    halves = halves.filter(h => !h.dead);
    drops = drops.filter(d => !d.dead);
    splats = splats.filter(s => !s.dead);
    sparks = sparks.filter(s => !s.dead);
    popups = popups.filter(p => !p.dead);

    if (shakeT > 0) shakeT -= dt;
    if (flashT > 0) flashT -= dt;

    // prune stale trail points
    const now = performance.now();
    while (trail.length && now - trail[0].t > 120) trail.shift();
  }

  function drawBlade(c) {
    if (trail.length < 2) return;
    const now = performance.now();
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        const age = (now - b.t) / 120;
        const k = Math.max(0, 1 - age);
        if (k <= 0) continue;
        const width = (pass === 0 ? 14 : 5) * k * (i / trail.length);
        c.strokeStyle = pass === 0
          ? `rgba(180, 220, 255, ${0.35 * k})`
          : `rgba(255, 255, 255, ${0.9 * k})`;
        c.lineWidth = Math.max(0.5, width);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
    }
    c.restore();
  }

  function render() {
    ctx.save();
    if (shakeT > 0) {
      const s = shakeT * 18;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);
    else {
      ctx.fillStyle = '#6f4518';
      ctx.fillRect(0, 0, W, H);
    }

    for (const s of splats) s.draw(ctx);
    for (const h of halves) h.draw(ctx);
    for (const f of fruits) f.draw(ctx);
    for (const d of drops) d.draw(ctx);
    for (const s of sparks) s.draw(ctx);
    for (const p of popups) p.draw(ctx);
    drawBlade(ctx);

    ctx.restore();

    if (flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashT * 3.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // demo fruit gently lobbed on the menu screen
  let menuSpawnT = 0;
  function updateMenu(dt) {
    menuSpawnT -= dt;
    if (menuSpawnT <= 0) {
      const type = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      const x = W * 0.2 + Math.random() * W * 0.6;
      const g = gravity();
      const vy = -Math.sqrt(2 * g * (H * 0.7));
      fruits.push(new Fruit(type, x, H + 60, (Math.random() - 0.5) * 100, vy));
      menuSpawnT = 1.6 + Math.random() * 1.2;
    }
    for (const f of fruits) f.update(dt);
    fruits = fruits.filter(f => f.y - f.r < H + 100);
  }

  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.033, (t - lastT) / 1000);
    lastT = t;
    if (state === STATE.PLAYING) {
      update(dt);
    } else {
      updateMenu(dt);
      // keep effects (halves/drops from a finished game) settling
      for (const h of halves) h.update(dt);
      for (const d of drops) d.update(dt);
      halves = halves.filter(h => !h.dead);
      drops = drops.filter(d => !d.dead);
      const now = performance.now();
      while (trail.length && now - trail[0].t > 120) trail.shift();
    }
    render();
    requestAnimationFrame(loop);
  }

  resize();
  updateHUD();
  requestAnimationFrame(loop);
})();
