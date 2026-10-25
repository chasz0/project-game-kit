import {
  Vec2,
  EventEmitter,
  GameLoop,
  InputManager,
  TimerManager,
  Random,
  Pool,
  SpatialHash,
  collision,
  Stats,
  StateMachine,
  Camera
} from '../../../index';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const telemetryEl = document.getElementById('telemetry');
const seedInput = document.getElementById('seedInput');
const autoFireBtn = document.getElementById('autoFireBtn');

const WORLD_SIZE = 1600;
const ARENA_HALF = WORLD_SIZE / 2;

const events = new EventEmitter();
const input = new InputManager(canvas);
const timer = new TimerManager();
const rng = new Random(seedInput.value);
const camera = new Camera(canvas.width, canvas.height);
const grid = new SpatialHash(72);
const fsm = new StateMachine();

input.bind('up', ['KeyW', 'ArrowUp']);
input.bind('down', ['KeyS', 'ArrowDown']);
input.bind('left', ['KeyA', 'ArrowLeft']);
input.bind('right', ['KeyD', 'ArrowRight']);
input.bind('shoot', ['Space', 'Mouse0']);
input.bind('dash', ['ShiftLeft', 'ShiftRight']);
input.bind('zoomIn', ['KeyE']);
input.bind('zoomOut', ['KeyQ']);

const manifold = { nx: 0, ny: 0, depth: 0 };
const queryScratch = [];
const worldMouse = new Vec2();
const moveDir = new Vec2();
const aimDir = new Vec2();

let autoFire = true;
let score = 0;
let kills = 0;
let wave = 1;
let xp = 0;
let level = 1;
let xpNext = 10;
let survivalTime = 0;
let dashCooldownRatio = 0;
let dashReady = true;
let canShoot = true;
let invulnFrames = false;

const activeEnemies = [];
const activeBullets = [];
const activeGems = [];
const activeParticles = [];
const obstacles = [];

const bulletPool = new Pool({
  create: () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 4, damage: 10, life: 0, pierce: 0 }),
  init: (b, x, y, vx, vy, damage, pierce) => {
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.damage = damage; b.pierce = pierce; b.life = 1100;
  },
  size: 100,
  maxSize: 600
});

const enemyPool = new Pool({
  create: () => ({
    x: 0, y: 0, r: 12, speed: 90, color: '#ff3366',
    xpValue: 2, scoreValue: 10,
    stats: new Stats({ maxHealth: 25, damage: 12 })
  }),
  init: (e, x, y, preset) => {
    e.x = x;
    e.y = y;
    e.r = preset.r;
    e.speed = preset.speed;
    e.color = preset.color;
    e.xpValue = preset.xp;
    e.scoreValue = preset.score;
    e.stats.base.maxHealth = preset.hp;
    e.stats.base.damage = preset.damage;
    e.stats.dead = false;
    e.stats.health = e.stats.maxHealth;
  },
  size: 150,
  maxSize: 1000
});

const gemPool = new Pool({
  create: () => ({ x: 0, y: 0, r: 5, value: 1 }),
  init: (g, x, y, value) => {
    g.x = x; g.y = y; g.value = value;
    g.r = value >= 5 ? 7 : 5;
  },
  size: 150,
  maxSize: 1000
});

const particlePool = new Pool({
  create: () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 300, color: '#fff', size: 3 }),
  init: (p, x, y, vx, vy, color, size, maxLife) => {
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.color = color; p.size = size; p.life = 0; p.maxLife = maxLife;
  },
  size: 200,
  maxSize: 1200
});

const player = {
  pos: new Vec2(0, 0),
  r: 14,
  stats: new Stats({
    maxHealth: 100,
    speed: 220,
    damage: 18,
    fireDelay: 190,
    pickupRadius: 85,
    pierce: 0
  })
};

