import { lineOfSight } from '@ai/lineOfSight.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const rngFov = document.getElementById('rngFov');
const rngRange = document.getElementById('rngRange');
const rngRays = document.getElementById('rngRays');
const chkRays = document.getElementById('chkRays');
const chkSentry = document.getElementById('chkSentry');

const player = { x: 140, y: 175, angle: 0, speed: 165 };
const mouse = { x: 320, y: 175 };
const keys = {};
let draggingPlayer = false;

const sentry = { x: 440, y: 80, angle: 2.2, range: 190, fov: Math.PI * 0.4 };
const visionPoly = [];
const visibleTargets = [];
const laserHit = { t: 1, x: 0, y: 0, nx: 0, ny: 0, obstacle: null };

let obstacles = [
  { x: 210, y: 55, w: 45, h: 110 },
  { x: 230, y: 220, w: 120, h: 45 },
  { x: 370, y: 130, r: 30 },
  { x: 100, y: 265, r: 26 }
];

const enemies = Array.from({ length: 7 }, (_, i) => ({
  id: i + 1,
  x: 80 + ((i * 73) % 400),
  y: 50 + ((i * 97) % 250),
  vx: (i % 2 === 0 ? 1 : -1) * 45,
  vy: (i % 3 === 0 ? 1 : -1) * 45,
  r: 7
}));

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  player.x = e.clientX - rect.left;
  player.y = e.clientY - rect.top;
  draggingPlayer = true;
});
window.addEventListener('mouseup', () => { draggingPlayer = false; });

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  if (draggingPlayer) {
    player.x = mouse.x;
    player.y = mouse.y;
  }
});

document.getElementById('btn360').addEventListener('click', () => {
  rngFov.value = Number(rngFov.value) >= 360 ? 90 : 360;
});

document.getElementById('btnRandomWalls').addEventListener('click', () => {
  obstacles = [
    { x: 160 + Math.random() * 80, y: 40 + Math.random() * 60, w: 50, h: 100 },
    { x: 240 + Math.random() * 90, y: 190 + Math.random() * 60, w: 110, h: 45 },
    { x: 340 + Math.random() * 80, y: 90 + Math.random() * 120, r: 28 },
    { x: 90 + Math.random() * 70, y: 220 + Math.random() * 70, r: 24 }
  ];
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime) / 1000;
  lastTime = now;

  const fovDeg = Number(rngFov.value);
  const fovRad = (fovDeg * Math.PI) / 180;
  const maxRange = Number(rngRange.value);
  const rayCount = Number(rngRays.value);

  document.getElementById('valFov').textContent = fovDeg;
  document.getElementById('valRange').textContent = maxRange;
  document.getElementById('valRays').textContent = rayCount;

  // WASD Player Movement
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    player.x = Math.max(12, Math.min(canvas.width - 12, player.x + (mx / len) * player.speed * dt));
    player.y = Math.max(12, Math.min(canvas.height - 12, player.y + (my / len) * player.speed * dt));
  }

  player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  sentry.angle += dt * 0.7;

  // Patrol enemies
  for (const e of enemies) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.x < 15 || e.x > canvas.width - 15) e.vx *= -1;
    if (e.y < 15 || e.y > canvas.height - 15) e.vy *= -1;
  }

  // Compute Player Visibility Polygon & filter visible enemies
  lineOfSight.castVisionPolygon(player, player.angle, fovRad, maxRange, rayCount, obstacles, visionPoly);
  lineOfSight.filterVisible(player, player.angle, enemies, maxRange, fovRad, obstacles, visibleTargets);

  // Check if AI Sentry spots Player
  const sentrySpotsPlayer = chkSentry.checked && lineOfSight.inVisionCone(
    sentry,
    sentry.angle,
    player,
    sentry.range,
    sentry.fov,
    obstacles
  );

  // Direct aim raycast from player toward mouse
  const aimEndX = player.x + Math.cos(player.angle) * maxRange;
  const aimEndY = player.y + Math.sin(player.angle) * maxRange;
  const aimHit = lineOfSight.raycast(player.x, player.y, aimEndX, aimEndY, obstacles, laserHit);

  // Render Fog-of-War background
  ctx.fillStyle = '#06080e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Player Vision Polygon
  if (visionPoly.length > 1) {
    ctx.fillStyle = 'rgba(243, 234, 211, 0.14)';
    ctx.beginPath();
    if (fovDeg < 360) ctx.moveTo(player.x, player.y);
    else ctx.moveTo(visionPoly[0].x, visionPoly[0].y);
    for (let i = 0; i < visionPoly.length; i++) {
      ctx.lineTo(visionPoly[i].x, visionPoly[i].y);
    }
    ctx.closePath();
    ctx.fill();

    if (chkRays.checked) {
      ctx.strokeStyle = 'rgba(243, 234, 211, 0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < visionPoly.length; i++) {
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(visionPoly[i].x, visionPoly[i].y);
        ctx.stroke();
      }
    }
  }

  // Draw AI Sentry Cone
  if (chkSentry.checked) {
    ctx.fillStyle = sentrySpotsPlayer ? 'rgba(201, 107, 107, 0.28)' : 'rgba(217, 185, 120, 0.09)';
    ctx.beginPath();
    ctx.moveTo(sentry.x, sentry.y);
    ctx.arc(sentry.x, sentry.y, sentry.range, sentry.angle - sentry.fov / 2, sentry.angle + sentry.fov / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#d9b978';
    ctx.beginPath();
    ctx.arc(sentry.x, sentry.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Obstacles
  ctx.fillStyle = '#182236';
  ctx.strokeStyle = '#233452';
  ctx.lineWidth = 2;
  for (const obs of obstacles) {
    if (obs.r !== undefined) {
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }
  }

  // Draw Enemies (Full highlight when in Player LOS, dim radar outline when hidden in fog/behind wall)
  for (const e of enemies) {
    const isVisible = visibleTargets.includes(e);
    if (isVisible) {
      ctx.fillStyle = '#c96b6b';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#233452';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Draw Player center aim laser
  ctx.strokeStyle = '#d9b978';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(aimHit ? aimHit.x : aimEndX, aimHit ? aimHit.y : aimEndY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (aimHit) {
    ctx.fillStyle = '#d9b978';
    ctx.beginPath();
    ctx.arc(aimHit.x, aimHit.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Player
  ctx.fillStyle = '#f3ead3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 8, 0, Math.PI * 2);
  ctx.fill();

  out.textContent =
    `Player Pos: (${player.x.toFixed(0)}, ${player.y.toFixed(0)}) [Move with WASD or Click-Drag, Aim with Mouse]\n` +
    `Enemies Revealed in Player LOS: ${visibleTargets.length} / ${enemies.length} | AI Sentry Alerted: ${sentrySpotsPlayer}`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);