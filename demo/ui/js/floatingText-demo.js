import { FloatingTextSystem } from '@ui/floatingText.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const combatText = new FloatingTextSystem({ maxItems: 200, preallocate: 50 });
const dummy = { x: canvas.width / 2, y: canvas.height / 2 + 20, r: 22 };

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const dmg = Math.floor(15 + Math.random() * 35);
  combatText.spawn(mx, my, `-${dmg}`, { color: '#f3ead3', jitterX: 10 });
});

document.getElementById('btnDmg').addEventListener('click', () => {
  combatText.spawn(dummy.x, dummy.y - dummy.r, '-24', { color: '#f3ead3', jitterX: 12 });
});

document.getElementById('btnCrit').addEventListener('click', () => {
  combatText.spawn(dummy.x, dummy.y - dummy.r - 6, '-95 CRIT!', {
    color: '#d9b978',
    fontSize: 14,
    duration: 800,
    vy: -55,
    jitterX: 14
  });
});

document.getElementById('btnHeal').addEventListener('click', () => {
  combatText.spawn(dummy.x, dummy.y - dummy.r, '+50 HP', {
    color: '#6bc98f',
    fontSize: 12,
    duration: 750
  });
});

document.getElementById('btnBurstText').addEventListener('click', () => {
  for (let i = 0; i < 15; i++) {
    combatText.spawn(
      dummy.x + (Math.random() - 0.5) * 60,
      dummy.y - dummy.r + (Math.random() - 0.5) * 30,
      `-${Math.floor(10 + Math.random() * 25)}`,
      { color: '#f3ead3', jitterX: 8 }
    );
  }
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  combatText.update(dt);

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#182236';
  ctx.strokeStyle = '#c96b6b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dummy.x, dummy.y, dummy.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  combatText.render(ctx);

  out.textContent =
    `Active Popups: ${combatText.activeCount} | Recycled in FreeList: ${combatText.pooledCount}\n` +
    `Click anywhere on canvas or press buttons above to test floating text pooling.`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);