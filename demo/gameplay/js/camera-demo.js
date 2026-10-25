import { Camera } from '@gameplay/camera.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const cam = new Camera(canvas.width, canvas.height);
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
  // Transform mouse screen coords to world coords based on camera
  target.x = (e.clientX - rect.left) / cam.zoom + cam.x;
  target.y = (e.clientY - rect.top) / cam.zoom + cam.y;
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

  // Update camera logic
  cam.follow(target, 0.05); // 0.05 gives a smooth lerp delay
  cam.update(dt);

  // Render
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to clear screen
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  cam.apply(ctx); // Apply camera transforms before drawing world

  drawGrid();

  // Draw target
  ctx.fillStyle = '#00ffcc';
  ctx.beginPath();
  ctx.arc(target.x, target.y, 10, 0, Math.PI * 2);
  ctx.fill();

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);