import { SwarmDirector } from '@ai/director.js';
import { steering } from '@ai/steering.js';
import { collision } from '@gameplay/collision.js';
import { input } from '@core/input.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const director = new SwarmDirector({
  maxActive: 60,
  baseCreditRate: 5,
  spawnInterval: 900,
  buildupDuration: 9000,
  peakDuration: 3500,
  breatherDuration: 3500
});

director
  .registerEnemy('grunt', { cost: 1, weight: 5 })
  .registerEnemy('runner', { cost: 2, weight: 3 })
  .registerEnemy('elite_tank', { cost: 5, weight: 1, elite: true });

const player = { x: canvas.width / 2, y: canvas.height / 2 };
const enemies = [];
const slotTarget = { x: 0, y: 0, ringIndex: 0, slotIndex: 0 };
const force = { x: 0, y: 0 };
const sepForce = { x: 0, y: 0 };
const manifold = { nx: 0, ny: 0, depth: 0 };

let useSurroundSlots = true;
let showRings = true;

const onSpawn = (s) => {
  enemies.push({
    x: Math.max(16, Math.min(canvas.width - 16, s.x)),
    y: Math.max(16, Math.min(canvas.height - 16, s.y)),
    vx: 0,
    vy: 0,
    r: s.elite ? 10 : 6,
    speed: s.type === 'runner' ? 145 : (s.elite ? 85 : 110),
    color: s.elite ? '#d9b978' : (s.type === 'runner' ? '#78b0d9' : '#c96b6b'),
    slotX: player.x,
    slotY: player.y
  });
};

canvas.addEventListener('mousemove', () => {
  player.x = input.mouse.x;
  player.y = input.mouse.y;
});

canvas.addEventListener('mousedown', () => {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (Math.hypot(enemies[i].x - player.x, enemies[i].y - player.y) < 95) {
      enemies.splice(i, 1);
      director.recordKill();
    }
  }
});

document.getElementById('btnToggleSlots').addEventListener('click', (e) => {
  useSurroundSlots = !useSurroundSlots;
  e.target.classList.toggle('active', useSurroundSlots);
  e.target.textContent = useSurroundSlots
    ? 'Surround Slots: ON (Encircle)'
    : 'Surround Slots: OFF (Conga-Line)';
});

document.getElementById('btnShowRings').addEventListener('click', (e) => {
  showRings = !showRings;
  e.target.classList.toggle('active', showRings);
  e.target.textContent = `Show Slot Rings: ${showRings ? 'ON' : 'OFF'}`;
});

document.getElementById('btnForcePeak').addEventListener('click', () => {
  director.intensity = 1;
  director._enterPeak(player.x, player.y, enemies.length, 160, 240, onSpawn);
});

document.getElementById('btnClearMobs').addEventListener('click', () => {
  enemies.length = 0;
  director.recordKill();
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  director.update(dt, {
    playerX: player.x,
    playerY: player.y,
    activeCount: enemies.length,
    minRadius: 160,
    maxRadius: 240,
    onSpawn
  });

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (useSurroundSlots) {
      director.assignSlot(e, player.x, player.y, slotTarget);
      e.slotX = slotTarget.x;
      e.slotY = slotTarget.y;
      steering.arrive(e, slotTarget, e.speed, 35, force);
    } else {
      e.slotX = player.x;
      e.slotY = player.y;
      steering.seek(e, player, e.speed, force);
    }

    steering.separate(e, enemies, e.r * 2.4, e.speed, sepForce);
    force.x += sepForce.x * 1.1;
    force.y += sepForce.y * 1.1;

    steering.applyForce(e, force, 520, e.speed, dt);

    for (let j = i + 1; j < enemies.length; j++) {
      const hit = collision.circleCircleInfo(e, enemies[j], manifold);
      if (hit) {
        e.x += hit.nx * hit.depth * 0.5;
        e.y += hit.ny * hit.depth * 0.5;
        enemies[j].x -= hit.nx * hit.depth * 0.5;
        enemies[j].y -= hit.ny * hit.depth * 0.5;
      }
    }
  }

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (showRings) {
    for (let r = 0; r < director.rings.length; r++) {
      const ring = director.rings[r];
      ctx.strokeStyle = '#182236';
      ctx.beginPath();
      ctx.arc(player.x, player.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();

      const step = (Math.PI * 2) / ring.slots;
      for (let s = 0; s < ring.slots; s++) {
        const sx = player.x + Math.cos(s * step) * ring.radius;
        const sy = player.y + Math.sin(s * step) * ring.radius;
        ctx.fillStyle = ring.occupied[s] ? '#d9b978' : '#233452';
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
    }
  }

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f3ead3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 8, 0, Math.PI * 2);
  ctx.fill();

  out.textContent =
    `Director Phase: ${director.phase.toUpperCase()} (Wave ${director.waveNumber}) | Intensity: ${(director.intensity * 100).toFixed(0)}% | Credits: ${director.credits.toFixed(1)}\n` +
    `Active Swarm: ${enemies.length}/${director.maxActive} | Move mouse to kite, toggle Surround Slots to compare encirclement vs conga-lining.`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);