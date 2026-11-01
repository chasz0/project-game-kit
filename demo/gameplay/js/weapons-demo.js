import { WeaponSystem } from '@gameplay/weapons.js';
import { SpatialHash } from '@gameplay/spatialHash.js';
import { Stats } from '@gameplay/stats.js';
import { FloatingTextSystem } from '@ui/floatingText.js';
import { input } from '@core/input.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const weapons = new WeaponSystem();
const grid = new SpatialHash(64);
const combatText = new FloatingTextSystem();

const player = { x: canvas.width / 2, y: canvas.height / 2, r: 12 };
let mode = 'spread';
let orbitersOn = true;
let fireTimer = 0;
let totalHits = 0;

const enemies = Array.from({ length: 22 }, () => ({
  x: Math.random() * (canvas.width - 40) + 20,
  y: Math.random() * (canvas.height - 40) + 20,
  r: 10,
  stats: new Stats({ maxHealth: 60 })
}));

enemies.forEach((e) => grid.insert(e));

const onEnemyHit = (enemy, source) => {
  totalHits++;
  const dmg = source.damage ?? 15;
  combatText.spawn(enemy.x, enemy.y - enemy.r, `-${dmg}`, { color: '#f3ead3' });
  if (enemy.stats.takeDamage(dmg)) {
    enemy.stats.revive(60);
    enemy.x = Math.random() < 0.5 ? 24 : canvas.width - 24;
    enemy.y = Math.random() * (canvas.height - 40) + 20;
    grid.update(enemy);
  }
};

weapons.setOrbiters(player, {
  count: 3,
  radius: 54,
  speed: 3.4,
  damage: 12,
  hitCooldown: 350,
  color: '#d9b978'
});

document.querySelectorAll('#weaponBar button[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('#weaponBar button[data-mode]').forEach((b) =>
      b.classList.toggle('active', b === btn)
    );
  });
});

document.getElementById('btnOrbiters').addEventListener('click', (e) => {
  orbitersOn = !orbitersOn;
  e.target.textContent = `Toggle Guardian Orbiters: ${orbitersOn ? 'ON' : 'OFF'}`;
  if (orbitersOn) {
    weapons.setOrbiters(player, { count: 3, radius: 54, speed: 3.4, damage: 12, color: '#d9b978' });
  } else {
    weapons.removeOrbiters(player);
  }
});

const spawnFrostZone = (x, y) => {
  weapons.spawnZone(x, y, {
    r: 68,
    duration: 4000,
    tickInterval: 450,
    color: '#78b0d9',
    onTick: (enemy) => onEnemyHit(enemy, { damage: 8 })
  });
};

document.getElementById('btnZone').addEventListener('click', () => {
  spawnFrostZone(input.mouse.x || 280, input.mouse.y || 170);
});

canvas.addEventListener('mousedown', () => {
  spawnFrostZone(input.mouse.x, input.mouse.y);
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  const aimAngle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);

  fireTimer -= dt;
  if (fireTimer <= 0) {
    if (mode === 'spread') {
      fireTimer = 420;
      weapons.fire(player.x, player.y, aimAngle, {
        count: 5, spread: 0.55, speed: 460, damage: 14, behavior: 'linear', color: '#f3ead3'
      });
    } else if (mode === 'ricochet') {
      fireTimer = 500;
      weapons.fire(player.x, player.y, aimAngle, {
        count: 1, speed: 520, damage: 22, behavior: 'ricochet', bounces: 4, bounceRange: 190, color: '#78b0d9'
      });
    } else if (mode === 'boomerang') {
      fireTimer = 680;
      weapons.fire(player.x, player.y, aimAngle, {
        count: 2, spread: 0.35, speed: 420, life: 1300, r: 7, damage: 18, behavior: 'boomerang', owner: player, color: '#d9b978'
      });
    } else if (mode === 'homing') {
      fireTimer = 480;
      weapons.fire(player.x, player.y, aimAngle, {
        count: 3, spread: 0.9, speed: 340, life: 1800, damage: 16, behavior: 'homing', turnRate: 7.5, homingRange: 300, color: '#6bc98f'
      });
    }
  }

  for (const e of enemies) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 42) {
      e.x += (dx / d) * 32 * (dt / 1000);
      e.y += (dy / d) * 32 * (dt / 1000);
      grid.update(e);
    }
  }

  weapons.update(dt, {
    spatialHash: grid,
    boundsHalf: 2000,
    onHit: onEnemyHit
  });
  combatText.update(dt);

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#c96b6b';
  for (const e of enemies) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }

  weapons.render(ctx);

  ctx.fillStyle = '#f3ead3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  combatText.render(ctx);

  out.textContent =
    `Active Weapon: ${mode.toUpperCase()} | Projectiles: ${weapons.activeProjectileCount} | Hazard Zones: ${weapons.activeZoneCount}\n` +
    `Total Swarm Hits: ${totalHits} | Aim with mouse, click canvas to drop a Frost Hazard Zone.`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);