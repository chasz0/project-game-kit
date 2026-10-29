import { lineOfSight } from '@ai/lineOfSight.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const sentry = { x: 270, y: 170, angle: 0, range: 210, fov: Math.PI * 0.45 };
const player = { x: 420, y: 120 };
const hitInfo = { t: 0, x: 0, y: 0, nx: 0, ny: 0, obstacle: null };

const obstacles = [
  { x: 110, y: 60, w: 70, h: 110 },
  { x: 340, y: 200, w: 110, h: 65 },
  { x: 210, y: 260, r: 32 },
  { x: 380, y: 85, r: 28 }
];

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  player.x = e.clientX - rect.left;
  player.y = e.clientY - rect.top;
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  sentry.angle += dt * 0.85;

  const hasLOS = lineOfSight.hasLineOfSight(sentry, player, obstacles);
  const spottedInCone = lineOfSight.inVisionCone(
    sentry,
    sentry.angle,
    player,
    sentry.range,
    sentry.fov,
    obstacles
  );
  const rayHit = lineOfSight.raycast(sentry.x, sentry.y, player.x, player.y, obstacles, hitInfo);

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw sentry vision cone
  ctx.fillStyle = spottedInCone ? 'rgba(201, 107, 107, 0.22)' : 'rgba(243, 234, 211, 0.07)';
  ctx.beginPath();
  ctx.moveTo(sentry.x, sentry.y);
  ctx.arc(sentry.x, sentry.y, sentry.range, sentry.angle - sentry.fov / 2, sentry.angle + sentry.fov / 2);
  ctx.closePath();
  ctx.fill();

  // Draw obstacles
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

  // Draw ray line from sentry to player (or first wall hit)
  ctx.strokeStyle = hasLOS ? '#d9b978' : '#c96b6b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sentry.x, sentry.y);
  ctx.lineTo(rayHit ? rayHit.x : player.x, rayHit ? rayHit.y : player.y);
  ctx.stroke();

  if (rayHit) {
    ctx.fillStyle = '#c96b6b';
    ctx.beginPath();
    ctx.arc(rayHit.x, rayHit.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw surface normal at impact point
    ctx.strokeStyle = '#f3ead3';
    ctx.beginPath();
    ctx.moveTo(rayHit.x, rayHit.y);
    ctx.lineTo(rayHit.x + rayHit.nx * 18, rayHit.y + rayHit.ny * 18);
    ctx.stroke();
  }

  // Draw sentry & player
  ctx.fillStyle = '#f3ead3';
  ctx.beginPath();
  ctx.arc(sentry.x, sentry.y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = spottedInCone ? '#c96b6b' : '#d9b978';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
  ctx.fill();

  out.textContent =
    `Direct Line of Sight: ${hasLOS} | Inside Rotating Vision Cone: ${spottedInCone}\n` +
    (rayHit
      ? `Raycast Blocked at (${rayHit.x.toFixed(0)}, ${rayHit.y.toFixed(0)}) | Normal: (${rayHit.nx.toFixed(2)}, ${rayHit.ny.toFixed(2)})`
      : `Raycast Clear to Target (${player.x.toFixed(0)}, ${player.y.toFixed(0)})`);

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);