const UPGRADE_POOL = [
  { id: 'rapid', title: 'Overclocked Receiver', desc: '-18% Fire Delay (Faster fire rate)', apply: (n) => player.stats.addModifier(`rapid_${n}`, 'fireDelay', 'percent', -0.18) },
  { id: 'caliber', title: 'Heavy Rounds', desc: '+30% Bullet Damage', apply: (n) => player.stats.addModifier(`cal_${n}`, 'damage', 'percent', 0.3) },
  { id: 'thruster', title: 'Ion Thrusters', desc: '+20% Movement Speed', apply: (n) => player.stats.addModifier(`spd_${n}`, 'speed', 'percent', 0.2) },
  { id: 'hull', title: 'Nanite Hull Plating', desc: '+40 Max HP & Heal 40 HP', apply: (n) => { player.stats.addModifier(`hp_${n}`, 'maxHealth', 'add', 40); player.stats.heal(40); } },
  { id: 'magnet', title: 'Attractor Coil', desc: '+50% XP Pickup Radius', apply: (n) => player.stats.addModifier(`mag_${n}`, 'pickupRadius', 'percent', 0.5) },
  { id: 'pierce', title: 'Tungsten Core', desc: '+1 Bullet Pierce', apply: (n) => player.stats.addModifier(`prc_${n}`, 'pierce', 'add', 1) }
];

const spawnBurst = (x, y, color, count = 8) => {
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const spd = rng.range(40, 180);
    activeParticles.push(
      particlePool.get(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, color, rng.range(2, 4), rng.range(180, 380))
    );
  }
};

events.on('enemyKilled', ({ enemy }) => {
  kills++;
  score += enemy.scoreValue;
  activeGems.push(gemPool.get(enemy.x, enemy.y, enemy.xpValue));
  spawnBurst(enemy.x, enemy.y, enemy.color, 9);
  if (enemy.r >= 18) camera.shake(140, 6);
});

events.on('playerDamaged', ({ amount }) => {
  camera.shake(220, 10);
  spawnBurst(player.pos.x, player.pos.y, '#ff3366', 14);
  if (player.stats.takeDamage(amount)) {
    fsm.change('gameover');
  }
});

events.on('xpGained', (amount) => {
  xp += amount;
  if (xp >= xpNext) {
    xp -= xpNext;
    level++;
    xpNext = Math.floor(xpNext * 1.35 + 6);
    fsm.change('levelup');
  }
});

const buildArenaFromSeed = () => {
  obstacles.length = 0;
  for (let i = 0; i < 14; i++) {
    const w = rng.int(70, 150);
    const h = rng.int(70, 150);
    const x = rng.int(-ARENA_HALF + 80, ARENA_HALF - w - 80);
    const y = rng.int(-ARENA_HALF + 80, ARENA_HALF - h - 80);
    if (Math.abs(x + w / 2) < 160 && Math.abs(y + h / 2) < 160) continue;
    obstacles.push({ x, y, w, h });
  }
};

const spawnWaveBatch = () => {
  const count = 6 + wave * 2;
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(460, 640);
    const x = Math.max(-ARENA_HALF + 30, Math.min(ARENA_HALF - 30, player.pos.x + Math.cos(angle) * dist));
    const y = Math.max(-ARENA_HALF + 30, Math.min(ARENA_HALF - 30, player.pos.y + Math.sin(angle) * dist));

    const roll = rng.next();
    let preset;
    if (roll < 0.15 && wave >= 2) {
      preset = { r: 20, speed: 68 + wave * 2, hp: 65 + wave * 18, damage: 22, color: '#ff9900', xp: 6, score: 35 };
    } else if (roll < 0.4) {
      preset = { r: 10, speed: 145 + wave * 3, hp: 16 + wave * 4, damage: 9, color: '#bd00ff', xp: 2, score: 15 };
    } else {
      preset = { r: 13, speed: 100 + wave * 2.5, hp: 26 + wave * 6, damage: 14, color: '#ff3366', xp: 1, score: 10 };
    }

    const enemy = enemyPool.get(x, y, preset);
    activeEnemies.push(enemy);
    grid.insert(enemy);
  }
};

