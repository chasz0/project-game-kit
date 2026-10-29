import { steering } from '@ai/steering.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

let mode = 'orbit';
const target = { x: canvas.width / 2, y: canvas.height / 2, vx: 0, vy: 0 };
const force = { x: 0, y: 0 };
const sepForce = { x: 0, y: 0 };

const agents = Array.from({ length: 120 }, (_, i) => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  vx: (Math.random() - 0.5) * 120,
  vy: (Math.random() - 0.5) * 120,
  maxSpeed: 170 + (i % 40),
  maxForce: 420
}));

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  target.x = e.clientX - rect.left;
  target.y = e.clientY - rect.top;
});

const setMode = (m) => { mode = m; };
document.getElementById('modeSeek').addEventListener('click', () => setMode('seek'));
document.getElementById('modeOrbit').addEventListener('click', () => setMode('orbit'));
document.getElementById('modeArrive').addEventListener('click', () => setMode('arrive'));
document.getElementById('modeFlee').addEventListener('click', () => setMode('flee'));
document.getElementById('modeFlock').addEventListener('click', () => setMode('flock'));

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  const activeCount = mode === 'flock' ? agents.length : 30;

  for (let i = 0; i < activeCount; i++) {
    const a = agents[i];

    if (mode === 'seek') {
      steering.seek(a, target, a.maxSpeed, force);
    } else if (mode === 'orbit') {
      steering.orbit(a, target, 95, a.maxSpeed, i % 2 === 0, force);
    } else if (mode === 'arrive') {
      steering.arrive(a, target, a.maxSpeed, 110, force);
    } else if (mode === 'flee') {
      steering.flee(a, target, a.maxSpeed, force);
    } else {
      steering.flock(a, agents, { maxSpeed: a.maxSpeed }, force);
    }

    if (mode !== 'flock') {
      steering.separate(a, agents.slice(0, activeCount), 22, a.maxSpeed, sepForce);
      force.x += sepForce.x * 1.4;
      force.y += sepForce.y * 1.4;
    }

    steering.applyForce(a, force, a.maxForce, a.maxSpeed, dt);

    if (a.x < 0) a.x += canvas.width;
    if (a.x > canvas.width) a.x -= canvas.width;
    if (a.y < 0) a.y += canvas.height;
    if (a.y > canvas.height) a.y -= canvas.height;
  }

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (mode === 'orbit' || mode === 'arrive') {
    ctx.strokeStyle = '#233452';
    ctx.beginPath();
    ctx.arc(target.x, target.y, mode === 'orbit' ? 95 : 110, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#d9b978';
  ctx.beginPath();
  ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f3ead3';
  for (let i = 0; i < activeCount; i++) {
    const a = agents[i];
    const angle = Math.atan2(a.vy, a.vx);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  out.textContent = `Active Mode: ${mode.toUpperCase()} | Agents: ${activeCount} | Target: (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`;
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);