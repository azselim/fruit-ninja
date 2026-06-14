/* ============================================================
   Fruit Ninja — Three.js
   Fruit meshes sliced into halves, authentic sounds.
   ============================================================ */

import * as THREE from './lib/three.module.js';

// Resolve assets relative to this module (so /sushi/ and / both work).
const ASSET_BASE = new URL('.', import.meta.url);

// ---------- Theme ----------
// The engine is shared; a theme swaps the item set, the hazard, the logo,
// labels and a few cosmetics. Default is the classic fruit game.
const THEME_KEY = (window.FN_THEME === 'sushi') ? 'sushi' : 'fruit';
const THEMES = {
  fruit: {
    comboWord: 'FRUIT', bestKey: 'fruit-ninja-best',
    hazard: 'bomb', hazardFuse: true, startMessage: null,
    logoWords: ['Fruit', 'Ninja'],
    logoColors: ['#7b2fb0', '#e0271f', '#f08200', '#f5b50a', '#3f9b2e']
  },
  sushi: {
    comboWord: 'SUSHI', bestKey: 'sushi-ninja-best',
    hazard: 'peanutbutter', hazardFuse: false, startMessage: 'hi bhenchod',
    logoWords: ['Sushi', 'Ninja'],
    logoColors: ['#e8612e', '#f0a818', '#2f6f3a', '#e23b53', '#1f1f1f']
  }
};
const THEME = THEMES[THEME_KEY];

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const glCanvas = $('webgl');
const overlay = $('overlay');
const octx = overlay.getContext('2d');
const hud = $('hud');
const scoreEl = $('score');
const bestEl = $('best');
const banner = $('banner');
const menuScreen = $('menu-screen');
const overScreen = $('gameover-screen');
const loadingEl = $('loading');

// Mobile / low-power detection — drives the quality trade-offs below.
const IS_MOBILE = matchMedia('(pointer: coarse)').matches ||
  /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent);
const MAX_DPR = IS_MOBILE ? 1.5 : 2;
let qualityScale = 1; // lowered at runtime if the device can't keep up
const JUICE_N = IS_MOBILE ? 9 : 16;     // juice droplets per slice
const MAX_PIECES = IS_MOBILE ? 90 : 200; // cap live halves/droplets

let W = window.innerWidth, H = window.innerHeight;
function effectiveDPR() { return Math.min(devicePixelRatio || 1, MAX_DPR) * qualityScale; }
let DPR = effectiveDPR();

// ---------- Three.js core ----------
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: !IS_MOBILE, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 200);
camera.position.set(0, 0, 30);
camera.lookAt(0, 0, 0);

// World bounds at z = 0 plane (visible play area)
let viewH = 0, viewW = 0;
function computeView() {
  const d = camera.position.z;
  viewH = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * d;
  viewW = viewH * camera.aspect;
}

// ---------- Lighting ----------
// On mobile, fewer lights = far cheaper per-fragment shading. Keep ambient + key,
// and fold the warm fill into a slightly brighter ambient.
scene.add(new THREE.AmbientLight(0xffffff, IS_MOBILE ? 0.72 : 0.55));
const key = new THREE.DirectionalLight(0xfff2dd, IS_MOBILE ? 1.25 : 1.15);
key.position.set(-6, 12, 14);
scene.add(key);
if (!IS_MOBILE) {
  const warm = new THREE.PointLight(0xffaa55, 0.5, 120);
  warm.position.set(10, -6, 18);
  scene.add(warm);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.35);
  rim.position.set(8, -10, -6);
  scene.add(rim);
}

// ---------- Texture helpers (procedural canvas textures) ----------
function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function texFromCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- Background (original first-commit wooden board) ----------
function drawBoard(b, w, h) {
  const base = b.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#8a5a2b');
  base.addColorStop(0.5, '#6f4518');
  base.addColorStop(1, '#52300e');
  b.fillStyle = base;
  b.fillRect(0, 0, w, h);

  const plankH = 90;
  for (let y = 0; y < h; y += plankH) {
    b.fillStyle = 'rgba(0,0,0,0.18)';
    b.fillRect(0, y, w, 3);
    b.strokeStyle = 'rgba(60,30,5,0.25)';
    b.lineWidth = 1.5;
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const gy = y + 10 + Math.random() * (plankH - 20);
      b.beginPath();
      b.moveTo(0, gy);
      for (let x = 0; x <= w; x += 60) b.lineTo(x, gy + Math.sin(x * 0.02 + gy) * 4);
      b.stroke();
    }
    if (Math.random() < 0.7) {
      const kx = Math.random() * w, ky = y + plankH * 0.5;
      b.strokeStyle = 'rgba(40,20,2,0.35)';
      for (let r = 3; r < 14; r += 3.5) {
        b.beginPath();
        b.ellipse(kx, ky, r * 1.4, r, 0.2, 0, Math.PI * 2);
        b.stroke();
      }
    }
  }

  const v = b.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  b.fillStyle = v;
  b.fillRect(0, 0, w, h);
}

const boardCanvas = document.createElement('canvas');
const bgTex = texFromCanvas(boardCanvas);
const bgMat = new THREE.MeshBasicMaterial({ map: bgTex }); // unlit: flat painted board like the original
const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
bgPlane.position.z = -18;
scene.add(bgPlane);

function layoutBackground() {
  // size the plane to fully cover the frustum at its depth
  const d = camera.position.z - bgPlane.position.z;
  const h = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * d;
  const w = h * camera.aspect;
  bgPlane.scale.set(w * 1.04, h * 1.04, 1);
  // redraw the board at the viewport resolution so planks & vignette match the screen aspect
  const pw = Math.min(1920, Math.max(640, Math.round(W * DPR)));
  const ph = Math.min(1920, Math.max(640, Math.round(H * DPR)));
  if (boardCanvas.width !== pw || boardCanvas.height !== ph) {
    boardCanvas.width = pw; boardCanvas.height = ph;
    drawBoard(boardCanvas.getContext('2d'), pw, ph);
    bgTex.needsUpdate = true;
  }
}