const clearAllEntities = () => {
  while (activeEnemies.length) enemyPool.release(activeEnemies.pop());
  while (activeBullets.length) bulletPool.release(activeBullets.pop());
  while (activeGems.length) gemPool.release(activeGems.pop());
  while (activeParticles.length) particlePool.release(activeParticles.pop());
  grid.clear();
};

const resetRun = (seedStr) => {
  rng.setSeed(seedStr);
  timer.clear();
  clearAllEntities();

  score = 0;
  kills = 0;
  wave = 1;
  xp = 0;
  level = 1;
  xpNext = 10;
  survivalTime = 0;
  dashReady = true;
  dashCooldownRatio = 0;
  canShoot = true;
  invulnFrames = false;

  player.pos.set(0, 0);
  player.stats = new Stats({
    maxHealth: 100,
    speed: 220,
    damage: 18,
    fireDelay: 190,
    pickupRadius: 85,
    pierce: 0
  });

  camera.setZoom(1);
  camera.follow(player.pos, 1);

  buildArenaFromSeed();
  spawnWaveBatch();

  timer.every(3200, () => {
    spawnWaveBatch();
  });

  timer.every(12000, () => {
    wave++;
  });

  fsm.change('playing');
};

fsm.add('playing', {
  enter: () => {
    overlay.classList.add('hidden');
  },
  update: (dt) => {
    survivalTime += dt;
    timer.update(dt);

    if (input.isPressed('zoomIn')) camera.setZoom(Math.min(1.6, camera.zoom + 0.15));
    if (input.isPressed('zoomOut')) camera.setZoom(Math.max(0.65, camera.zoom - 0.15));

    // Player movement
    moveDir.set(
      (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0),
      (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0)
    );

    if (moveDir.magSq() > 0) {
      moveDir.normalize().mult(player.stats.get('speed') * (dt / 1000));
      player.pos.add(moveDir);
    }

    // Dash skill via Stats modifier + Timer tween
    if (input.isPressed('dash') && dashReady) {
      dashReady = false;
      invulnFrames = true;
      player.stats.addModifier('dashBoost', 'speed', 'percent', 1.6);
      spawnBurst(player.pos.x, player.pos.y, '#00ffcc', 12);

      timer.add(180, () => {
        player.stats.removeModifier('dashBoost');
        invulnFrames = false;
      });

      timer.add(
        1800,
        () => {
          dashReady = true;
          dashCooldownRatio = 0;
        },
        (progress) => {
          dashCooldownRatio = 1 - progress;
        }
      );
    }

    // Clamp player to arena & push out of obstacles
    player.pos.x = Math.max(-ARENA_HALF + player.r, Math.min(ARENA_HALF - player.r, player.pos.x));
    player.pos.y = Math.max(-ARENA_HALF + player.r, Math.min(ARENA_HALF - player.r, player.pos.y));

    const playerCircle = { x: player.pos.x, y: player.pos.y, r: player.r };
    for (let i = 0; i < obstacles.length; i++) {
      const hit = collision.circleBoxInfo(playerCircle, obstacles[i], manifold);
      if (hit) {
        player.pos.x += hit.nx * hit.depth;
        player.pos.y += hit.ny * hit.depth;
        playerCircle.x = player.pos.x;
        playerCircle.y = player.pos.y;
      }
    }

    // Aiming & shooting
    camera.screenToWorld(input.mouse.x, input.mouse.y, worldMouse);
    if ((autoFire || input.isDown('shoot')) && canShoot) {
      canShoot = false;
      Vec2.sub(worldMouse, player.pos, aimDir).normalize();
      const bulletSpeed = 560;
      activeBullets.push(
        bulletPool.get(
          player.pos.x + aimDir.x * (player.r + 4),
          player.pos.y + aimDir.y * (player.r + 4),
          aimDir.x * bulletSpeed,
          aimDir.y * bulletSpeed,
          player.stats.get('damage'),
          Math.floor(player.stats.get('pierce'))
        )
      );

      const delay = Math.max(55, player.stats.get('fireDelay'));
      timer.add(delay, () => {
        canShoot = true;
      });
    }

    // Update bullets & query SpatialHash for hits
    for (let i = activeBullets.length - 1; i >= 0; i--) {
      const b = activeBullets[i];
      b.x += b.vx * (dt / 1000);
      b.y += b.vy * (dt / 1000);
      b.life -= dt;

      let removeBullet = b.life <= 0 || Math.abs(b.x) > ARENA_HALF || Math.abs(b.y) > ARENA_HALF;

      if (!removeBullet) {
        for (let j = 0; j < obstacles.length; j++) {
          if (collision.circleBox(b, obstacles[j])) {
            removeBullet = true;
            spawnBurst(b.x, b.y, '#00ffcc', 4);
            break;
          }
        }
      }

      if (!removeBullet) {
        grid.queryRadius(b.x, b.y, b.r + 24, queryScratch);
        for (let j = 0; j < queryScratch.length; j++) {
          const e = queryScratch[j];
          if (!e.stats.dead && collision.circleCircle(b, e)) {
            if (e.stats.takeDamage(b.damage)) {
              events.emit('enemyKilled', { enemy: e });
            } else {
              spawnBurst(b.x, b.y, '#ffffff', 3);
            }
            if (b.pierce > 0) {
              b.pierce--;
            } else {
              removeBullet = true;
              break;
            }
          }
        }
      }

      if (removeBullet) {
        bulletPool.release(b);
        activeBullets.splice(i, 1);
      }
    }

    // Update enemies, flock separation via SpatialHash + collision manifolds
    for (let i = activeEnemies.length - 1; i >= 0; i--) {
      const e = activeEnemies[i];
      if (e.stats.dead) {
        grid.remove(e);
        enemyPool.release(e);
        activeEnemies.splice(i, 1);
        continue;
      }

      const dx = player.pos.x - e.x;
      const dy = player.pos.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      e.x += (dx / dist) * e.speed * (dt / 1000);
      e.y += (dy / dist) * e.speed * (dt / 1000);

      grid.queryRadius(e.x, e.y, e.r + 22, queryScratch);
      for (let j = 0; j < queryScratch.length; j++) {
        const other = queryScratch[j];
        if (other === e || other.stats.dead) continue;
        const hit = collision.circleCircleInfo(e, other, manifold);
        if (hit) {
          e.x += hit.nx * hit.depth * 0.5;
          e.y += hit.ny * hit.depth * 0.5;
        }
      }

      for (let j = 0; j < obstacles.length; j++) {
        const hit = collision.circleBoxInfo(e, obstacles[j], manifold);
        if (hit) {
          e.x += hit.nx * hit.depth;
          e.y += hit.ny * hit.depth;
        }
      }

      grid.update(e);

      if (!invulnFrames && collision.circleCircle(e, playerCircle)) {
        invulnFrames = true;
        events.emit('playerDamaged', { amount: e.stats.get('damage') });
        timer.add(450, () => {
          invulnFrames = false;
        });
      }
    }

    // Update XP gems
    const pickupR = player.stats.get('pickupRadius');
    const pickupRSq = pickupR * pickupR;
    for (let i = activeGems.length - 1; i >= 0; i--) {
      const g = activeGems[i];
      const dSq = Vec2.distanceSq(g, player.pos);
      if (dSq < pickupRSq) {
        const d = Math.sqrt(dSq) || 1;
        g.x += ((player.pos.x - g.x) / d) * 380 * (dt / 1000);
        g.y += ((player.pos.y - g.y) / d) * 380 * (dt / 1000);
      }
      if (collision.circleCircle(g, playerCircle)) {
        const val = g.value;
        gemPool.release(g);
        activeGems.splice(i, 1);
        events.emit('xpGained', val);
      }
    }

    // Update particles
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        particlePool.release(p);
        activeParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
    }

    camera.follow(player.pos, 0.12, dt);
    camera.update(dt);
  }
});

