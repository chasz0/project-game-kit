import { FlowField } from '@ai/flowField.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const CELL = 20;
const COLS = Math.floor(canvas.width / CELL);
const ROWS = Math.floor(canvas.height / CELL);

const field = new FlowField({ cols: COLS, rows: ROWS, cellSize: CELL });
const target = { x: canvas.width / 2, y: canvas.height / 2 };
const flowDir = { x: 0, y: 0 };

let activeTool = 'wall';
let mouseDown = false;

const rngCount = document.getElementById('rngCount');
const rngSpeed = document.getElementById('rngSpeed');
const chkVectors = document.getElementById('chkVectors');
const chkHeatmap = document.getElementById('chkHeatmap');

const agents = Array.from({ length: 1200 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  speedVar: 0.75 + Math.random() * 0.5
}));

const seedPillars = () => {
  field.clearWalls();
  for (let r = 3; r < ROWS - 3; r += 5) {
    for (let c = 4; c < COLS - 4; c += 6) {
      field.setObstacleRect(c * CELL, r * CELL, CELL * 2.5, CELL * 2.5);
    }
  }
  field.compute(target.x, target.y);
};

seedPillars();

document.querySelectorAll('#toolBar button[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeTool = btn.dataset.tool;
    document.querySelectorAll('#toolBar button[data-tool]').forEach((b) =>
      b.classList.toggle('active', b === btn)
    );
  });
});

const handlePointer = (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (activeTool !== 'goal' && !mouseDown) {
    target.x = mx;
    target.y = my;
  } else if (mouseDown) {
    const cell = field.worldToCell(mx, my);
    if (activeTool === 'wall') field.setWall(cell.col, cell.row, true);
    else if (activeTool === 'erase') field.setWall(cell.col, cell.row, false);
    else if (activeTool === 'goal') { target.x = mx; target.y = my; }
  }
  field.compute(target.x, target.y);
};

canvas.addEventListener('mousedown', (e) => { mouseDown = true; handlePointer(e); });
window.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('mousemove', handlePointer);

document.getElementById('clearWallsBtn').addEventListener('click', () => {
  field.clearWalls();
  field.compute(target.x, target.y);
});
document.getElementById('mazeBtn').addEventListener('click', seedPillars);

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime) / 1000;
  lastTime = now;

  const count = Number(rngCount.value);
  const baseSpeed = Number(rngSpeed.value);
  document.getElementById('valCount').textContent = count;
  document.getElementById('valSpeed').textContent = baseSpeed;

  for (let i = 0; i < count; i++) {
    const a = agents[i];
    field.sample(a.x, a.y, flowDir);
    a.x += flowDir.x * baseSpeed * a.speedVar * dt;
    a.y += flowDir.y * baseSpeed * a.speedVar * dt;

    if (Math.hypot(a.x - target.x, a.y - target.y) < 12) {
      a.x = Math.random() < 0.5 ? 8 : canvas.width - 8;
      a.y = Math.random() * canvas.height;
    }
  }

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const cx = c * CELL;
      const cy = r * CELL;

      if (field.walls[idx] === 1) {
        ctx.fillStyle = '#233452';
        ctx.fillRect(cx, cy, CELL - 1, CELL - 1);
      } else {
        if (chkHeatmap.checked && field.cost[idx] >= 0) {
          const alpha = Math.max(0.02, 0.22 - field.cost[idx] * 0.005);
          ctx.fillStyle = `rgba(40, 62, 100, ${alpha})`;
          ctx.fillRect(cx, cy, CELL - 1, CELL - 1);
        }
        if (chkVectors.checked) {
          const vx = field.dirX[idx];
          const vy = field.dirY[idx];
          if (vx !== 0 || vy !== 0) {
            ctx.strokeStyle = '#233452';
            ctx.beginPath();
            ctx.moveTo(cx + CELL / 2, cy + CELL / 2);
            ctx.lineTo(cx + CELL / 2 + vx * 7, cy + CELL / 2 + vy * 7);
            ctx.stroke();
          }
        }
      }
    }
  }

  ctx.fillStyle = '#f3ead3';
  for (let i = 0; i < count; i++) {
    ctx.fillRect(agents[i].x - 1.5, agents[i].y - 1.5, 3, 3);
  }

  ctx.fillStyle = '#d9b978';
  ctx.beginPath();
  ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
  ctx.fill();

  out.textContent =
    `Grid: ${COLS}x${ROWS} (${COLS * ROWS} cells) | Active Swarm: ${count} | Brush: ${activeTool.toUpperCase()}\n` +
    `Click & drag on canvas to use the selected brush.`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);