// ---------- Fruit definitions ----------
// Each fruit: name, baseR, scale (ellipsoid), rind+flesh texture builders, juice color, impact sound, score
const FRUITS = [
  {
    name: 'watermelon', r: 2.7, scale: [1, 0.92, 1], score: 1, juice: '#ff3b5e', sound: 'Impact-Watermelon',
    rind(b, s) {
      b.fillStyle = '#2f9e3c'; b.fillRect(0, 0, s, s);
      b.strokeStyle = '#176b1f'; b.lineWidth = s * 0.05;
      for (let i = 0; i < 10; i++) {
        const x = (i / 10) * s;
        b.beginPath();
        b.moveTo(x, 0);
        for (let y = 0; y <= s; y += 16) b.lineTo(x + Math.sin(y * 0.04 + i) * 10, y);
        b.stroke();
      }
    },
    flesh(b, s) {
      const c = s / 2;
      b.fillStyle = '#bff0b0'; b.beginPath(); b.arc(c, c, c, 0, 7); b.fill();
      b.fillStyle = '#fff4f0'; b.beginPath(); b.arc(c, c, c * 0.92, 0, 7); b.fill();
      b.fillStyle = '#ff3b5e'; b.beginPath(); b.arc(c, c, c * 0.84, 0, 7); b.fill();
      b.fillStyle = '#2b0d00';
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * 7, d = c * (0.25 + Math.random() * 0.5);
        b.beginPath(); b.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, c * 0.025, c * 0.045, a, 0, 7); b.fill();
      }
    }
  },
  {
    name: 'orange', r: 1.7, scale: [1, 1, 1], score: 1, juice: '#ffa726', sound: 'Impact-Orange',
    rind(b, s) {
      b.fillStyle = '#ff9412'; b.fillRect(0, 0, s, s);
      b.fillStyle = 'rgba(200,100,0,0.45)';
      for (let i = 0; i < 800; i++) b.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
    },
    flesh(b, s) {
      const c = s / 2;
      b.fillStyle = '#ffe2af'; b.beginPath(); b.arc(c, c, c, 0, 7); b.fill();
      b.fillStyle = '#ffb340'; b.beginPath(); b.arc(c, c, c * 0.86, 0, 7); b.fill();
      b.strokeStyle = '#ffe2af'; b.lineWidth = s * 0.02;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 7;
        b.beginPath(); b.moveTo(c, c); b.lineTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84); b.stroke();
      }
    }
  },
  {
    name: 'apple', r: 1.8, scale: [0.95, 1, 0.95], score: 1, juice: '#ef9a9a', sound: 'Impact-Apple',
    rind(b, s) {
      const g = b.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, '#ff4133'); g.addColorStop(1, '#b8161a');
      b.fillStyle = g; b.fillRect(0, 0, s, s);
      b.strokeStyle = 'rgba(255,210,180,0.25)'; b.lineWidth = 2;
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * s, y = Math.random() * s;
        b.beginPath(); b.moveTo(x, y); b.lineTo(x, y + 12 + Math.random() * 18); b.stroke();
      }
    },
    flesh(b, s) {
      const c = s / 2;
      b.fillStyle = '#fff3d6'; b.beginPath(); b.arc(c, c, c, 0, 7); b.fill();
      b.fillStyle = '#efe0b8'; b.beginPath(); b.ellipse(c, c, c * 0.28, c * 0.4, 0, 0, 7); b.fill();
      b.fillStyle = '#4e342e';
      b.beginPath(); b.ellipse(c - c * 0.1, c, c * 0.05, c * 0.11, 0.3, 0, 7); b.fill();
      b.beginPath(); b.ellipse(c + c * 0.1, c, c * 0.05, c * 0.11, -0.3, 0, 7); b.fill();
    }
  },
  {
    name: 'plum', r: 1.6, scale: [0.92, 1, 0.92], score: 1, juice: '#ad4bd6', sound: 'Impact-Plum',
    rind(b, s) {
      const g = b.createRadialGradient(s * 0.35, s * 0.35, s * 0.1, s * 0.5, s * 0.5, s * 0.7);
      g.addColorStop(0, '#a13fd0'); g.addColorStop(1, '#5a1670');
      b.fillStyle = g; b.fillRect(0, 0, s, s);
    },
    flesh(b, s) {
      const c = s / 2;
      b.fillStyle = '#e9b6f0'; b.beginPath(); b.arc(c, c, c, 0, 7); b.fill();
      b.fillStyle = '#ffd27a'; b.beginPath(); b.arc(c, c, c * 0.82, 0, 7); b.fill();
      b.fillStyle = '#9c5a2a'; b.beginPath(); b.ellipse(c, c, c * 0.16, c * 0.22, 0, 0, 7); b.fill();
    }
  },
  {
    name: 'kiwi', r: 1.5, scale: [1.05, 0.8, 1.05], score: 1, juice: '#9ccc65', sound: 'Impact-kiwifruit',
    rind(b, s) {
      b.fillStyle = '#7c5a3a'; b.fillRect(0, 0, s, s);
      b.fillStyle = 'rgba(50,34,18,0.5)';
      for (let i = 0; i < 1400; i++) b.fillRect(Math.random() * s, Math.random() * s, 1, 2);
    },
    flesh(b, s) {
      const c = s / 2;
      b.fillStyle = '#cddc39'; b.beginPath(); b.arc(c, c, c, 0, 7); b.fill();
      b.fillStyle = '#aed581'; b.beginPath(); b.arc(c, c, c * 0.86, 0, 7); b.fill();
      b.fillStyle = '#f1f8e9'; b.beginPath(); b.arc(c, c, c * 0.26, 0, 7); b.fill();
      b.fillStyle = '#1b1b1b';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 7;
        b.beginPath(); b.ellipse(c + Math.cos(a) * c * 0.45, c + Math.sin(a) * c * 0.45, c * 0.03, c * 0.05, a, 0, 7); b.fill();
      }
    }
  },
  {
    name: 'coconut', r: 1.9, scale: [1, 1, 1], score: 1, juice: '#f5f5f0', sound: 'Impact-Coconut',
    rind(b, s) {
      b.fillStyle = '#5d4030'; b.fillRect(0, 0, s, s);
      b.strokeStyle = 'rgba(30,18,8,0.6)'; b.lineWidth = 2;
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * s, y = Math.random() * s;
        b.beginPath(); b.moveTo(x, y); b.lineTo(x + (Math.random() - .5) * 20, y + 10 + Math.random() * 20); b.stroke();
      }
    },
    flesh(b, s) {
      const c = s / 2;
      b.fillStyle = '#6b4a32'; b.beginPath(); b.arc(c, c, c, 0, 7); b.fill();
      b.fillStyle = '#f7f4ee'; b.beginPath(); b.arc(c, c, c * 0.82, 0, 7); b.fill();
      b.fillStyle = '#e6ddcf'; b.beginPath(); b.arc(c, c, c * 0.4, 0, 7); b.fill();
    }
  },
  {
    name: 'strawberry', r: 1.6, scale: [1, 1.15, 1], score: 1, juice: '#ff5277', sound: 'Impact-Strawberry', berry: true,
    rind(b, s) {
      b.fillStyle = '#e23b53'; b.fillRect(0, 0, s, s);
      b.fillStyle = '#ffe9a8';
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * s, y = Math.random() * s;
        b.beginPath(); b.ellipse(x, y, 2.5, 4, Math.random(), 0, 7); b.fill();
      }
    },
    flesh(b, s) {
      const c = s / 2;
      b.fillStyle = '#ff8fa3'; b.beginPath(); b.arc(c, c, c, 0, 7); b.fill();
      b.fillStyle = '#ffd6dd'; b.beginPath(); b.arc(c, c, c * 0.7, 0, 7); b.fill();
      b.strokeStyle = '#ff5277'; b.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 7;
        b.beginPath(); b.moveTo(c, c); b.lineTo(c + Math.cos(a) * c * 0.85, c + Math.sin(a) * c * 0.85); b.stroke();
      }
    }
  },
  {
    name: 'pineapple', r: 2.0, scale: [0.85, 1.25, 0.85], score: 1, juice: '#ffd54a', sound: 'Impact-Pineapple', crown: true,
    rind(b, s) {
      b.fillStyle = '#caa11e'; b.fillRect(0, 0, s, s);
      b.strokeStyle = '#8a6a10'; b.lineWidth = s * 0.03;
      for (let i = -8; i < 16; i++) {
        b.beginPath(); b.moveTo(0, i * 24); b.lineTo(s, i * 24 + s * 0.5); b.stroke();
        b.beginPath(); b.moveTo(0, i * 24); b.lineTo(s, i * 24 - s * 0.5); b.stroke();
      }
      b.fillStyle = '#8a6a10';
      for (let i = 0; i < 40; i++) b.fillRect(Math.random() * s, Math.random() * s, 4, 4);
    },
    flesh(b, s) {
      const c = s / 2;
      b.fillStyle = '#fff0b0'; b.beginPath(); b.arc(c, c, c, 0, 7); b.fill();
      b.fillStyle = '#ffe066'; b.beginPath(); b.arc(c, c, c * 0.84, 0, 7); b.fill();
      b.fillStyle = '#f5c518'; b.beginPath(); b.arc(c, c, c * 0.3, 0, 7); b.fill();
    }
  }
];

// ---------- Sushi theme items ----------
// Shared exterior/section painters
function noriBg(b, s) {
  b.fillStyle = '#16271c'; b.fillRect(0, 0, s, s);
  b.fillStyle = 'rgba(46,78,56,0.45)';
  for (let i = 0; i < 220; i++) b.fillRect(Math.random() * s, Math.random() * s, 2, 1);
  b.fillStyle = 'rgba(0,0,0,0.28)';
  for (let i = 0; i < 7; i++) b.fillRect(i * s / 7, 0, 1.5, s);
}
function riceBg(b, s, sesame) {
  b.fillStyle = '#f8f4ec'; b.fillRect(0, 0, s, s);
  b.fillStyle = 'rgba(223,215,198,0.85)';
  for (let i = 0; i < 260; i++) {
    b.save(); b.translate(Math.random() * s, Math.random() * s); b.rotate(Math.random() * 7);
    b.fillRect(-3, -1.3, 6, 2.6); b.restore();
  }
  if (sesame) for (let i = 0; i < 46; i++) {
    b.fillStyle = Math.random() < 0.5 ? '#fffaf0' : '#3a2a16';
    b.beginPath(); b.ellipse(Math.random() * s, Math.random() * s, 2, 3.2, Math.random(), 0, 7); b.fill();
  }
}
function riceGrains(b, s, rr) {
  const c = s / 2;
  b.fillStyle = 'rgba(222,214,197,0.9)';
  for (let i = 0; i < 110; i++) {
    const a = Math.random() * 7, d = Math.random() * c * rr;
    b.save(); b.translate(c + Math.cos(a) * d, c + Math.sin(a) * d); b.rotate(Math.random() * 7);
    b.fillRect(-2.5, -1, 5, 2); b.restore();
  }
}
function rings(b, s, layers) {
  const c = s / 2;
  for (const L of layers) { b.fillStyle = L.c; b.beginPath(); b.arc(c, c, c * L.r, 0, 7); b.fill(); }
}

