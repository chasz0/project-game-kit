import { steering } from '@ai/steering.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

let mode = 'flee';
const target = { x: canvas.width / 2, y: canvas.height / 2, vx: 0, vy: 0 };
const force = { x: 0, y: 0 };
const sepForce = { x: 0, y: 0 };

const rngRadius = document.getElementById('rngRadius');
const rngCount = document.getElementById('rngCount');
const rngSpeed = document.getElementById('rngSpeed');
const rngForce = document.getElementById('rngForce');
const rngSep = document.getElementById('rngSep');
const chkVectors = document.getElementById('chkVectors');
const chkBounce = document.getElementById('chkBounce');

const agents = Array.from({ length: 160 }, () => ({
  x: Math.random() * (canvas.width - 40) + 20,
  y: Math.random() * (canvas.height - 40) + 20,
  vx: 0,
  vy: 0,
  lastFx: 0,
  lastFy: 0
}));

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  target.x = e.clientX - rect.left;
  target.y = e.clientY - rect.top;
});

document.querySelectorAll('#modeBar button').forEach((btn) => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('#modeBar button').forEach((b) => b.classList.toggle('active', b === btn));
  });
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  const radius = Number(rngRadius.value);
  const count = Number(rngCount.value);
  const maxSpeed = Number(rngSpeed.value);
  const maxForce = Number(rngForce.value);
  const sepWeight = Number(rngSep.value);

  document.getElementById('valRadius').textContent = radius;
  document.getElementById('valCount').textContent = count;
  document.getElementById('valSpeed').textContent = maxSpeed;
  document.getElementById('valForce').textContent = maxForce;
  document.getElementById('valSep').textContent = sepWeight.toFixed(1);

  const activeSlice = agents.slice(0, count);
  let panickedCount = 0;

  for (let i = 0; i < count; i++) {
    const a = activeSlice[i];

    if (mode === 'flee') {
      const dSq = (a.x - target.x) ** 2 + (a.y - target.y) ** 2;
      if (dSq < radius * radius) panickedCount++;
      steering.flee(a, target, maxSpeed, radius, force);
    } else if (mode === 'seek') {
      steering.seek(a, target, maxSpeed, force);
    } else if (mode === 'orbit') {
      steering.orbit(a, target, radius, maxSpeed, i % 2 === 0, force);
    } else if (mode === 'arrive') {
      steering.arrive(a, target, maxSpeed, radius, force);
    } else if (mode === 'wander') {
      steering.wander(a, maxSpeed, { distance: 55, radius: 30, jitter: 0.3 }, force);
    } else {
      steering.flock(a, activeSlice, {
        neighborRadius: radius,
        separationRadius: 26,
        maxSpeed,
        sepWeight
      }, force);
    }

    if (mode !== 'flock' && sepWeight > 0) {
      steering.separate(a, activeSlice, 24, maxSpeed, sepForce);
      force.x += sepForce.x * sepWeight;
      force.y += sepForce.y * sepWeight;
    }

    a.lastFx = force.x;
    a.lastFy = force.y;
    steering.applyForce(a, force, maxForce, maxSpeed, dt);

    if (chkBounce.checked) {
      const pad = 10;
      if (a.x < pad) { a.x = pad; a.vx *= -0.6; }
      if (a.x > canvas.width - pad) { a.x = canvas.width - pad; a.vx *= -0.6; }
      if (a.y < pad) { a.y = pad; a.vy *= -0.6; }
      if (a.y > canvas.height - pad) { a.y = canvas.height - pad; a.vy *= -0.6; }
    } else {
      if (a.x < 0) a.x += canvas.width;
      if (a.x > canvas.width) a.x -= canvas.width;
      if (a.y < 0) a.y += canvas.height;
      if (a.y > canvas.height) a.y -= canvas.height;
    }
  }

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (chkVectors.checked && (mode === 'flee' || mode === 'orbit' || mode === 'arrive')) {
    ctx.strokeStyle = mode === 'flee' ? '#c96b6b' : '#233452';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (mode !== 'wander' && mode !== 'flock') {
    ctx.fillStyle = mode === 'flee' ? '#c96b6b' : '#d9b978';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < count; i++) {
    const a = activeSlice[i];
    const spd = Math.hypot(a.vx, a.vy);
    const angle = spd > 1 ? Math.atan2(a.vy, a.vx) : 0;

    if (chkVectors.checked && spd > 2) {
      ctx.strokeStyle = '#233452';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + a.vx * 0.15, a.y + a.vy * 0.15);
      ctx.stroke();
    }

    const isFleeing = mode === 'flee' && (a.x - target.x) ** 2 + (a.y - target.y) ** 2 < radius * radius;
    ctx.fillStyle = isFleeing ? '#c96b6b' : '#f3ead3';

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

  out.textContent =
    `Mode: ${mode.toUpperCase()} | Active Agents: ${count} | Radius: ${radius}px\n` +
    (mode === 'flee'
      ? `Agents inside Panic Radius: ${panickedCount} (Agents outside ${radius}px automatically brake to a stop)`
      : `Move mouse over canvas to steer agents. Adjust sliders above to tune forces live.`);

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);