import { WaveSpawner } from '@gameplay/spawner.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const spawner = new WaveSpawner();
const player = { x: canvas.width / 2, y: canvas.height / 2 };
const entities = [];

const COLORS = { grunt: '#c96b6b', runner: '#d9b978', tank: '#f3ead3' };

spawner
  .addWave({
    duration: 8000,
    interval: 1200,
    count: 4,
    shape: 'ring',
    minRadius: 90,
    maxRadius: 135,
    types: [{ id: 'grunt', weight: 4 }, { id: 'runner', weight: 1 }]
  })
  .addWave({
    duration: 10000,
    interval: 1000,
    count: 6,
    shape: 'perimeter',
    width: 460,
    height: 270,
    types: [{ id: 'grunt', weight: 2 }, { id: 'runner', weight: 3 }, { id: 'tank', weight: 1 }]
  });

const onSpawn = (s) => {
  entities.push({ x: s.x, y: s.y, type: s.type, life: 4000 });
};

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  player.x = e.clientX - rect.left;
  player.y = e.clientY - rect.top;
});

document.getElementById('btnBurst').addEventListener('click', () => {
  spawner.update(spawner.currentWave.interval, player.x, player.y, onSpawn);
});

document.getElementById('btnReset').addEventListener('click', () => {
  entities.length = 0;
  spawner.reset();
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  spawner.update(dt, player.x, player.y, onSpawn);

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const w = spawner.currentWave;
  ctx.strokeStyle = '#233452';
  ctx.setLineDash([4, 4]);
  if (w.shape === 'ring') {
    ctx.beginPath(); ctx.arc(player.x, player.y, w.minRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(player.x, player.y, w.maxRadius, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.strokeRect(player.x - w.width / 2, player.y - w.height / 2, w.width, w.height);
  }
  ctx.setLineDash([]);

  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    e.life -= dt;
    if (e.life <= 0) {
      entities.splice(i, 1);
      continue;
    }
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * 35 * (dt / 1000);
    e.y += (dy / d) * 35 * (dt / 1000);

    ctx.fillStyle = COLORS[e.type];
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.type === 'tank' ? 7 : 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f3ead3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
  ctx.fill();

  out.textContent =
    `Wave: ${spawner.waveNumber} (${w.shape.toUpperCase()} mode) | Active Entities: ${entities.length}\n` +
    `Total Spawned: ${spawner.totalSpawned} | Move mouse over canvas to shift spawn origin.`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);