const SUSHI = [
  { // tuna maki roll
    name: 'tuna-maki', r: 1.7, scale: [1, 0.95, 1], score: 1, juice: '#c0392b', sound: 'Impact-Watermelon', cyl: true, endOn: true,
    rind: noriBg,
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#16271c' }, { r: 0.9, c: '#f8f4ec' }]); riceGrains(b, s, 0.9); rings(b, s, [{ r: 0.36, c: '#c0392b' }, { r: 0.16, c: '#e0584a' }]); }
  },
  { // cucumber maki (kappa)
    name: 'cucumber-maki', r: 1.6, scale: [1, 0.95, 1], score: 1, juice: '#7cc36a', sound: 'Impact-kiwifruit', cyl: true, endOn: true,
    rind: noriBg,
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#16271c' }, { r: 0.9, c: '#f8f4ec' }]); riceGrains(b, s, 0.9); rings(b, s, [{ r: 0.34, c: '#3f8f44' }, { r: 0.26, c: '#9ed98a' }, { r: 0.12, c: '#eafbe3' }]); }
  },
  { // avocado maki
    name: 'avocado-maki', r: 1.6, scale: [1, 0.95, 1], score: 1, juice: '#9cc06a', sound: 'Impact-Plum', cyl: true, endOn: true,
    rind: noriBg,
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#16271c' }, { r: 0.9, c: '#f8f4ec' }]); riceGrains(b, s, 0.9); rings(b, s, [{ r: 0.36, c: '#8fb85a' }, { r: 0.18, c: '#cfe39a' }]); }
  },
  { // california roll (rice outside, sesame)
    name: 'california', r: 1.75, scale: [1.05, 0.98, 1.05], score: 1, juice: '#f0894c', sound: 'Impact-Orange', cyl: true, endOn: true,
    rind(b, s) { riceBg(b, s, true); },
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#f1ead8' }]); riceGrains(b, s, 1); rings(b, s, [{ r: 0.62, c: '#1a2c20' }, { r: 0.56, c: '#f8f4ec' }, { r: 0.4, c: '#f0894c' }, { r: 0.22, c: '#9cc06a' }]); }
  },
  { // ikura gunkan (nori battleship + roe)
    name: 'ikura', r: 1.6, scale: [1, 1.05, 1], score: 1, juice: '#ff7a18', sound: 'Impact-Strawberry', cyl: true, top: 'roe',
    rind: noriBg,
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#16271c' }, { r: 0.82, c: '#f8f4ec' }]); riceGrains(b, s, 0.82); }
  },
  { // salmon nigiri
    name: 'salmon-nigiri', r: 1.85, scale: [1.5, 0.72, 1.0], score: 1, juice: '#ff8a50', sound: 'Impact-Apple', top: 'salmon',
    rind(b, s) { riceBg(b, s, false); },
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#f8f4ec' }]); riceGrains(b, s, 0.95); rings(b, s, [{ r: 0.16, c: '#ffb38a' }]); }
  },
  { // tamago nigiri (egg + nori belt)
    name: 'tamago-nigiri', r: 1.85, scale: [1.5, 0.72, 1.0], score: 1, juice: '#ffd86b', sound: 'Impact-Pineapple', top: 'tamago',
    rind(b, s) { riceBg(b, s, false); },
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#f8f4ec' }]); riceGrains(b, s, 0.95); }
  },
  { // ebi (shrimp) nigiri
    name: 'ebi-nigiri', r: 1.85, scale: [1.5, 0.72, 1.0], score: 1, juice: '#ff9aa6', sound: 'Impact-Coconut', top: 'ebi',
    rind(b, s) { riceBg(b, s, false); },
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#f8f4ec' }]); riceGrains(b, s, 0.95); rings(b, s, [{ r: 0.14, c: '#ffd7c0' }]); }
  },
  { // wasabi — rare bonus, big points
    name: 'wasabi', r: 1.15, scale: [1, 0.82, 1], score: 5, weight: 0.28, bonus: true, juice: '#7fae2e', sound: 'Impact-kiwifruit',
    rind(b, s) {
      b.fillStyle = '#9ec93f'; b.fillRect(0, 0, s, s);
      b.fillStyle = 'rgba(110,150,40,0.5)';
      for (let i = 0; i < 60; i++) b.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    },
    flesh(b, s) { rings(b, s, [{ r: 1, c: '#b7df5a' }, { r: 0.7, c: '#9ec93f' }, { r: 0.3, c: '#88b531' }]); }
  }
];

const ITEMS = THEME_KEY === 'sushi' ? SUSHI : FRUITS;

// shared geometries
const UNIT_SPHERE = new THREE.SphereGeometry(1, 36, 26);
const TOP_DOME = new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2);
const BOT_DOME = new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const CAP = new THREE.CircleGeometry(1, 36);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 30); // unit roll (axis Y), groups: side/top/bottom

// End-on maki roll: cylinder turned so the circular flesh faces the camera and
// the nori wraps the thin rim. Slicing it yields two half-moons (below), not balls.
const MAKI_CYL = new THREE.CylinderGeometry(1, 1, 1, 30).rotateX(Math.PI / 2); // axis -> Z
// Half-moon: solid hump on +Y, flat cut face on the y=0 plane, caps face ±Z.
const MAKI_HALF = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI)
  .rotateX(-Math.PI / 2).rotateZ(Math.PI / 2);
// Flat rectangular cut face that closes the open diameter of the half-moon (normal -Y).
const MAKI_HALF_CAP = new THREE.PlaneGeometry(2, 1).rotateX(Math.PI / 2);
const MAKI_THICK = 0.62; // roll thickness along the view axis (Z), in unit-radius terms

// build & cache materials per item (fruit or sushi)
for (const f of ITEMS) {
  const rc = makeCanvas(256); f.rind(rc.getContext('2d'), 256);
  const fc = makeCanvas(256); f.flesh(fc.getContext('2d'), 256);
  f.rindTex = texFromCanvas(rc);
  f.fleshTex = texFromCanvas(fc);
  f.rindMat = new THREE.MeshPhongMaterial({ map: f.rindTex, shininess: 28, specular: 0x444444 });
  f.fleshMat = new THREE.MeshPhongMaterial({ map: f.fleshTex, shininess: 16, specular: 0x222222 });
}

// bomb material
const bombMat = new THREE.MeshPhongMaterial({ color: 0x161616, shininess: 90, specular: 0x888888 });
const capMat = new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 60 });

// ---- Leafy tops (pineapple crown, strawberry calyx) ----
// Each leafy top is baked ONCE into a single merged geometry with vertex colors,
// so every fruit/half reuses one geometry + one material = a single draw call,
// and slicing a pineapple allocates nothing.
const CROWN_GREENS = [0x2f7a37, 0x3c9a44, 0x4eb155, 0x2a6b30, 0x57bf5e];
const leafGeo = new THREE.ConeGeometry(0.17, 1, 4).toNonIndexed(); // unit-height blade
const leafMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 16, flatShading: true });

