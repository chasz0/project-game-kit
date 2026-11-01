import { StatusEffectManager } from '@gameplay/statusEffects.js';
import { Stats } from '@gameplay/stats.js';
import { FloatingTextSystem } from '@ui/floatingText.js';
import { input } from '@core/input.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');

const statuses = new StatusEffectManager();
const combatText = new FloatingTextSystem();
const effectScratch = [];

const player = {
  x: 140,
  y: 160,
  r: 14,
  stats: new Stats({ maxHealth: 100, speed: 185 })
};

const enemies = Array.from({ length: 8 }, (_, i) => ({
  x: 320 + (i % 4) * 52,
  y: 95 + Math.floor(i / 4) * 120,
  r: 13,
  dir: i % 2 === 0 ? 1 : -1,
  stats: new Stats({ maxHealth: 120, speed: 95 })
}));

statuses
  .define('burn', {
    duration: 3000,
    maxStacks: 5,
    tickInterval: 500,
    color: '#c96b6b',
    onTick: (target, inst) => {
      const dmg = 4 * inst.stacks;
      target.stats.takeDamage(dmg);
      if (target.stats.dead) target.stats.revive(target.stats.maxHealth);
      combatText.spawn(target.x, target.y - target.r, `-${dmg} BURN`, { color: '#c96b6b' });
    }
  })
  .define('chill', {
    duration: 3500,
    maxStacks: 3,
    stat: 'speed',
    modType: 'percent',
    value: -0.25,
    color: '#78b0d9'
  })
  .define('freeze', {
    duration: 1800,
    control: 'stun',
    color: '#f3ead3'
  })
  .define('regen', {
    duration: 4000,
    tickInterval: 500,
    stat: 'speed',
    modType: 'percent',
    value: 0.5,
    color: '#6bc98f',
    onTick: (target) => {
      target.stats.heal(8);
      combatText.spawn(target.x, target.y - target.r, '+8 HP', { color: '#6bc98f' });
    }
  })
  .define('webbed', {
    duration: 2200,
    control: 'root',
    color: '#d9b978'
  });

input.bind('up', ['KeyW', 'ArrowUp']);
input.bind('down', ['KeyS', 'ArrowDown']);
input.bind('left', ['KeyA', 'ArrowLeft']);
input.bind('right', ['KeyD', 'ArrowRight']);

document.getElementById('btnBurn').addEventListener('click', () => {
  enemies.forEach((e) => statuses.apply(e, 'burn', { stacks: 1 }));
});

document.getElementById('btnChill').addEventListener('click', () => {
  enemies.forEach((e) => statuses.apply(e, 'chill', { stacks: 1 }));
});

document.getElementById('btnFreeze').addEventListener('click', () => {
  enemies.forEach((e) => statuses.apply(e, 'freeze'));
});

document.getElementById('btnPlayerBuff').addEventListener('click', () => {
  statuses.apply(player, 'regen');
});

document.getElementById('btnPlayerDebuff').addEventListener('click', () => {
  player.stats.takeDamage(25);
  statuses.apply(player, 'webbed');
  statuses.apply(player, 'burn', { stacks: 2 });
});

document.getElementById('btnCleanse').addEventListener('click', () => {
  statuses.clearAll();
});

canvas.addEventListener('mousedown', () => {
  for (const e of enemies) {
    if (Math.hypot(e.x - input.mouse.x, e.y - input.mouse.y) <= e.r + 16) {
      statuses.apply(e, 'burn', { stacks: 2 });
      statuses.apply(e, 'chill', { stacks: 1 });
    }
  }
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  statuses.update(dt);
  combatText.update(dt);

  if (!statuses.isRooted(player)) {
    const mx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const my = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      player.x = Math.max(20, Math.min(canvas.width - 20, player.x + (mx / len) * player.stats.get('speed') * (dt / 1000)));
      player.y = Math.max(20, Math.min(canvas.height - 20, player.y + (my / len) * player.stats.get('speed') * (dt / 1000)));
    }
  }

  for (const e of enemies) {
    if (!statuses.isStunned(e)) {
      e.y += e.dir * e.stats.get('speed') * (dt / 1000);
      if (e.y < 45) { e.y = 45; e.dir = 1; }
      if (e.y > canvas.height - 45) { e.y = canvas.height - 45; e.dir = -1; }
    }
  }

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawEntity = (ent, baseColor, label) => {
    ctx.fillStyle = statuses.isStunned(ent) ? '#78b0d9' : baseColor;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, ent.r, 0, Math.PI * 2);
    ctx.fill();

    if (statuses.isRooted(ent)) {
      ctx.strokeStyle = '#d9b978';
      ctx.lineWidth = 2;
      ctx.strokeRect(ent.x - ent.r - 3, ent.y - ent.r - 3, (ent.r + 3) * 2, (ent.r + 3) * 2);
    }

    statuses.getEffects(ent, effectScratch);
    for (let i = 0; i < effectScratch.length; i++) {
      const eff = effectScratch[i];
      const bx = ent.x - 16 + i * 12;
      const by = ent.y + ent.r + 6;
      ctx.fillStyle = eff.color;
      ctx.fillRect(bx, by, 10 * eff.ratio, 4);
    }

    ctx.fillStyle = '#8e9bb0';
    ctx.font = '10px monospace';
    ctx.fillText(label, ent.x - 16, ent.y - ent.r - 6);
  };

  drawEntity(player, '#f3ead3', `PLY ${Math.ceil(player.stats.health)}HP`);
  enemies.forEach((e, idx) => drawEntity(e, '#c96b6b', `E${idx + 1}`));

  combatText.render(ctx);

  const pEffects = statuses.getEffects(player).map((e) => `${e.id}(x${e.stacks})`).join(', ') || 'none';
  const eEffects = statuses.getEffects(enemies[0]).map((e) => `${e.id}(x${e.stacks})`).join(', ') || 'none';

  out.textContent =
    `Player Speed: ${player.stats.get('speed').toFixed(0)} | Rooted: ${statuses.isRooted(player)} | Effects: ${pEffects}\n` +
    `Swarm[0] Speed: ${enemies[0].stats.get('speed').toFixed(0)} | Stunned: ${statuses.isStunned(enemies[0])} | Effects: ${eEffects}\n` +
    `Move Player with WASD or click directly on any enemy circle to apply Burn + Chill.`;

  input.update();
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);