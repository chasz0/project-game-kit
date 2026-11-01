import { DevConsole } from '@ui/devConsole.js';
import { SpatialHash } from '@gameplay/spatialHash.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const grid = new SpatialHash(56);
const dev = new DevConsole({ toggleKey: 'Backquote' });
dev.showSpatialGrid = true;
dev.showHitboxes = true;

let speedScale = 1;
const entities = [];

const spawnEntities = (count = 10) => {
  for (let i = 0; i < count; i++) {
    const e = {
      x: 40 + Math.random() * (canvas.width - 80),
      y: 40 + Math.random() * (canvas.height - 80),
      vx: (Math.random() - 0.5) * 140,
      vy: (Math.random() - 0.5) * 140,
      r: 8 + Math.random() * 6
    };
    entities.push(e);
    grid.insert(e);
  }
};

spawnEntities(25);

dev
  .registerCommand('spawn', (args) => {
    const n = Math.max(1, Math.min(200, Number(args[0]) || 10));
    spawnEntities(n);
    return `Spawned ${n} entities (Total: ${entities.length})`;
  }, 'spawn [count] - Spawn moving swarm entities')
  .registerCommand('speed', (args) => {
    speedScale = Math.max(0.1, Number(args[0]) || 1);
    return `Simulation speed set to ${speedScale}x`;
  }, 'speed <mult> - Scale entity movement speed')
  .registerCommand('nuke', () => {
    const count = entities.length;
    entities.length = 0;
    grid.clear();
    return `Wiped ${count} entities.`;
  }, 'nuke - Remove all entities');

dev
  .watch('Entities', () => entities.length)
  .watch('Hash Cells', () => grid.cellCount)
  .watch('Sim Speed', () => `${speedScale}x`);

document.getElementById('btnToggleConsole').addEventListener('click', () => dev.toggle());
document.getElementById('btnSpawn10').addEventListener('click', () => dev.execute('spawn 15'));
document.getElementById('btnToggleGrid').addEventListener('click', () => dev.execute('grid'));
document.getElementById('btnToggleHitboxes').addEventListener('click', () => dev.execute('hitboxes'));
document.getElementById('btnClearMobs').addEventListener('click', () => dev.execute('nuke'));

let lastTime = performance.now();

const loop = (now) => {
  dev.beginFrame();
  const dt = Math.min(50, now - lastTime) / 1000;
  lastTime = now;

  dev.beginUpdate();
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    e.x += e.vx * speedScale * dt;
    e.y += e.vy * speedScale * dt;
    if (e.x < e.r || e.x > canvas.width - e.r) e.vx *= -1;
    if (e.y < e.r || e.y > canvas.height - e.r) e.vy *= -1;
    grid.update(e);
  }
  dev.endUpdate();

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#c96b6b';
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r - 2, 0, Math.PI * 2);
    ctx.fill();
  }

  dev.renderSpatialDebug(ctx, { spatialHash: grid, entities });
  dev.endFrame();
  dev.renderOverlay(ctx, 12, 12);

  out.textContent =
    `Press [~] (Backquote) or click "Toggle Console Drawer" to open the interactive CLI.\n` +
    `Try typing: "spawn 40", "speed 2.5", "grid", "hitboxes", or "help".`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);