// Bake many transformed copies of baseGeo into one vertex-colored geometry (1 draw call).
// spec: { color, pos:[x,y,z], scale:[sx,sy,sz], rot:[rx,ry,rz] }
function bakeMerged(baseGeo, specs) {
  const positions = [], normals = [], colors = [];
  const m = new THREE.Matrix4(), nmat = new THREE.Matrix3();
  const q = new THREE.Quaternion(), eul = new THREE.Euler();
  const v = new THREE.Vector3(), n = new THREE.Vector3(), col = new THREE.Color();
  const posAttr = baseGeo.attributes.position, norAttr = baseGeo.attributes.normal;
  for (const s of specs) {
    const r = s.rot || [0, 0, 0], sc = s.scale || [1, 1, 1];
    eul.set(r[0], r[1], r[2], 'XYZ');
    q.setFromEuler(eul);
    m.compose(new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]), q, new THREE.Vector3(sc[0], sc[1], sc[2]));
    nmat.getNormalMatrix(m);
    col.set(s.color);
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(m);
      n.fromBufferAttribute(norAttr, i).applyMatrix3(nmat).normalize();
      positions.push(v.x, v.y, v.z);
      normals.push(n.x, n.y, n.z);
      colors.push(col.r, col.g, col.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

function crownSpecs() {
  const specs = [];
  const ringDefs = [
    { count: 7, r: 0.46, len: 0.85, tilt: 1.05 },
    { count: 6, r: 0.30, len: 1.20, tilt: 0.7 },
    { count: 5, r: 0.16, len: 1.55, tilt: 0.35 }
  ];
  ringDefs.forEach((ring, ri) => {
    for (let i = 0; i < ring.count; i++) {
      const a = (i / ring.count) * Math.PI * 2 + ri * 0.45;
      const len = ring.len * (0.85 + Math.random() * 0.3);
      specs.push({
        color: CROWN_GREENS[(i + ri) % CROWN_GREENS.length],
        pos: [Math.cos(a) * ring.r, len * 0.42, Math.sin(a) * ring.r],
        scale: [1, len, 0.32],
        rot: [Math.sin(a) * ring.tilt, (Math.random() - 0.5) * 0.4, -Math.cos(a) * ring.tilt]
      });
    }
  });
  specs.push({ color: CROWN_GREENS[1], pos: [0, 0.78, 0], scale: [1, 1.8, 0.32] });
  return specs;
}
function calyxSpecs() {
  const specs = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    specs.push({
      color: 0x3fa14a, pos: [Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16],
      scale: [1, 0.5, 0.45], rot: [Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15]
    });
  }
  return specs;
}
const CROWN_GEO = bakeMerged(leafGeo, crownSpecs());
const CALYX_GEO = bakeMerged(leafGeo, calyxSpecs());
function makeCrown() { return new THREE.Mesh(CROWN_GEO, leafMat); }
function makeCalyx() { return new THREE.Mesh(CALYX_GEO, leafMat); }

// ---- Sushi toppings (cached geometry + material; merged where multi-part) ----
const BOX = new THREE.BoxGeometry(1, 1, 1);
function fishTex(base, stripe, lines) {
  const c = makeCanvas(128), b = c.getContext('2d');
  b.fillStyle = base; b.fillRect(0, 0, 128, 128);
  b.strokeStyle = stripe; b.lineWidth = 6;
  for (let i = -1; i < 6; i++) { b.beginPath(); b.moveTo(0, i * 24); b.bezierCurveTo(40, i * 24 + 14, 90, i * 24 - 6, 128, i * 24 + 10); b.stroke(); }
  if (lines) { b.strokeStyle = lines; b.lineWidth = 3; for (let i = 0; i < 5; i++) { b.beginPath(); b.moveTo(0, 14 + i * 26); b.lineTo(128, 14 + i * 26); b.stroke(); } }
  return texFromCanvas(c);
}
const salmonMat = new THREE.MeshPhongMaterial({ map: fishTex('#ff8a50', '#ffd2b3', null), shininess: 45, specular: 0x553322 });
const ebiMat = new THREE.MeshPhongMaterial({ map: fishTex('#ff9aa6', '#fff2f3', '#e2566a'), shininess: 45, specular: 0x553333 });
const tamagoMat = new THREE.MeshPhongMaterial({ color: 0xf6c63a, shininess: 28, specular: 0x4a3a10 });
const noriBeltMat = new THREE.MeshPhongMaterial({ color: 0x16271c, shininess: 18 });
const roeMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 85, specular: 0x884422 });
const roeBase = new THREE.SphereGeometry(1, 8, 6);
function roeSpecs() {
  const specs = [], cols = ['#ff8a1e', '#ff7414', '#ff9c38'];
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * 7, rad = Math.random() * 0.55;
    specs.push({ color: cols[i % 3], pos: [Math.cos(a) * rad, 0.12 + (0.55 - rad) * 0.6, Math.sin(a) * rad], scale: [0.17, 0.17, 0.17] });
  }
  return specs;
}
const ROE_GEO = bakeMerged(roeBase, roeSpecs());

function addTop(f, g) {
  if (f.crown) { const c = makeCrown(); c.position.y = f.scale[1] * 0.94; c.scale.setScalar(0.95); g.add(c); }
  if (f.berry) { const c = makeCalyx(); c.position.y = f.scale[1] * 0.92; g.add(c); }
  if (f.top === 'salmon') { const m = new THREE.Mesh(UNIT_SPHERE, salmonMat); m.scale.set(1.34, 0.26, 0.84); m.position.y = f.scale[1] * 0.82; g.add(m); }
  if (f.top === 'ebi') { const m = new THREE.Mesh(UNIT_SPHERE, ebiMat); m.scale.set(1.36, 0.26, 0.74); m.position.y = f.scale[1] * 0.82; g.add(m); }
  if (f.top === 'tamago') {
    const egg = new THREE.Mesh(BOX, tamagoMat); egg.scale.set(1.36, 0.52, 0.86); egg.position.y = f.scale[1] * 0.72; g.add(egg);
    const belt = new THREE.Mesh(BOX, noriBeltMat); belt.scale.set(0.34, 1.05, 0.94); belt.position.y = f.scale[1] * 0.55; g.add(belt);
  }
  if (f.top === 'roe') { const m = new THREE.Mesh(ROE_GEO, roeMat); m.position.y = f.scale[1] * 0.72; g.add(m); }
}

function makeWhole(f) {
  const g = new THREE.Group();
  let m;
  if (f.endOn) { // end-on roll: flesh cross-section faces the camera, nori on the rim
    m = new THREE.Mesh(MAKI_CYL, [f.rindMat, f.fleshMat, f.fleshMat]); // side, +Z cap, -Z cap
    m.scale.set(f.scale[0], f.scale[1], MAKI_THICK);
  } else if (f.cyl) { // upright roll (e.g. ikura gunkan) — flesh on the top/bottom caps
    m = new THREE.Mesh(CYL, [f.rindMat, f.fleshMat, f.fleshMat]); // side, top, bottom
    m.scale.set(f.scale[0], f.scale[1], f.scale[2]);
  } else {
    m = new THREE.Mesh(UNIT_SPHERE, f.rindMat);
    m.scale.set(f.scale[0], f.scale[1], f.scale[2]);
  }
  g.add(m);
  addTop(f, g);
  g.scale.setScalar(f.r);
  return g;
}

// Half-moon slice of an end-on roll: curved nori rim + two flesh half-disks (±Z)
// + a flat flesh cut face. Solid hump on +Y so it reuses the dome separation logic.
function makeHalfMaki(f, top) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(MAKI_HALF, [f.rindMat, f.fleshMat, f.fleshMat]));
  inner.add(new THREE.Mesh(MAKI_HALF_CAP, f.fleshMat));
  inner.scale.set(f.scale[0], f.scale[1], MAKI_THICK);
  if (!top) inner.rotation.z = Math.PI; // mirror to the -Y half
  g.add(inner);
  g.scale.setScalar(f.r);
  return g;
}

// Half of an upright roll: a short barrel showing flesh on both circular ends
// (the original cap and the freshly cut face), nori around the side.
function makeHalfBarrel(f, top) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(CYL, [f.rindMat, f.fleshMat, f.fleshMat]);
  m.scale.set(f.scale[0], f.scale[1] * 0.5, f.scale[2]);
  m.position.y = f.scale[1] * 0.25 * (top ? 1 : -1);
  g.add(m);
  if (top) addTop(f, g);
  g.scale.setScalar(f.r);
  return g;
}

// a half = dome (rind) + flat cap (flesh); the leafy top rides along on the top half
function makeHalf(f, top) {
  if (f.endOn) return makeHalfMaki(f, top);
  if (f.cyl) return makeHalfBarrel(f, top);
  const g = new THREE.Group();
  const dome = new THREE.Mesh(top ? TOP_DOME : BOT_DOME, f.rindMat);
  dome.scale.set(f.scale[0], f.scale[1], f.scale[2]);
  g.add(dome);
  const cap = new THREE.Mesh(CAP, f.fleshMat);
  cap.scale.set(f.scale[0], f.scale[2], 1);
  // CircleGeometry lies in XY facing +Z; rotate to the equatorial (XZ) plane
  cap.rotation.x = top ? Math.PI / 2 : -Math.PI / 2;
  g.add(cap);
  if (top) addTop(f, g);
  g.scale.setScalar(f.r);
  return g;
}

