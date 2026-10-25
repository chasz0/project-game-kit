import { Camera } from '@gameplay/camera.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const cam = new Camera(canvas.width, canvas.height);
const mouseScreen = { x: canvas.width / 2, y: canvas.height / 2 };
const target = { x: 200, y: 150 };

document.getElementById('shakeBtn').addEventListener('click', () => {
  cam.shake(300, 15);
});

document.getElementById('zoomInBtn').addEventListener('click', () => {
  cam.setZoom(cam.zoom + 0.25);
});

document.getElementById('zoomOutBtn').addEventListener('click', () => {
  cam.setZoom(cam.zoom - 0.25);
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseScreen.x = e.clientX - rect.left;
  mouseScreen.y = e.clientY - rect.top;
});

let lastTime = performance.now();

const drawGrid = () => {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (let x = -500; x < 1000; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, -500); ctx.lineTo(x, 1000); ctx.stroke();
  }
  for (let y = -500; y < 1000; y += 50) {
    ctx.beginPath(); ctx.moveTo(-500, y); ctx.lineTo(1000, y); ctx.stroke();
  }
};

const loop = (time) => {
  const dt = time - lastTime;
  lastTime = time;

  cam.screenToWorld(mouseScreen.x, mouseScreen.y, target);
  cam.follow(target, 0.08, dt);
  cam.update(dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  cam.apply(ctx);
  drawGrid();

  ctx.fillStyle = '#00ffcc';
  ctx.beginPath();
  ctx.arc(target.x, target.y, 10, 0, Math.PI * 2);
  ctx.fill();

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);