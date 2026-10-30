import { ParticleSystem } from '@ui/particles.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const fx = new ParticleSystem({ maxParticles: 1200, preallocate: 250 });
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', () => {
  fx.emit(mouse.x, mouse.y, {
    count: 28,
    color: '#d9b978',
    speedMin: 50,
    speedMax: 240,
    lifeMin: 250,
    lifeMax: 600,
    glow: true
  });
});

document.getElementById('btnBurst').addEventListener('click', () => {
  fx.emit(canvas.width / 2, canvas.height / 2, {
    count: 45,
    color: '#c96b6b',
    speedMin: 60,
    speedMax: 280,
    sizeMin: 3,
    sizeMax: 6,
    lifeMin: 300,
    lifeMax: 700,
    glow: true
  });
});

document.getElementById('btnCone').addEventListener('click', () => {
  fx.emit(120, canvas.height / 2, {
    count: 35,
    color: '#78b0d9',
    angle: 0,
    spread: Math.PI * 0.28,
    speedMin: 140,
    speedMax: 320,
    lifeMin: 250,
    lifeMax: 500,
    glow: true
  });
});

document.getElementById('btnSparks').addEventListener('click', () => {
  fx.emit(canvas.width / 2, 100, {
    count: 35,
    color: '#f3ead3',
    angle: -Math.PI / 2,
    spread: Math.PI * 0.6,
    speedMin: 80,
    speedMax: 200,
    gravity: 420,
    lifeMin: 500,
    lifeMax: 900,
    glow: true
  });
});

document.getElementById('btnClear').addEventListener('click', () => fx.clear());

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  fx.update(dt);

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  fx.render(ctx);

  out.textContent =
    `Active Particles: ${fx.activeCount} | Recycled in FreeList: ${fx.pooledCount}\n` +
    `Click anywhere on the canvas or use the buttons above to emit particles.`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);