// ---------- Audio ----------
const SOUND_NAMES = [
  'Sword-swipe-1', 'Sword-swipe-2', 'Sword-swipe-3', 'Sword-swipe-4', 'Sword-swipe-5',
  'Impact-Watermelon', 'Impact-Orange', 'Impact-Apple', 'Impact-Plum', 'Impact-kiwifruit',
  'Impact-Coconut', 'Impact-Strawberry', 'Impact-Pineapple',
  'Splatter-Small-1', 'Splatter-Small-2', 'Splatter-Medium-1', 'Splatter-Medium-2',
  'Throw-fruit', 'Throw-bomb', 'player-bomb-ready', 'Bomb-explode',
  'combo-1', 'combo-2', 'combo-3', 'combo-4', 'combo-5',
  'Game-start', 'Game-over', 'ui-button-push', 'Next-screen-button', 'extra-life'
];
// Web Audio: decode each clip once into a buffer and fire cheap one-shot sources.
// Far lighter on mobile than a pool of 100+ HTMLAudioElements.
let actx = null, masterGain = null, muted = false;
const buffers = {};

function initAudioContext() {
  if (actx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  masterGain = actx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(actx.destination);
}
function resumeAudio() { if (actx && actx.state === 'suspended') actx.resume(); }

function loadSounds(done) {
  initAudioContext();
  if (!actx) { done(); return; }
  let total = SOUND_NAMES.length, loaded = 0, finished = false;
  const finish = () => { if (!finished) { finished = true; done(); } };
  const tick = () => { if (++loaded >= total) finish(); };
  SOUND_NAMES.forEach(name => {
    fetch(new URL(`assets/sounds/${name}.wav`, ASSET_BASE))
      .then(r => r.arrayBuffer())
      .then(buf => actx.decodeAudioData(buf))
      .then(b => { buffers[name] = b; })
      .catch(() => {})
      .finally(tick);
  });
  setTimeout(finish, 6000); // never block boot on audio
}

function play(name, vol = 1) {
  if (muted || !actx) return;
  const b = buffers[name];
  if (!b) return;
  const src = actx.createBufferSource();
  src.buffer = b;
  const g = actx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(masterGain);
  try { src.start(); } catch (e) {}
}
function playSwipe() { play('Sword-swipe-' + (1 + Math.floor(Math.random() * 5)), 0.5); }
function splatterSound() {
  const sm = Math.random() < 0.5;
  play((sm ? 'Splatter-Small-' : 'Splatter-Medium-') + (1 + Math.floor(Math.random() * 2)), 0.5);
}

// ---------- Game entities ----------
const GRAVITY = -34; // world units / s^2
let fruits = [];   // active whole fruit/bombs
let pieces = [];   // sliced halves & debris

class Entity {
  constructor(f, isBomb) {
    this.f = f;
    this.isBomb = isBomb;
    this.dead = false;
    this.sliced = false;
    this.fuseT = 0;
    this.obj = isBomb ? makeHazard() : makeWhole(f);
    this.r = isBomb ? HAZARD_R : f.r;
    this.spin = new THREE.Vector3((Math.random() - .5) * 4, (Math.random() - .5) * 4, (Math.random() - .5) * 4);
    this.vel = new THREE.Vector3();
    scene.add(this.obj);
  }
  setPos(x, y, z) { this.obj.position.set(x, y, z); }
  update(dt) {
    this.vel.y += GRAVITY * dt;
    this.obj.position.addScaledVector(this.vel, dt);
    this.obj.rotation.x += this.spin.x * dt;
    this.obj.rotation.y += this.spin.y * dt;
    this.obj.rotation.z += this.spin.z * dt;
    if (this.isBomb && THEME.hazardFuse) {
      this.fuseT += dt;
      if (Math.random() < 0.4) spawnSpark(this.fuseTip());
    }
  }
  fuseTip() {
    const tip = new THREE.Vector3(0, this.r + 0.9, 0).applyQuaternion(this.obj.quaternion).add(this.obj.position);
    return tip;
  }
  remove() { scene.remove(this.obj); }
}

// cached bomb part geometries/materials (built once, shared by every bomb)
const BOMB_CAP_GEO = new THREE.CylinderGeometry(0.5, 0.6, 0.5, 12);
const BOMB_FUSE_GEO = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
const BOMB_TIP_GEO = new THREE.SphereGeometry(0.22, 8, 8);
const fuseMat = new THREE.MeshPhongMaterial({ color: 0x9c7b4a });
const tipMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });

function makeBomb() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(UNIT_SPHERE, bombMat);
  body.scale.setScalar(1.7);
  g.add(body);
  const cap = new THREE.Mesh(BOMB_CAP_GEO, capMat);
  cap.position.y = 1.7;
  g.add(cap);
  const fuse = new THREE.Mesh(BOMB_FUSE_GEO, fuseMat);
  fuse.position.set(0.15, 2.4, 0);
  fuse.rotation.z = -0.5;
  g.add(fuse);
  const tip = new THREE.Mesh(BOMB_TIP_GEO, tipMat);
  tip.position.set(0.4, 2.9, 0);
  g.add(tip);
  g.userData.tip = tip;
  return g;
}

// ---- Peanut butter jar hazard (sushi theme) ----
const PB_JAR_GEO = new THREE.CylinderGeometry(0.7, 0.66, 1.2, 30, 1, true); // clear glass wall
const PB_FILL_GEO = new THREE.CylinderGeometry(0.66, 0.62, 1.04, 30);        // peanut butter inside
const PB_BASE_GEO = new THREE.CircleGeometry(0.7, 30);                       // jar bottom
const PB_LID_GEO = new THREE.CylinderGeometry(0.74, 0.72, 0.36, 30);         // screw-top lid
const PB_LABEL_GEO = new THREE.CylinderGeometry(0.705, 0.69, 0.8, 30, 1, true); // wrap-around label
function pbLabelCanvas() {
  const c = makeCanvas(256), b = c.getContext('2d');
  b.fillStyle = '#f3e2bf'; b.fillRect(0, 0, 256, 256);
  b.fillStyle = '#b9472a'; b.fillRect(0, 0, 256, 24); b.fillRect(0, 232, 256, 24);
  // peanut emblem
  b.fillStyle = '#c98a3c'; b.strokeStyle = '#8a5a22'; b.lineWidth = 3;
  for (const [x, y] of [[110, 92], [150, 108]]) {
    b.beginPath(); b.ellipse(x, y, 26, 18, -0.4, 0, 7); b.fill(); b.stroke();
  }
  // brown name band
  b.fillStyle = '#5a3214'; b.fillRect(0, 150, 256, 58);
  b.fillStyle = '#f3e2bf'; b.textAlign = 'center'; b.textBaseline = 'middle';
  b.font = 'bold 28px Georgia, serif';
  b.fillText('PEANUT BUTTER', 128, 180);
  return c;
}
const pbGlassMat = new THREE.MeshPhongMaterial({ color: 0xeef3e8, shininess: 120, specular: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
const pbFillMat = new THREE.MeshPhongMaterial({ color: 0xa86c2c, shininess: 12, specular: 0x4a3010 });
const pbLidMat = new THREE.MeshPhongMaterial({ color: 0xc0392b, shininess: 55, specular: 0x661a14 });
const pbLabelMat = new THREE.MeshPhongMaterial({ map: texFromCanvas(pbLabelCanvas()), shininess: 14 });
const HAZARD_R = THEME.hazard === 'bomb' ? 1.7 : 1.6;

function makePeanutButter() {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(PB_FILL_GEO, pbFillMat);
  fill.position.y = -0.02;
  g.add(fill);
  const label = new THREE.Mesh(PB_LABEL_GEO, pbLabelMat);
  label.position.y = -0.04;
  g.add(label);
  const glass = new THREE.Mesh(PB_JAR_GEO, pbGlassMat);
  g.add(glass);
  const base = new THREE.Mesh(PB_BASE_GEO, pbGlassMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.6;
  g.add(base);
  const lid = new THREE.Mesh(PB_LID_GEO, pbLidMat);
  lid.position.y = 0.72;
  g.add(lid);
  g.scale.setScalar(2.0); // match the visual scale of fruit/bombs
  return g;
}

function makeHazard() { return THEME.hazard === 'bomb' ? makeBomb() : makePeanutButter(); }

// ---------- Pieces (halves + juice droplets) ----------
class Piece {
  constructor(obj, vel, spin, life = 4) {
    this.obj = obj; this.vel = vel; this.spin = spin;
    this.life = life; this.t = 0; this.dead = false;
    scene.add(obj);
  }
  update(dt) {
    this.t += dt;
    this.vel.y += GRAVITY * dt;
    this.obj.position.addScaledVector(this.vel, dt);
    this.obj.rotation.x += this.spin.x * dt;
    this.obj.rotation.y += this.spin.y * dt;
    this.obj.rotation.z += this.spin.z * dt;
    if (this.t > this.life || this.obj.position.y < -viewH / 2 - 8) this.dead = true;
  }
  remove() { scene.remove(this.obj); }
}

const dropGeo = new THREE.SphereGeometry(0.18, 6, 6);
const juiceMats = {}; // color -> shared MeshBasicMaterial
function juiceMat(color) {
  return juiceMats[color] || (juiceMats[color] = new THREE.MeshBasicMaterial({ color }));
}
function spawnJuice(pos, color, n) {
  const mat = juiceMat(color);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dropGeo, mat);
    m.position.copy(pos);
    m.scale.setScalar(0.5 + Math.random() * 1.2);
    const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI;
    const sp = 5 + Math.random() * 14;
    const vel = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e) + 0.4, Math.sin(a) * Math.cos(e)).multiplyScalar(sp);
    pieces.push(new Piece(m, vel, new THREE.Vector3(), 1.2));
  }
  // keep the live-piece count bounded so big combos can't tank the framerate
  while (pieces.length > MAX_PIECES) { const p = pieces.shift(); p.remove(); }
}

