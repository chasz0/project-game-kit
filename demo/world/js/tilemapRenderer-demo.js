import { Tilemap } from '@world/tilemap.js';
import { TilemapRenderer } from '@world/tilemapRenderer.js';
import { procgen } from '@world/procgen.js';
import { Camera } from '@gameplay/camera.js';
import { input } from '@core/input.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const COLS = 64;
const ROWS = 64;
const TILE = 24;

const map = new Tilemap({ cols: COLS, rows: ROWS, tileSize: TILE });
const renderer = new TilemapRenderer(map, { chunkSize: 16 });
const cam = new Camera(canvas.width, canvas.height);

const player = { x: (COLS * TILE) / 2, y: (ROWS * TILE) / 2, speed: 260 };
let showChunkGrid = true;
let painting = false;
let paintVal = 1;

input.bind('up', ['KeyW', 'ArrowUp']);
input.bind('down', ['KeyS', 'ArrowDown']);
input.bind('left', ['KeyA', 'ArrowLeft']);
input.bind('right', ['KeyD', 'ArrowRight']);

const generateCave = () => {
  const cave = procgen.cellularAutomata({ cols: COLS, rows: ROWS, fillChance: 0.43, steps: 4 });
  map.loadGrid(cave.grid);
  renderer.invalidateAll();
  const spawn = map.tileToWorld(cave.spawn.col, cave.spawn.row);
  player.x = spawn.x;
  player.y = spawn.y;
};

generateCave();

const paintAtMouse = (e) => {
  const worldPos = cam.screenToWorld(input.mouse.x, input.mouse.y);
  const cell = map.worldToTile(worldPos.x, worldPos.y);
  if (!map.inBounds(cell.col, cell.row)) return;

  if (e.type === 'mousedown') {
    paintVal = map.isSolid(cell.col, cell.row) ? 0 : 1;
  }
  if (map.get(cell.col, cell.row) !== paintVal) {
    map.set(cell.col, cell.row, paintVal);
    renderer.invalidateTile(cell.col, cell.row);
  }
};

canvas.addEventListener('mousedown', (e) => { painting = true; paintAtMouse(e); });
window.addEventListener('mouseup', () => { painting = false; });
canvas.addEventListener('mousemove', (e) => { if (painting) paintAtMouse(e); });

document.getElementById('btnShowChunks').addEventListener('click', (e) => {
  showChunkGrid = !showChunkGrid;
  e.target.textContent = `Show 16x16 Chunk Borders: ${showChunkGrid ? 'ON' : 'OFF'}`;
});

document.getElementById('btnRegenCave').addEventListener('click', generateCave);

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  const mx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
  const my = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    player.x = Math.max(32, Math.min(map.width - 32, player.x + (mx / len) * player.speed * (dt / 1000)));
    player.y = Math.max(32, Math.min(map.height - 32, player.y + (my / len) * player.speed * (dt / 1000)));
  }

  cam.follow(player, 0.15, dt);
  cam.update(dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  cam.apply(ctx);

  const t0 = performance.now();
  renderer.render(ctx, cam.x, cam.y, canvas.width / cam.zoom, canvas.height / cam.zoom);
  const renderMs = performance.now() - t0;

  if (showChunkGrid) {
    const cp = renderer.chunkPixelSize;
    ctx.strokeStyle = 'rgba(217, 185, 120, 0.35)';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < renderer.chunkRows; r++) {
      for (let c = 0; c < renderer.chunkCols; c++) {
        ctx.strokeRect(c * cp, r * cp, cp, cp);
      }
    }
  }

  ctx.fillStyle = '#f3ead3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 9, 0, Math.PI * 2);
  ctx.fill();

  out.textContent =
    `Total Map: ${COLS}x${ROWS} (${COLS * ROWS} tiles) split into ${renderer.totalChunks} Offscreen Chunks (16x16 tiles each)\n` +
    `DrawImage Calls This Frame: ${renderer.chunksDrawnThisFrame} (${renderMs.toFixed(3)} ms) | Chunks Rebuilt This Frame: ${renderer.chunksRebuiltThisFrame}\n` +
    `Move Camera with WASD. Click & drag on canvas to paint/erase tiles and watch single-chunk invalidation.`;

  input.update();
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);