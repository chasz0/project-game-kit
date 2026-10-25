import { SpatialHash } from '@gameplay/spatialHash.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const WORLD_W = canvas.width;
const WORLD_H = canvas.height;
const CELL_SIZE = 40;
const ENTITY_COUNT = 5000;
const QUERY_RADIUS = 50;

const grid = new SpatialHash(CELL_SIZE);
const entities = [];
const nearby = [];
const mouse = { x: WORLD_W / 2, y: WORLD_H / 2 };

for (let i = 0; i < ENTITY_COUNT; i++) {
  const entity = {
    x: Math.random() * WORLD_W,
    y: Math.random() * WORLD_H,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    r: 2,
  };
  entities.push(entity);
  grid.insert(entity);
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

const loop = () => {
  let cellTransfers = 0;

  const t0 = performance.now();
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    e.x += e.vx;
    e.y += e.vy;

    if (e.x < 0 || e.x > WORLD_W) e.vx *= -1;
    if (e.y < 0 || e.y > WORLD_H) e.vy *= -1;

    if (grid.update(e)) cellTransfers++;
  }
  const updateMs = performance.now() - t0;

  const t1 = performance.now();
  grid.queryRadius(mouse.x, mouse.y, QUERY_RADIUS, nearby);
  const queryMs = performance.now() - t1;

  ctx.clearRect(0, 0, WORLD_W, WORLD_H);

  ctx.fillStyle = '#444';
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
  }

  ctx.fillStyle = '#00ffcc';
  for (let i = 0; i < nearby.length; i++) {
    const e = nearby[i];
    ctx.fillRect(e.x - 2, e.y - 2, 4, 4);
  }

  ctx.strokeStyle = '#00ffcc';
  ctx.strokeRect(
    mouse.x - QUERY_RADIUS,
    mouse.y - QUERY_RADIUS,
    QUERY_RADIUS * 2,
    QUERY_RADIUS * 2
  );

  const skipped = ENTITY_COUNT - cellTransfers;
  out.textContent =
    `Entities: ${ grid.size } | Active Cells: ${ grid.cellCount }\n` +
    `Update(5000): ${ updateMs.toFixed(2) } ms | Cell transfers: ${ cellTransfers } | Early-exit skipped: ${ skipped }\n` +
    `Query candidates: ${ nearby.length } (${ queryMs.toFixed(3) } ms, 0 allocations)`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);