// 2D sparks for bomb fuse / explosion (overlay)
const sparks = [];
function spawnSpark(worldPos) {
  const p = worldToScreen(worldPos);
  sparks.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120 - 30, t: 0, life: 0.3 + Math.random() * 0.3 });
}

// ---------- Overlay: blade trail, juice splats on lens, score popups ----------
const trail = [];
let pointerDown = false, lastPointer = null;
const splats = [];   // {x,y,color,blobs,t,life}
const popups = [];   // {x,y,text,color,t,life}

function worldToScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
}

// ---------- Input ----------
function pointerPos(e) {
  if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}
function onDown(e) {
  resumeAudio();
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
    if (dist > 4 && state === PLAYING && endingT < 0) checkSlice(lastPointer, p);
    if (dist > 26) playSwipeThrottled();
  }
  trail.push({ x: p.x, y: p.y, t: now });
  if (trail.length > 22) trail.shift();
  lastPointer = p;
  if (e.cancelable) e.preventDefault();
}
function onUp() { pointerDown = false; lastPointer = null; }

let lastSwipeAt = 0;
function playSwipeThrottled() {
  const now = performance.now();
  if (now - lastSwipeAt > 130) { lastSwipeAt = now; playSwipe(); }
}

glCanvas.addEventListener('mousedown', onDown);
glCanvas.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
glCanvas.addEventListener('touchstart', onDown, { passive: true });
glCanvas.addEventListener('touchmove', onMove, { passive: false });
window.addEventListener('touchend', onUp);

// ---------- Slicing ----------
function segPointDist(p1, p2, x, y) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(x - p1.x, y - p1.y);
  let t = ((x - p1.x) * dx + (y - p1.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (p1.x + t * dx), y - (p1.y + t * dy));
}

function checkSlice(p1, p2) {
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  for (const e of fruits) {
    if (e.dead || e.sliced) continue;
    const sp = worldToScreen(e.obj.position);
    const screenR = e.r * (H / viewH) * 1.12; // world radius to px, slightly forgiving
    if (segPointDist(p1, p2, sp.x, sp.y) <= screenR) {
      if (e.isBomb) { hitBomb(e); return; }
      sliceFruit(e, angle, sp);
    }
  }
}

function sliceFruit(e, screenAngle, sp) {
  e.sliced = true; e.dead = true;
  e.remove();
  const f = e.f;
  // direction in screen space the halves fly apart (perpendicular to blade)
  const sepAng = screenAngle + Math.PI / 2;
  const sepWorld = new THREE.Vector3(Math.cos(sepAng), -Math.sin(sepAng), 0).normalize();

  for (const top of [true, false]) {
    const half = makeHalf(f, top);
    half.position.copy(e.obj.position);
    // rotate so the cut plane (dome's equator) aligns with the blade direction on screen
    half.rotation.z = -screenAngle;
    const dir = top ? 1 : -1;
    const push = 4 + Math.random() * 3;
    const vel = e.vel.clone().multiplyScalar(0.55).addScaledVector(sepWorld, dir * push);
    vel.y += 1;
    const spin = new THREE.Vector3((Math.random() - .5) * 6, (Math.random() - .5) * 6, dir * (3 + Math.random() * 4));
    pieces.push(new Piece(half, vel, spin, 4));
  }

  spawnJuice(e.obj.position, new THREE.Color(f.juice).getHex(), JUICE_N);
  addSplat(sp.x, sp.y, f.juice);
  play(f.sound, 0.7);
  splatterSound();

  // scoring
  let points = f.score;
  let label = '+' + points, color = '#fff59d';
  if (f.bonus) { label = f.name === 'wasabi' ? 'WASABI! +' + points : 'BONUS +' + points; color = '#aef25a'; }
  else if (Math.random() < 0.07) { points += 5; label = 'CRITICAL +' + points; color = '#80d8ff'; }
  score += points;
  addPopup(sp.x, sp.y - 30, label, color);
  updateHUD();

  comboCount++;
  comboTimer = 0.4;
}

function hitBomb(e) {
  e.dead = true; e.sliced = true;
  e.remove();
  const splat = THEME.hazard !== 'bomb';
  const sp = worldToScreen(e.obj.position);
  if (splat) {
    play('Splatter-Medium-1', 1); play('Bomb-explode', 0.4);
    flashT = 0.22; shakeT = 0.5; endingT = 1.2;
    // sticky peanut-butter spray + droplets
    for (let i = 0; i < 50; i++) sparks.push({ x: sp.x, y: sp.y, vx: (Math.random() - .5) * 480, vy: (Math.random() - .5) * 480, t: 0, life: 0.4 + Math.random() * 0.5, pb: true });
    spawnJuice(e.obj.position, 0xa86c2c, 22);
    addSplat(sp.x, sp.y, '#7a4a1e');
    addSplat(sp.x, sp.y, '#a86c2c');
    addPopup(sp.x, sp.y - 30, '❌ allergy', '#ffe9c4');
  } else {
    play('Bomb-explode', 1);
    flashT = 0.3; shakeT = 0.6; endingT = 1.2;
    for (let i = 0; i < 60; i++) sparks.push({ x: sp.x, y: sp.y, vx: (Math.random() - .5) * 600, vy: (Math.random() - .5) * 600, t: 0, life: 0.4 + Math.random() * 0.5 });
    addSplat(sp.x, sp.y, '#3a3a3a');
  }
  // blow nearby items away
  for (const o of fruits) {
    if (o.dead) continue;
    o.vel.x += (o.obj.position.x - e.obj.position.x) * 1.5 + (Math.random() - .5) * 8;
    o.vel.y += 8 + Math.random() * 6;
  }
}

function addSplat(x, y, color) {
  const blobs = [];
  const n = 6 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * 46;
    blobs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 6 + Math.random() * 20 });
  }
  splats.push({ x, y, color, blobs, t: 0, life: 4 });
}
function addPopup(x, y, text, color) { popups.push({ x, y, text, color, t: 0, life: 0.85 }); }

// ---------- Combo ----------
let comboCount = 0, comboTimer = 0;
function resolveCombo() {
  if (comboCount >= 3) {
    const bonus = comboCount;
    score += bonus;
    showBanner(comboCount + ' ' + THEME.comboWord + ' COMBO!  +' + bonus);
    play('combo-' + Math.min(5, comboCount - 2), 0.8);
    updateHUD();
  }
  comboCount = 0;
}