fsm.add('levelup', {
  enter: () => {
    overlay.classList.remove('hidden');
    const choices = [];
    const copy = UPGRADE_POOL.slice();
    for (let i = 0; i < 3; i++) {
      const idx = rng.int(0, copy.length - 1);
      choices.push(copy.splice(idx, 1)[0]);
    }

    overlay.innerHTML = `
      <h2>Level ${level} Reached!</h2>
      <p>Seeded upgrade roll — choose a modifier to apply to Player Stats:</p>
      <div class="upgrade-grid">
        ${choices.map((c, idx) => `
          <button class="upgrade-btn" data-idx="${idx}">
            <h4>${c.title}</h4>
            <span>${c.desc}</span>
          </button>
        `).join('')}
      </div>
    `;

    overlay.querySelectorAll('.upgrade-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pick = choices[Number(btn.dataset.idx)];
        pick.apply(level);
        fsm.change('playing');
      });
    });
  }
});

fsm.add('gameover', {
  enter: () => {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h2 style="color: #ff3366;">Run Terminated</h2>
      <p>
        Survived <strong>${(survivalTime / 1000).toFixed(1)}s</strong> on Seed <code>${seedInput.value}</code><br>
        Wave ${wave} &nbsp;|&nbsp; Kills: ${kills} &nbsp;|&nbsp; Score: ${score}
      </p>
      <div style="display:flex; gap:0.75rem;">
        <button id="retrySameBtn" class="primary">Replay Same Seed</button>
        <button id="retryNewBtn">Roll New Seed</button>
      </div>
    `;

    document.getElementById('retrySameBtn').addEventListener('click', () => resetRun(seedInput.value));
    document.getElementById('retryNewBtn').addEventListener('click', () => {
      seedInput.value = `run-${Math.random().toString(36).slice(2, 7)}`;
      resetRun(seedInput.value);
    });
  }
});

const render = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  camera.apply(ctx);

  // Arena grid & border
  ctx.strokeStyle = '#191d26';
  ctx.lineWidth = 1;
  for (let x = -ARENA_HALF; x <= ARENA_HALF; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, -ARENA_HALF); ctx.lineTo(x, ARENA_HALF); ctx.stroke();
  }
  for (let y = -ARENA_HALF; y <= ARENA_HALF; y += 80) {
    ctx.beginPath(); ctx.moveTo(-ARENA_HALF, y); ctx.lineTo(ARENA_HALF, y); ctx.stroke();
  }
  ctx.strokeStyle = '#ff3366';
  ctx.lineWidth = 3;
  ctx.strokeRect(-ARENA_HALF, -ARENA_HALF, WORLD_SIZE, WORLD_SIZE);

  // Obstacles
  ctx.fillStyle = '#1f2430';
  ctx.strokeStyle = '#323949';
  ctx.lineWidth = 2;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  // XP Gems
  for (let i = 0; i < activeGems.length; i++) {
    const g = activeGems[i];
    ctx.fillStyle = g.value >= 5 ? '#ffea00' : '#00ffcc';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bullets
  ctx.fillStyle = '#fff';
  for (let i = 0; i < activeBullets.length; i++) {
    const b = activeBullets[i];
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemies
  for (let i = 0; i < activeEnemies.length; i++) {
    const e = activeEnemies[i];
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles
  for (let i = 0; i < activeParticles.length; i++) {
    const p = activeParticles[i];
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Player pickup radius indicator
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(player.pos.x, player.pos.y, player.stats.get('pickupRadius'), 0, Math.PI * 2);
  ctx.stroke();

  // Player
  ctx.fillStyle = invulnFrames ? '#ffffff' : '#00ffcc';
  ctx.beginPath();
  ctx.arc(player.pos.x, player.pos.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  // Aim reticle in world space
  ctx.strokeStyle = '#00ffcc';
  ctx.beginPath();
  ctx.arc(worldMouse.x, worldMouse.y, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Screen-space HUD
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // HP Bar
  ctx.fillStyle = '#1f2430';
  ctx.fillRect(16, 16, 220, 16);
  ctx.fillStyle = '#ff3366';
  ctx.fillRect(16, 16, 220 * player.stats.healthRatio, 16);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`HP ${Math.ceil(player.stats.health)} / ${Math.ceil(player.stats.maxHealth)}`, 22, 28);

  // XP Bar
  ctx.fillStyle = '#1f2430';
  ctx.fillRect(16, 38, 220, 10);
  ctx.fillStyle = '#00ffcc';
  ctx.fillRect(16, 38, 220 * (xp / xpNext), 10);

  // Dash Cooldown Bar
  ctx.fillStyle = '#1f2430';
  ctx.fillRect(16, 54, 120, 6);
  ctx.fillStyle = dashReady ? '#00ffcc' : '#ff9900';
  ctx.fillRect(16, 54, 120 * (1 - dashCooldownRatio), 6);

  ctx.fillStyle = '#e6edf3';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`LVL ${level}  |  WAVE ${wave}  |  SCORE ${score}`, 255, 29);

  // Live 12-module telemetry readout
  telemetryEl.textContent =
    `=== 12-MODULE LIVE TELEMETRY ===\n` +
    `[GameLoop]     FPS: ${loop.fps} | Step: ${loop.step.toFixed(1)}ms\n` +
    `[StateMachine] State: "${fsm.currentStateName}"\n` +
    `[Random]       Seed: "${seedInput.value}"\n` +
    `[TimerManager] Active Timers: ${timer.timers.length}\n` +
    `[Vec2]         Player: (${player.pos.x.toFixed(0)}, ${player.pos.y.toFixed(0)})\n` +
    `[Camera]       Zoom: ${camera.zoom.toFixed(2)}x | Shake: ${camera.shakeTimer > 0 ? 'ACTIVE' : 'idle'}\n` +
    `[InputManager] Screen Mouse: (${input.mouse.x.toFixed(0)}, ${input.mouse.y.toFixed(0)})\n` +
    `[SpatialHash]  Tracked: ${grid.size} | Active Cells: ${grid.cellCount}\n` +
    `[Pool]         Enemies   use:${enemyPool.inUse} idle:${enemyPool.available}\n` +
    `               Bullets   use:${bulletPool.inUse} idle:${bulletPool.available}\n` +
    `               XP Gems   use:${gemPool.inUse} idle:${gemPool.available}\n` +
    `               Particles use:${particlePool.inUse} idle:${particlePool.available}\n` +
    `[Stats]        HP: ${Math.ceil(player.stats.health)}/${Math.ceil(player.stats.maxHealth)} | Spd: ${player.stats.get('speed').toFixed(0)}\n` +
    `               Dmg: ${player.stats.get('damage').toFixed(1)} | Modifiers: ${player.stats.modifiers.size}\n` +
    `[collision]    Broad+Narrow Manifold Active\n` +
    `[EventEmitter] Kills: ${kills} | Time: ${(survivalTime / 1000).toFixed(1)}s`;
};

const loop = new GameLoop(
  (dt) => {
    fsm.update(dt);
    input.update();
  },
  () => {
    render();
  },
  60
);

document.getElementById('replaySeedBtn').addEventListener('click', () => {
  resetRun(seedInput.value.trim() || 'default-seed');
});

document.getElementById('randomSeedBtn').addEventListener('click', () => {
  seedInput.value = `seed-${Math.random().toString(36).slice(2, 7)}`;
  resetRun(seedInput.value);
});

autoFireBtn.addEventListener('click', () => {
  autoFire = !autoFire;
  autoFireBtn.textContent = `Auto-Fire: ${autoFire ? 'ON' : 'OFF'}`;
});

resetRun(seedInput.value);
loop.start();