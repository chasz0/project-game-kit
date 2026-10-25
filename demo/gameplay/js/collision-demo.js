import { collision } from '@gameplay/collision.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const wall = { x: 220, y: 140, w: 160, h: 120 };
const pillar = { x: 100, y: 200, r: 45 };
const triggerBox = { x: 450, y: 60, w: 90, h: 90 };

const cursor = { x: 300, y: 80, r: 28, w: 56, h: 56, asBox: false };
const manifold = { nx: 0, ny: 0, depth: 0 };

const bodies = Array.from({ length: 25 }, (_, i) => ({
  x: 260 + (i % 5) * 22,
  y: 40 + Math.floor(i / 5) * 22,
  r: 12,
}));

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  cursor.x = e.clientX - rect.left;
  cursor.y = e.clientY - rect.top;
});

canvas.addEventListener('click', () => {
  cursor.asBox = !cursor.asBox;
});

const getCursorObstacleHit = (cursorBox) => {
  if (!cursor.asBox) {
    return (
      collision.circleBoxInfo(cursor, wall, manifold) ||
      collision.circleCircleInfo(cursor, pillar, manifold)
    );
  }

  const wallHit = collision.boxBoxInfo(cursorBox, wall, manifold);
  if (wallHit) return wallHit;

  // circleBoxInfo pushes the circle out of the box; negate normal to push the box out of the pillar
  const pillarHit = collision.circleBoxInfo(pillar, cursorBox, manifold);
  if (pillarHit) {
    pillarHit.nx = -pillarHit.nx;
    pillarHit.ny = -pillarHit.ny;
    return pillarHit;
  }
  return null;
};

const loop = () => {
  let activeContacts = 0;
  const cursorBox = {
    x: cursor.x - cursor.w / 2,
    y: cursor.y - cursor.h / 2,
    w: cursor.w,
    h: cursor.h
  };

  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];

    const hitCursor = cursor.asBox
      ? collision.circleBoxInfo(a, cursorBox, manifold)
      : collision.circleCircleInfo(a, cursor, manifold);

    if (hitCursor) {
      a.x += hitCursor.nx * hitCursor.depth;
      a.y += hitCursor.ny * hitCursor.depth;
      activeContacts++;
    }

    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const hit = collision.circleCircleInfo(a, b, manifold);
      if (hit) {
        const half = hit.depth * 0.5;
        a.x += hit.nx * half;
        a.y += hit.ny * half;
        b.x -= hit.nx * half;
        b.y -= hit.ny * half;
        activeContacts++;
      }
    }

    const hitWall = collision.circleBoxInfo(a, wall, manifold);
    if (hitWall) {
      a.x += hitWall.nx * hitWall.depth;
      a.y += hitWall.ny * hitWall.depth;
    }

    const hitPillar = collision.circleCircleInfo(a, pillar, manifold);
    if (hitPillar) {
      a.x += hitPillar.nx * hitPillar.depth;
      a.y += hitPillar.ny * hitPillar.depth;
    }
  }

  const inTrigger = cursor.asBox
    ? collision.boxBox(cursorBox, triggerBox)
    : collision.circleBox(cursor, triggerBox);

  const obstacleHit = getCursorObstacleHit(cursorBox);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = inTrigger ? '#ff3366' : '#555';
  ctx.strokeRect(triggerBox.x, triggerBox.y, triggerBox.w, triggerBox.h);

  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.beginPath();
  ctx.arc(pillar.x, pillar.y, pillar.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#00ffcc';
  for (const b of bodies) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = obstacleHit || inTrigger ? '#ff3366' : '#fff';
  ctx.lineWidth = 2;
  if (cursor.asBox) {
    ctx.strokeRect(cursorBox.x, cursorBox.y, cursorBox.w, cursorBox.h);
  } else {
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, cursor.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (obstacleHit) {
    ctx.strokeStyle = '#00ffcc';
    ctx.setLineDash([4, 4]);
    const pushX = obstacleHit.nx * obstacleHit.depth;
    const pushY = obstacleHit.ny * obstacleHit.depth;

    if (cursor.asBox) {
      ctx.strokeRect(cursorBox.x + pushX, cursorBox.y + pushY, cursor.w, cursor.h);
    } else {
      ctx.beginPath();
      ctx.arc(cursor.x + pushX, cursor.y + pushY, cursor.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  out.textContent =
    `Cursor Shape: ${cursor.asBox ? 'Box' : 'Circle'} (Click to switch)\n` +
    `Trigger Zone Overlap: ${inTrigger}\n` +
    `Swarm Contacts Resolved This Frame: ${activeContacts}\n` +
    (obstacleHit
      ? `Obstacle Penetration: depth=${obstacleHit.depth.toFixed(1)}px, normal=(${obstacleHit.nx.toFixed(2)}, ${obstacleHit.ny.toFixed(2)})`
      : `Obstacle Penetration: none`);

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);