// ---------- Spawning ----------
const TOTAL_WEIGHT = ITEMS.reduce((a, it) => a + (it.weight || 1), 0);
function pickItem() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const it of ITEMS) { r -= (it.weight || 1); if (r <= 0) return it; }
  return ITEMS[0];
}
function launch(isBomb) {
  const f = pickItem();
  const e = new Entity(f, isBomb);
  const x = (Math.random() - 0.5) * viewW * 0.7;
  const y = -viewH / 2 - 3;
  const z = (Math.random() - 0.5) * 6;
  e.setPos(x, y, z);
  // aim apex near top third
  const apexY = viewH * (0.12 + Math.random() * 0.22);
  const vy = Math.sqrt(2 * -GRAVITY * (apexY - y));
  const targetX = (Math.random() - 0.5) * viewW * 0.5;
  const tflight = vy / -GRAVITY;
  const vx = (targetX - x) / (tflight * 1.5);
  e.vel.set(vx, vy, (Math.random() - 0.5) * 2);
  fruits.push(e);
  play(isBomb ? 'Throw-bomb' : 'Throw-fruit', 0.4);
  if (isBomb && THEME.hazardFuse) play('player-bomb-ready', 0.3);
}

function spawnWave() {
  const diff = Math.min(1, elapsed / 80);
  const count = 1 + Math.floor(Math.random() * (2 + diff * 3));
  const bombChance = 0.1 + diff * 0.16;
  let delay = 0;
  for (let i = 0; i < count; i++) {
    const bomb = Math.random() < bombChance;
    setTimeout(() => { if (state === PLAYING && endingT < 0) launch(bomb); }, delay);
    delay += 130 + Math.random() * 220;
  }
}
function spawnInterval() {
  const diff = Math.min(1, elapsed / 80);
  return 2.3 - diff * 1.25 + Math.random() * 0.5;
}

// ---------- Game state ----------
const MENU = 0, PLAYING = 1, OVER = 2;
let state = MENU;
let score = 0, best = parseInt(localStorage.getItem(THEME.bestKey) || '0', 10);
let lives = 3, elapsed = 0, spawnTimer = 0, endingT = -1;
let shakeT = 0, flashT = 0, startMsgShown = false;

function updateHUD() {
  scoreEl.textContent = score;
  bestEl.textContent = Math.max(best, score);
  document.querySelectorAll('.strike').forEach((el, i) => el.classList.toggle('lost', i < 3 - lives));
}

let bannerTimeout = null;
function showBanner(text) {
  banner.textContent = text;
  banner.classList.remove('hidden');
  banner.style.animation = 'none'; void banner.offsetWidth; banner.style.animation = '';
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => banner.classList.add('hidden'), 950);
}

function clearEntities() {
  fruits.forEach(e => e.remove());
  pieces.forEach(p => p.remove());
  fruits = []; pieces = []; sparks.length = 0; splats.length = 0; popups.length = 0; trail.length = 0;
}

function startGame() {
  clearEntities();
  score = 0; lives = 3; elapsed = 0; spawnTimer = 0.7;
  comboCount = 0; endingT = -1; flashT = 0; shakeT = 0; startMsgShown = false;
  state = PLAYING;
  menuScreen.classList.add('hidden');
  overScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  play('Game-start', 0.7);
  updateHUD();
}

function gameOver() {
  state = OVER;
  play('Game-over', 0.8);
  const isBest = score > best;
  if (isBest) { best = score; localStorage.setItem(THEME.bestKey, String(best)); }
  $('final-score').textContent = 'Score: ' + score;
  $('new-best').classList.toggle('hidden', !isBest);
  hud.classList.add('hidden');
  overScreen.classList.remove('hidden');
}

$('play-btn').addEventListener('click', () => { resumeAudio(); play('ui-button-push', 0.6); startGame(); });
$('replay-btn').addEventListener('click', () => { resumeAudio(); play('ui-button-push', 0.6); startGame(); });

// ---------- Update ----------
function update(dt) {
  if (state === PLAYING) {
    if (endingT >= 0) {
      endingT -= dt;
      if (endingT <= 0) gameOver();
    } else {
      elapsed += dt;
      spawnTimer -= dt;
      if (spawnTimer <= 0) { spawnWave(); spawnTimer = spawnInterval(); }
      if (comboCount > 0) { comboTimer -= dt; if (comboTimer <= 0) resolveCombo(); }
      if (THEME.startMessage && !startMsgShown && elapsed >= 3) { startMsgShown = true; showBanner(THEME.startMessage); }
    }
    for (const e of fruits) {
      e.update(dt);
      if (!e.dead && e.vel.y < 0 && e.obj.position.y < -viewH / 2 - 5) {
        e.dead = true; e.remove();
        if (!e.isBomb && endingT < 0) {
          lives--; updateHUD();
          if (lives <= 0) endingT = 0.5;
        }
      }
    }
    fruits = fruits.filter(e => { if (e.dead && !e.sliced) return false; return !e.dead; });
  } else if (state === MENU) {
    updateMenu(dt);
  }

  for (const p of pieces) p.update(dt);
  pieces = pieces.filter(p => { if (p.dead) { p.remove(); return false; } return true; });

  // overlay particle updates
  for (const s of sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t > sparks[i].life) sparks.splice(i, 1);
  for (const s of splats) s.t += dt;
  for (let i = splats.length - 1; i >= 0; i--) if (splats[i].t > splats[i].life) splats.splice(i, 1);
  for (const p of popups) { p.t += dt; p.y -= 60 * dt; }
  for (let i = popups.length - 1; i >= 0; i--) if (popups[i].t > popups[i].life) popups.splice(i, 1);

  if (shakeT > 0) shakeT -= dt;
  if (flashT > 0) flashT -= dt;

  const now = performance.now();
  while (trail.length && now - trail[0].t > 110) trail.shift();
}

// menu: gently lob fruit for show
let menuSpawnT = 0;
function updateMenu(dt) {
  menuSpawnT -= dt;
  if (menuSpawnT <= 0 && fruits.length < 4) {
    launchMenuFruit();
    menuSpawnT = 1.1 + Math.random();
  }
  for (const e of fruits) {
    e.update(dt);
    if (e.obj.position.y < -viewH / 2 - 6) { e.dead = true; e.remove(); }
  }
  fruits = fruits.filter(e => !e.dead);
}
function launchMenuFruit() {
  const f = pickItem();
  const e = new Entity(f, false);
  const x = (Math.random() - 0.5) * viewW * 0.8;
  e.setPos(x, -viewH / 2 - 3, (Math.random() - 0.5) * 4);
  const vy = Math.sqrt(2 * -GRAVITY * (viewH * 0.6));
  e.vel.set((Math.random() - 0.5) * 4, vy, 0);
  fruits.push(e);
}

// ---------- Render overlay ----------
function renderOverlay() {
  const oDpr = Math.min(DPR, 1.5);
  octx.setTransform(oDpr, 0, 0, oDpr, 0, 0);
  octx.clearRect(0, 0, W, H);

  let sx = 0, sy = 0;
  if (shakeT > 0) { const s = shakeT * 16; sx = (Math.random() - .5) * s; sy = (Math.random() - .5) * s; octx.translate(sx, sy); }

  // splats on the "lens"
  for (const s of splats) {
    const fade = s.t < s.life - 1 ? 0.5 : 0.5 * (s.life - s.t);
    octx.globalAlpha = Math.max(0, fade);
    octx.fillStyle = s.color;
    for (const b of s.blobs) { octx.beginPath(); octx.arc(s.x + b.x, s.y + b.y, b.r, 0, 7); octx.fill(); }
  }
  octx.globalAlpha = 1;

  // sparks
  for (const s of sparks) {
    const k = 1 - s.t / s.life;
    octx.globalAlpha = k;
    octx.fillStyle = s.pb ? (Math.random() < 0.5 ? '#c98a3c' : '#7a4a1e') : (Math.random() < 0.5 ? '#ffd740' : '#ff6e40');
    octx.beginPath(); octx.arc(s.x, s.y, 1.5 + k * 2.5, 0, 7); octx.fill();
  }
  octx.globalAlpha = 1;

  // blade trail
  drawBlade();

  // popups
  for (const p of popups) {
    octx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    octx.font = 'bold 26px Trebuchet MS, sans-serif';
    octx.textAlign = 'center';
    octx.lineWidth = 4; octx.strokeStyle = 'rgba(0,0,0,.6)';
    octx.strokeText(p.text, p.x, p.y); octx.fillStyle = p.color; octx.fillText(p.text, p.x, p.y);
  }
  octx.globalAlpha = 1;

  if (shakeT > 0) octx.translate(-sx, -sy);
  if (flashT > 0) { octx.fillStyle = `rgba(255,255,255,${flashT * 3})`; octx.fillRect(0, 0, W, H); }
}

