import { procgen } from '@world/procgen.js';
import { Tilemap } from '@world/tilemap.js';
import { Random } from '@core/random.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');
const seedInput = document.getElementById('seedInput');

const TILE = 10;
const COLS = Math.floor(canvas.width / TILE);
const ROWS = Math.floor(canvas.height / TILE);

let currentAlgo = 'cave';
const tilemap = new Tilemap({ cols: COLS, rows: ROWS, tileSize: TILE });
const mergedWalls = [];

const generate = () => {
  const rng = new Random(seedInput.value.trim() || 'default');
  const randFn = () => rng.next();
  const t0 = performance.now();

  let result;
  if (currentAlgo === 'cave') {
    result = procgen.cellularAutomata({
      cols: COLS,
      rows: ROWS,
      fillChance: 0.44,
      steps: 4,
      ensureConnected: true,
      rng: randFn
    });
  } else if (currentAlgo === 'dungeon') {
    result = procgen.dungeonRooms({
      cols: COLS,
      rows: ROWS,
      roomCount: 11,
      minSize: 5,
      maxSize: 10,
      corridorWidth: 2,
      rng: randFn
    });
  } else {
    result = procgen.arenaPillars({
      cols: COLS,
      rows: ROWS,
      pillarCount: 16,
      minSize: 3,
      maxSize: 6,
      corridorGap: 3,
      clearCenterRadius: 5,
      rng: randFn
    });
  }

  tilemap.loadGrid(result.grid);
  tilemap.extractWallRects(mergedWalls);
  const elapsed = performance.now() - t0;

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let openCount = 0;
  tilemap.forEachVisible(0, 0, canvas.width, canvas.height, (c, r, id, wx, wy) => {
    if (id === 1) {
      ctx.fillStyle = '#182236';
      ctx.fillRect(wx, wy, TILE, TILE);
    } else {
      openCount++;
    }
  });

  ctx.strokeStyle = 'rgba(217, 185, 120, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < mergedWalls.length; i++) {
    const b = mergedWalls[i];
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  }

  const spawnWorld = tilemap.tileToWorld(result.spawn.col, result.spawn.row);
  ctx.fillStyle = '#f3ead3';
  ctx.beginPath();
  ctx.arc(spawnWorld.x, spawnWorld.y, 5, 0, Math.PI * 2);
  ctx.fill();

  const total = COLS * ROWS;
  out.textContent =
    `Algorithm: ${currentAlgo.toUpperCase()} | Seed: "${seedInput.value}" | Generated in ${elapsed.toFixed(2)} ms\n` +
    `Grid: ${COLS}x${ROWS} (${total} tiles) | Walkable Floor: ${openCount} (${((openCount / total) * 100).toFixed(1)}%)\n` +
    `Greedy-Merged Wall Boxes: ${mergedWalls.length} | Spawn Tile: (${result.spawn.col}, ${result.spawn.row})`;
};

document.querySelectorAll('#algoBar button[data-algo]').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentAlgo = btn.dataset.algo;
    document.querySelectorAll('#algoBar button[data-algo]').forEach((b) =>
      b.classList.toggle('active', b === btn)
    );
    generate();
  });
});

document.getElementById('btnRoll').addEventListener('click', () => {
  seedInput.value = `map-${Math.random().toString(36).slice(2, 7)}`;
  generate();
});

seedInput.addEventListener('input', generate);
generate();