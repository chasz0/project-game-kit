import { Tilemap } from '@world/tilemap.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const TILE = 20;
const COLS = Math.floor(canvas.width / TILE);
const ROWS = Math.floor(canvas.height / TILE);

const map = new Tilemap({ cols: COLS, rows: ROWS, tileSize: TILE });
const player = { x: canvas.width / 2, y: canvas.height / 2, r: 11, speed: 170 };
const keys = {};
let mergedRects = [];
let showMerged = true;
let cullMode = false;
let mouseDown = false;
let paintId = 1;

const buildSampleWalls = () => {
  map.fill(0);
  for (let c = 0; c < COLS; c++) {
    map.set(c, 0, 1);
    map.set(c, ROWS - 1, 1);
  }
  for (let r = 0; r < ROWS; r++) {
    map.set(0, r, 1);
    map.set(COLS - 1, r, 1);
  }
  for (let c = 5; c < 11; c++) map.set(c, 5, 1);
  for (let r = 5; r < 12; r++) map.set(5, r, 1);
  for (let c = 16; c < 22; c++) {
    for (let r = 8; r < 13; r++) map.set(c, r, 1);
  }
  map.extractWallRects(mergedRects);
};

buildSampleWalls();

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

const handlePaint = (e) => {
  const rect = canvas.getBoundingClientRect();
  const cell = map.worldToTile(e.clientX - rect.left, e.clientY - rect.top);
  if (e.type === 'mousedown') {
    paintId = map.isSolid(cell.col, cell.row) ? 0 : 1;
  }
  map.set(cell.col, cell.row, paintId);
  map.extractWallRects(mergedRects);
};

canvas.addEventListener('mousedown', (e) => { mouseDown = true; handlePaint(e); });
window.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('mousemove', (e) => { if (mouseDown) handlePaint(e); });

document.getElementById('btnToggleMesh').addEventListener('click', (e) => {
  showMerged = !showMerged;
  e.target.textContent = `Show Greedy Merged Wall Rects: ${showMerged ? 'ON' : 'OFF'}`;
});

document.getElementById('btnToggleCull').addEventListener('click', (e) => {
  cullMode = !cullMode;
  e.target.textContent = `Simulate Small Viewport Culling: ${cullMode ? 'ON' : 'OFF'}`;
});

document.getElementById('btnClearMap').addEventListener('click', () => {
  map.fill(0);
  map.extractWallRects(mergedRects);
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime) / 1000;
  lastTime = now;

  const mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    player.x += (mx / len) * player.speed * dt;
    player.y += (my / len) * player.speed * dt;
  }

  const colResult = map.collideCircle(player);

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const viewW = cullMode ? 220 : canvas.width;
  const viewH = cullMode ? 160 : canvas.height;
  const viewX = cullMode ? player.x - viewW * 0.5 : 0;
  const viewY = cullMode ? player.y - viewH * 0.5 : 0;

  let solidTiles = 0;
  for (let i = 0; i < map.data.length; i++) {
    if (map.data[i] === 1) solidTiles++;
  }

  const drawnTiles = map.forEachVisible(viewX, viewY, viewW, viewH, (c, r, id, wx, wy) => {
    if (id === 1) {
      ctx.fillStyle = '#182236';
      ctx.fillRect(wx, wy, TILE - 1, TILE - 1);
    } else if (cullMode) {
      ctx.fillStyle = '#0d1320';
      ctx.fillRect(wx, wy, TILE - 1, TILE - 1);
    }
  });

  if (showMerged) {
    ctx.strokeStyle = '#d9b978';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < mergedRects.length; i++) {
      const b = mergedRects[i];
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
  }

  if (cullMode) {
    ctx.strokeStyle = '#f3ead3';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(viewX, viewY, viewW, viewH);
    ctx.setLineDash([]);
  }

  ctx.fillStyle = colResult.hit ? '#c96b6b' : '#f3ead3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  out.textContent =
    `Move Player: WASD / Arrows | Click & Drag on Canvas to Paint/Erase Solid Tiles\n` +
    `Total Grid Tiles: ${COLS * ROWS} | Drawn This Frame: ${drawnTiles} | Solid Tiles: ${solidTiles} -> Merged into ${mergedRects.length} Rects`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);