function drawBlade() {
  if (trail.length < 2) return;
  const now = performance.now();
  octx.lineCap = 'round'; octx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const age = (now - b.t) / 110;
      const k = Math.max(0, 1 - age);
      if (k <= 0) continue;
      const wd = (pass === 0 ? 16 : 5) * k * (i / trail.length);
      octx.strokeStyle = pass === 0 ? `rgba(180,225,255,${0.32 * k})` : `rgba(255,255,255,${0.92 * k})`;
      octx.lineWidth = Math.max(0.5, wd);
      octx.beginPath(); octx.moveTo(a.x, a.y); octx.lineTo(b.x, b.y); octx.stroke();
    }
  }
}

// ---------- Resize ----------
function resize() {
  W = window.innerWidth; H = window.innerHeight; DPR = effectiveDPR();
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  computeView();
  layoutBackground();
  // overlay (blade/juice/popups) is cheap line/fill work — keep it at <=1.5x to save fill cost
  const oDpr = Math.min(DPR, 1.5);
  overlay.width = Math.round(W * oDpr); overlay.height = Math.round(H * oDpr);
  overlay.style.width = W + 'px'; overlay.style.height = H + 'px';
  octx.setTransform(oDpr, 0, 0, oDpr, 0, 0);
}
window.addEventListener('resize', resize);

// Apply a new quality scale at runtime (used by the adaptive monitor).
// resize() reads effectiveDPR(), which already folds in qualityScale, and keeps
// the renderer + overlay in sync.
function applyQuality() { resize(); }

// ---------- Adaptive quality: drop resolution if the device can't hold ~50fps ----------
let qWin = 0, qFrames = 0;
function monitorQuality(dt) {
  qWin += dt; qFrames++;
  if (qWin < 2) return;            // sample over 2s windows
  const fps = qFrames / qWin;
  qWin = 0; qFrames = 0;
  if (fps < 50 && qualityScale > 0.6) {
    qualityScale = Math.max(0.6, qualityScale - 0.18);
    applyQuality();
  }
}

// ---------- Main loop ----------
let lastT = performance.now();
function loop(t) {
  const dt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;
  update(dt);
  if (qualityScale > 0.6) monitorQuality(dt);

  // camera shake on the rendered view too
  if (shakeT > 0) {
    camera.position.x = (Math.random() - .5) * shakeT * 1.5;
    camera.position.y = (Math.random() - .5) * shakeT * 1.5;
  } else { camera.position.x = 0; camera.position.y = 0; }
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  renderOverlay();
  requestAnimationFrame(loop);
}

// ---------- Title card logo (rendered with the Gang of Three font) ----------
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// render a word into its own canvas with dark outline, per-letter gradient, gloss + droplets
function glossyWord(text, size, spacing, opts) {
  const pad = size * 0.5;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${size}px "Gang Of Three"`;
  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  c.width = Math.ceil(total + pad * 2);
  c.height = Math.ceil(size * 1.7);
  const b = c.getContext('2d');
  b.font = `${size}px "Gang Of Three"`;
  b.textBaseline = 'alphabetic';
  b.lineJoin = 'round';
  b.lineCap = 'round';
  const baseY = size * 1.15;
  let x = pad;
  const centers = [];
  [...text].forEach((ch, i) => {
    const w = widths[i];
    b.strokeStyle = opts.outlineColor;
    b.lineWidth = size * opts.outlineW;
    b.strokeText(ch, x, baseY);
    let fill;
    if (opts.metallic) {
      fill = b.createLinearGradient(0, baseY - size, 0, baseY + size * 0.1);
      fill.addColorStop(0.00, '#fbfdff');
      fill.addColorStop(0.34, '#c6cfd7');
      fill.addColorStop(0.50, '#828c95');
      fill.addColorStop(0.56, '#6a737b');
      fill.addColorStop(0.72, '#dfe6ec');
      fill.addColorStop(1.00, '#a9b2bb');
    } else {
      const col = opts.colors[i];
      fill = b.createLinearGradient(0, baseY - size, 0, baseY);
      fill.addColorStop(0, shade(col, 0.5));
      fill.addColorStop(0.5, col);
      fill.addColorStop(1, shade(col, -0.42));
    }
    b.fillStyle = fill;
    b.fillText(ch, x, baseY);
    centers.push(x + w / 2);
    x += w + spacing;
  });

  // gloss + droplets, scoped to the letters only
  b.globalCompositeOperation = 'source-atop';
  const gl = b.createLinearGradient(0, baseY - size, 0, baseY - size * 0.2);
  gl.addColorStop(0, 'rgba(255,255,255,0.6)');
  gl.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  b.fillStyle = gl;
  b.fillRect(0, baseY - size, c.width, size);
  if (!opts.noDrops) {
    for (let i = 0; i < 26; i++) {
      const dx = pad + Math.random() * total;
      const dy = baseY - size * (0.15 + Math.random() * 0.8);
      const r = 2 + Math.random() * 5;
      b.fillStyle = 'rgba(255,255,255,0.28)';
      b.beginPath(); b.ellipse(dx, dy, r, r * 1.25, 0, 0, 7); b.fill();
      b.fillStyle = 'rgba(255,255,255,0.85)';
      b.beginPath(); b.arc(dx - r * 0.3, dy - r * 0.4, r * 0.35, 0, 7); b.fill();
    }
  }
  b.globalCompositeOperation = 'source-over';
  return { canvas: c, centers, baseY, size, pad };
}

function drawLeafSprout(ctx, x, y, s) {
  const leaf = (ang, len) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, '#3f9b2e');
    g.addColorStop(1, '#7ed957');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#235c18';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.5, 0, -len);
    ctx.quadraticCurveTo(-len * 0.5, -len * 0.5, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(35,92,24,0.7)';
    ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len); ctx.stroke();
    ctx.restore();
  };
  leaf(-0.35, s * 1.5);
  leaf(0.35, s * 1.5);
  leaf(0, s * 1.7);
}

function buildLogo() {
  const c = document.getElementById('logo');
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  const word1 = THEME.logoWords[0]; // Fruit / Sushi
  const top = glossyWord(word1, 210, 4, {
    colors: THEME.logoColors, outlineColor: '#2c1206', outlineW: 0.05
  });
  const ninja = glossyWord(THEME.logoWords[1], 150, 8, {
    metallic: true, outlineColor: '#1b2128', outlineW: 0.08, noDrops: false
  });

  // place the top word centered upper, NINJA lower-right overlapping
  const fx = (c.width - top.canvas.width) / 2;
  const fy = 30;
  const nx = (c.width - ninja.canvas.width) / 2 + 120;
  const ny = 300;
  ctx.drawImage(ninja.canvas, nx, ny);
  ctx.drawImage(top.canvas, fx, fy);

  // leaf sprout growing out of the dot of the "i"
  const iIdx = word1.toLowerCase().indexOf('i');
  if (iIdx >= 0) {
    const iCenter = fx + top.centers[iIdx];
    const iTop = fy + top.baseY - top.size * 0.82;
    drawLeafSprout(ctx, iCenter + 4, iTop, 30);
  }
}

// ---------- Boot ----------
resize();
updateHUD();
loadSounds(() => { loadingEl.classList.add('hidden'); });
requestAnimationFrame(loop);

// build the title card once the Gang of Three font is ready (fall back if it isn't)
function tryBuildLogo() { try { buildLogo(); } catch (e) {} }
if (document.fonts && document.fonts.load) {
  document.fonts.load('200px "Gang Of Three"').then(() => { tryBuildLogo(); }).catch(tryBuildLogo);
  document.fonts.ready.then(tryBuildLogo);
} else {
  setTimeout(tryBuildLogo, 300);
}
