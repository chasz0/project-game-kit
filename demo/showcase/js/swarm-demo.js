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
} from '../../../index.js';

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
input.bind('pause', ['KeyP', 'Tab', 'Escape']);
input.bind('regen', ['KeyG']);
input.bind('zoomIn', ['KeyE']);
input.bind('zoomOut', ['KeyQ']);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});

const manifold = { nx: 0, ny: 0, depth: 0 };
const queryScratch = [];
const worldMouse = new Vec2();
const moveDir = new Vec2();
const aimDir = new Vec2(1, 0);

let autoFire = true;
let score = 0;
let kills = 0;
let wave = 1;
let xp = 0;
let level = 1;
let xpNext = 10;
let survivalTime = 0;
let mapCount = 1;
let dashCooldownRatio = 0;
let dashReady = true;
let canShoot = true;
let invulnFrames = false;

const activeEnemies = [];
const activeBullets = [];
const activeGems = [];
const activePickups = [];
const activeParticles = [];
const activeTexts = [];
const obstacles = [];
const floorDecals = [];

const acquiredUpgrades = new Map();
const activeTempBuffs = new Map();

const PICKUP_TYPES = {
  heal: {
    id: 'heal',
    shortName: 'MEDKIT',
    label: 'Medkit (+50 Health)',
    color: '#2ee66b',
    r: 11
  },
  haste: {
    id: 'haste',
    shortName: 'SPEED BOOST',
    label: 'Speed Boost (+55% Move Speed, 10s)',
    color: '#00e5ff',
    r: 11,
    duration: 10000,
    stat: 'speed',
    modType: 'percent',
    val: 0.55
  },
  overclock: {
    id: 'overclock',
    shortName: 'RAPID FIRE',
    label: 'Rapid Fire (+40% Attack Speed, 8s)',
    color: '#ff9900',
    r: 11,
    duration: 8000,
    stat: 'fireDelay',
    modType: 'percent',
    val: -0.4
  },
  nova: {
    id: 'nova',
    shortName: 'BOMB BLAST',
    label: 'Bomb (Area Damage)',
    color: '#ff3366',
    r: 12
  },
  vacuum: {
    id: 'vacuum',
    shortName: 'MAGNET',
    label: 'Magnet (Pull All XP)',
    color: '#ffea00',
    r: 11
  }
};

const bulletPool = new Pool({
  create: () => ({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, r: 4, damage: 10, life: 0, pierce: 0 }),
  init: (b, x, y, vx, vy, angle, damage, pierce) => {
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.angle = angle;
    b.damage = damage; b.pierce = pierce; b.life = 1150;
  },
  size: 100,
  maxSize: 600
});

const enemyPool = new Pool({
  create: () => ({
    x: 0, y: 0, r: 12, speed: 90, color: '#ff3366', shape: 'dart',
    angle: 0, spin: 0, xpValue: 2, scoreValue: 10,
    stats: new Stats({ maxHealth: 25, damage: 12 })
  }),
  init: (e, x, y, preset) => {
    e.x = x;
    e.y = y;
    e.r = preset.r;
    e.speed = preset.speed;
    e.color = preset.color;
    e.shape = preset.shape;
    e.angle = 0;
    e.spin = 0;
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
  create: () => ({ x: 0, y: 0, r: 5, value: 1, magnetized: false }),
  init: (g, x, y, value) => {
    g.x = x; g.y = y; g.value = value;
    g.r = value >= 5 ? 7 : 5;
    g.magnetized = false;
  },
  size: 150,
  maxSize: 1000
});

const pickupPool = new Pool({
  create: () => ({ x: 0, y: 0, r: 11, type: null, life: 0 }),
  init: (p, x, y, type) => {
    p.x = x; p.y = y; p.type = type; p.r = type.r; p.life = 18000;
  },
  size: 25,
  maxSize: 100
});

const particlePool = new Pool({
  create: () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 300, color: '#fff', size: 3 }),
  init: (p, x, y, vx, vy, color, size, maxLife) => {
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.color = color; p.size = size; p.life = 0; p.maxLife = maxLife;
  },
  size: 220,
  maxSize: 1200
});

const textPool = new Pool({
  create: () => ({ x: 0, y: 0, vy: -42, text: '', color: '#ffffff', life: 0, maxLife: 550 }),
  init: (t, x, y, text, color = '#ffffff', maxLife = 550) => {
    t.x = x;
    t.y = y;
    t.vy = -42;
    t.text = text;
    t.color = color;
    t.life = 0;
    t.maxLife = maxLife;
  },
  size: 60,
  maxSize: 300
});

const player = {
  pos: new Vec2(0, 0),
  r: 14,
  facing: 0,
  moveAngle: 0,
  stats: new Stats({
    maxHealth: 100,
    speed: 220,
    damage: 18,
    fireDelay: 190,
    bulletSpeed: 580,
    pickupRadius: 85,
    pierce: 0
  })
};

const UPGRADE_POOL = [
  {
    id: 'rapid',
    tag: 'Attack Speed',
    title: 'Rapid Fire',
    desc: '-16% Fire Delay (Shoot faster)',
    apply: (n) => player.stats.addModifier(`rapid_${n}`, 'fireDelay', 'percent', -0.16)
  },
  {
    id: 'caliber',
    tag: 'Offense',
    title: 'Damage Up',
    desc: '+28% Bullet Damage',
    apply: (n) => player.stats.addModifier(`cal_${n}`, 'damage', 'percent', 0.28)
  },
  {
    id: 'thruster',
    tag: 'Mobility',
    title: 'Move Speed',
    desc: '+18% Move Speed',
    apply: (n) => player.stats.addModifier(`spd_${n}`, 'speed', 'percent', 0.18)
  },
  {
    id: 'hull',
    tag: 'Defense',
    title: 'Max Health Up',
    desc: '+45 Max Health & Heal 45 HP',
    apply: (n) => {
      player.stats.addModifier(`hp_${n}`, 'maxHealth', 'add', 45);
      player.stats.heal(45);
    }
  },
  {
    id: 'magnet',
    tag: 'Utility',
    title: 'Magnet Range',
    desc: '+45% XP Pickup Range',
    apply: (n) => player.stats.addModifier(`mag_${n}`, 'pickupRadius', 'percent', 0.45)
  },
  {
    id: 'pierce',
    tag: 'Weapon',
    title: 'Piercing Shots',
    desc: '+1 Bullet Pierce',
    apply: (n) => player.stats.addModifier(`prc_${n}`, 'pierce', 'add', 1)
  },
  {
    id: 'rail',
    tag: 'Weapon',
    title: 'Fast Bullets',
    desc: '+25% Bullet Speed & +15% Damage',
    apply: (n) => {
      player.stats.addModifier(`rail_spd_${n}`, 'bulletSpeed', 'percent', 0.25);
      player.stats.addModifier(`rail_dmg_${n}`, 'damage', 'percent', 0.15);
    }
  },
  {
    id: 'glass',
    tag: 'Trade-off',
    title: 'Glass Cannon',
    desc: '+55% Damage, -25 Max Health',
    apply: (n) => {
      player.stats.addModifier(`glass_dmg_${n}`, 'damage', 'percent', 0.55);
      player.stats.addModifier(`glass_hp_${n}`, 'maxHealth', 'add', -25);
    }
  },
  {
    id: 'juggernaut',
    tag: 'Trade-off',
    title: 'Heavy Armor',
    desc: '+85 Max Health & Heal 50, -8% Move Speed',
    apply: (n) => {
      player.stats.addModifier(`jug_hp_${n}`, 'maxHealth', 'add', 85);
      player.stats.addModifier(`jug_spd_${n}`, 'speed', 'percent', -0.08);
      player.stats.heal(50);
    }
  },
  {
    id: 'stims',
    tag: 'Hybrid',
    title: 'Adrenaline',
    desc: '+12% Move Speed & -12% Fire Delay',
    apply: (n) => {
      player.stats.addModifier(`stim_spd_${n}`, 'speed', 'percent', 0.12);
      player.stats.addModifier(`stim_rof_${n}`, 'fireDelay', 'percent', -0.12);
    }
  },
  {
    id: 'splitter',
    tag: 'Trade-off',
    title: 'Multi-Pierce',
    desc: '+2 Bullet Pierce, -10% Damage',
    apply: (n) => {
      player.stats.addModifier(`flt_prc_${n}`, 'pierce', 'add', 2);
      player.stats.addModifier(`flt_dmg_${n}`, 'damage', 'percent', -0.1);
    }
  }
];

const spawnBurst = (x, y, color, count = 8, speedMax = 180) => {
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const spd = rng.range(40, speedMax);
    activeParticles.push(
      particlePool.get(
        x,
        y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color,
        rng.range(2.5, 4.5),
        rng.range(180, 420)
      )
    );
  }
};

const spawnFloatingText = (x, y, text, color = '#ffffff', duration = 550) => {
  const offsetX = rng.range(-8, 8);
  activeTexts.push(textPool.get(x + offsetX, y - 10, text, color, duration));
};

const applyTemporaryBuff = (type) => {
  const existing = activeTempBuffs.get(type.id);
  if (existing) {
    timer.cancel(existing.timerRef);
  }

  const modId = `temp_${type.id}`;
  player.stats.addModifier(modId, type.stat, type.modType, type.val);

  const state = {
    shortName: type.shortName,
    label: type.label,
    remainingMs: type.duration,
    durationMs: type.duration,
    color: type.color,
    timerRef: null
  };

  state.timerRef = timer.add(
    type.duration,
    () => {
      player.stats.removeModifier(modId);
      activeTempBuffs.delete(type.id);
    },
    (progress) => {
      state.remainingMs = Math.max(0, type.duration * (1 - progress));
    }
  );

  activeTempBuffs.set(type.id, state);
};

const spawnDisposablePickup = (x, y) => {
  const keys = Object.keys(PICKUP_TYPES);
  const type = PICKUP_TYPES[rng.choice(keys)];
  const p = pickupPool.get(x, y, type);
  for (let i = 0; i < obstacles.length; i++) {
    const hit = collision.circleBoxInfo(p, obstacles[i], manifold);
    if (hit) {
      p.x += hit.nx * hit.depth;
      p.y += hit.ny * hit.depth;
    }
  }
  activePickups.push(p);
};

events.on('enemyKilled', ({ enemy }) => {
  kills++;
  score += enemy.scoreValue;
  activeGems.push(gemPool.get(enemy.x, enemy.y, enemy.xpValue));
  spawnBurst(enemy.x, enemy.y, enemy.color, 10);

  if (rng.next() < 0.09) {
    spawnDisposablePickup(enemy.x, enemy.y);
  }
  if (enemy.r >= 18) camera.shake(140, 6);
});

events.on('pickupCollected', (pickup) => {
  const t = pickup.type;
  spawnBurst(pickup.x, pickup.y, t.color, 14, 220);

  if (t.id === 'heal') {
    player.stats.heal(50);
    spawnFloatingText(player.pos.x, player.pos.y - 16, '+50 HP', '#2ee66b', 750);
  } else if (t.id === 'haste' || t.id === 'overclock') {
    applyTemporaryBuff(t);
    spawnFloatingText(player.pos.x, player.pos.y - 16, t.shortName, t.color, 750);
  } else if (t.id === 'nova') {
    camera.shake(260, 12);
    spawnFloatingText(player.pos.x, player.pos.y - 16, 'BOMB BLAST!', '#ff3366', 750);
    grid.queryRadius(player.pos.x, player.pos.y, 320, queryScratch);
    for (let i = 0; i < queryScratch.length; i++) {
      const e = queryScratch[i];
      if (!e.stats.dead) {
        const dx = e.x - player.pos.x;
        const dy = e.y - player.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        e.x += (dx / d) * 45;
        e.y += (dy / d) * 45;
        grid.update(e);
        spawnFloatingText(e.x, e.y - e.r, '-80', '#ff9900');
        if (e.stats.takeDamage(80)) {
          events.emit('enemyKilled', { enemy: e });
        }
      }
    }
  } else if (t.id === 'vacuum') {
    spawnFloatingText(player.pos.x, player.pos.y - 16, 'MAGNET!', '#ffea00', 750);
    for (let i = 0; i < activeGems.length; i++) {
      activeGems[i].magnetized = true;
    }
  }
});

events.on('playerDamaged', ({ amount }) => {
  camera.shake(220, 10);
  spawnBurst(player.pos.x, player.pos.y, '#ff3366', 14);
  spawnFloatingText(player.pos.x, player.pos.y - 18, `-${Math.round(amount)} HP`, '#ff3366', 700);
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

const regenerateArena = (keepEntities = false) => {
  obstacles.length = 0;
  floorDecals.length = 0;

  for (let i = 0; i < 65; i++) {
    floorDecals.push({
      x: rng.int(-ARENA_HALF + 40, ARENA_HALF - 120),
      y: rng.int(-ARENA_HALF + 40, ARENA_HALF - 120),
      w: rng.int(40, 130),
      h: rng.int(24, 90),
      variant: rng.int(0, 2)
    });
  }

  for (let i = 0; i < 15; i++) {
    const w = rng.int(75, 160);
    const h = rng.int(75, 160);
    const x = rng.int(-ARENA_HALF + 80, ARENA_HALF - w - 80);
    const y = rng.int(-ARENA_HALF + 80, ARENA_HALF - h - 80);
    if (Math.abs(x + w / 2 - player.pos.x) < 160 && Math.abs(y + h / 2 - player.pos.y) < 160) {
      continue;
    }
    obstacles.push({ x, y, w, h });
  }

  if (!keepEntities) return;

  mapCount++;
  camera.shake(180, 7);
  spawnBurst(player.pos.x, player.pos.y, '#00ffcc', 18, 240);
  spawnFloatingText(player.pos.x, player.pos.y - 22, 'MAP REGENERATED', '#00ffcc', 800);

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

  for (let i = 0; i < activeEnemies.length; i++) {
    const e = activeEnemies[i];
    for (let j = 0; j < obstacles.length; j++) {
      const hit = collision.circleBoxInfo(e, obstacles[j], manifold);
      if (hit) {
        e.x += hit.nx * hit.depth;
        e.y += hit.ny * hit.depth;
      }
    }
    grid.update(e);
  }

  for (let i = 0; i < activePickups.length; i++) {
    const p = activePickups[i];
    for (let j = 0; j < obstacles.length; j++) {
      const hit = collision.circleBoxInfo(p, obstacles[j], manifold);
      if (hit) {
        p.x += hit.nx * hit.depth;
        p.y += hit.ny * hit.depth;
      }
    }
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
    if (roll < 0.14 && wave >= 2) {
      preset = { r: 20, speed: 68 + wave * 2, hp: 70 + wave * 20, damage: 24, color: '#ff9900', shape: 'tank', xp: 6, score: 35 };
    } else if (roll < 0.36) {
      preset = { r: 11, speed: 150 + wave * 3, hp: 16 + wave * 4, damage: 9, color: '#bd00ff', shape: 'spinner', xp: 2, score: 15 };
    } else if (roll < 0.52 && wave >= 3) {
      preset = { r: 14, speed: 125 + wave * 3, hp: 38 + wave * 8, damage: 16, color: '#00e5ff', shape: 'lancer', xp: 3, score: 20 };
    } else {
      preset = { r: 13, speed: 102 + wave * 2.5, hp: 26 + wave * 6, damage: 14, color: '#ff3366', shape: 'dart', xp: 1, score: 10 };
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
  while (activePickups.length) pickupPool.release(activePickups.pop());
  while (activeParticles.length) particlePool.release(activeParticles.pop());
  while (activeTexts.length) textPool.release(activeTexts.pop());
  grid.clear();
};

const resetRun = (seedStr) => {
  rng.setSeed(seedStr);
  timer.clear();
  clearAllEntities();
  acquiredUpgrades.clear();
  activeTempBuffs.clear();

  score = 0;
  kills = 0;
  wave = 1;
  xp = 0;
  level = 1;
  xpNext = 10;
  survivalTime = 0;
  mapCount = 1;
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
    bulletSpeed: 580,
    pickupRadius: 85,
    pierce: 0
  });

  camera.setZoom(1);
  camera.follow(player.pos, 1);

  regenerateArena(false);
  spawnWaveBatch();

  for (let i = 0; i < 3; i++) {
    spawnDisposablePickup(rng.int(-450, 450), rng.int(-350, 350));
  }

  timer.every(3200, () => spawnWaveBatch());
  timer.every(12000, () => { wave++; });
  timer.every(9500, () => {
    if (activePickups.length < 8) {
      spawnDisposablePickup(rng.int(-ARENA_HALF + 120, ARENA_HALF - 120), rng.int(-ARENA_HALF + 120, ARENA_HALF - 120));
    }
  });

  fsm.change('playing');
};

fsm.add('playing', {
  enter: () => {
    overlay.classList.add('hidden');
  },
  update: (dt) => {
    if (input.isPressed('pause')) {
      fsm.change('paused');
      return;
    }
    if (input.isPressed('regen')) {
      regenerateArena(true);
    }

    survivalTime += dt;
    timer.update(dt);

    if (input.isPressed('zoomIn')) camera.setZoom(Math.min(1.6, camera.zoom + 0.15));
    if (input.isPressed('zoomOut')) camera.setZoom(Math.max(0.65, camera.zoom - 0.15));

    moveDir.set(
      (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0),
      (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0)
    );

    if (moveDir.magSq() > 0) {
      player.moveAngle = Math.atan2(moveDir.y, moveDir.x);
      moveDir.normalize().mult(player.stats.get('speed') * (dt / 1000));
      player.pos.add(moveDir);
    }

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

    camera.screenToWorld(input.mouse.x, input.mouse.y, worldMouse);
    Vec2.sub(worldMouse, player.pos, aimDir).normalize();
    player.facing = Math.atan2(aimDir.y, aimDir.x);

    if ((autoFire || input.isDown('shoot')) && canShoot) {
      canShoot = false;
      const bSpeed = player.stats.get('bulletSpeed');
      activeBullets.push(
        bulletPool.get(
          player.pos.x + aimDir.x * (player.r + 6),
          player.pos.y + aimDir.y * (player.r + 6),
          aimDir.x * bSpeed,
          aimDir.y * bSpeed,
          player.facing,
          player.stats.get('damage'),
          Math.floor(player.stats.get('pierce'))
        )
      );

      const delay = Math.max(45, player.stats.get('fireDelay'));
      timer.add(delay, () => {
        canShoot = true;
      });
    }

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
            spawnFloatingText(e.x, e.y - e.r, `-${Math.round(b.damage)}`, '#ffffff');
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
      e.angle = Math.atan2(dy, dx);
      e.spin += dt * 0.008;
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

    const pickupR = player.stats.get('pickupRadius');
    const pickupRSq = pickupR * pickupR;

    for (let i = activeGems.length - 1; i >= 0; i--) {
      const g = activeGems[i];
      const dSq = Vec2.distanceSq(g, player.pos);
      if (g.magnetized || dSq < pickupRSq) {
        const d = Math.sqrt(dSq) || 1;
        const pullSpeed = g.magnetized ? 680 : 380;
        g.x += ((player.pos.x - g.x) / d) * pullSpeed * (dt / 1000);
        g.y += ((player.pos.y - g.y) / d) * pullSpeed * (dt / 1000);
      }
      if (collision.circleCircle(g, playerCircle)) {
        const val = g.value;
        gemPool.release(g);
        activeGems.splice(i, 1);
        events.emit('xpGained', val);
      }
    }

    for (let i = activePickups.length - 1; i >= 0; i--) {
      const p = activePickups[i];
      p.life -= dt;
      if (p.life <= 0) {
        pickupPool.release(p);
        activePickups.splice(i, 1);
        continue;
      }
      if (collision.circleCircle(p, playerCircle)) {
        events.emit('pickupCollected', p);
        pickupPool.release(p);
        activePickups.splice(i, 1);
      }
    }

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

    for (let i = activeTexts.length - 1; i >= 0; i--) {
      const t = activeTexts[i];
      t.life += dt;
      if (t.life >= t.maxLife) {
        textPool.release(t);
        activeTexts.splice(i, 1);
        continue;
      }
      t.y += t.vy * (dt / 1000);
    }

    camera.follow(player.pos, 0.12, dt);
    camera.update(dt);
  }
});

fsm.add('paused', {
  enter: () => {
    overlay.classList.remove('hidden');
    const permList = Array.from(acquiredUpgrades.values());
    const tempList = Array.from(activeTempBuffs.values());

    overlay.innerHTML = `
      <h2>Character &amp; Buffs</h2>
      <p>Game paused. All cooldowns and buff timers are frozen.</p>
      <div class="char-sheet">
        <div class="sheet-box">
          <h3>Player Stats</h3>
          <div class="stat-row"><span>Health</span><strong>${Math.ceil(player.stats.health)} / ${Math.ceil(player.stats.maxHealth)} HP</strong></div>
          <div class="stat-row"><span>Damage</span><strong>${player.stats.get('damage').toFixed(1)} (Base ${player.stats.base.damage})</strong></div>
          <div class="stat-row"><span>Fire Delay</span><strong>${Math.max(45, player.stats.get('fireDelay')).toFixed(0)} ms</strong></div>
          <div class="stat-row"><span>Move Speed</span><strong>${player.stats.get('speed').toFixed(0)} px/s</strong></div>
          <div class="stat-row"><span>Bullet Speed</span><strong>${player.stats.get('bulletSpeed').toFixed(0)} px/s</strong></div>
          <div class="stat-row"><span>Bullet Pierce</span><strong>${Math.floor(player.stats.get('pierce'))}</strong></div>
          <div class="stat-row"><span>Pickup Range</span><strong>${player.stats.get('pickupRadius').toFixed(0)} px</strong></div>
          <div class="stat-row"><span>Active Modifiers</span><strong>${player.stats.modifiers.size}</strong></div>
        </div>
        <div class="sheet-box">
          <h3>Active Buffs &amp; Upgrades</h3>
          <div class="buff-list">
            ${tempList.map((b) => `
              <div class="buff-item temp">
                <span>${b.label}</span>
                <small>${(b.remainingMs / 1000).toFixed(1)}s</small>
              </div>
            `).join('')}
            ${permList.map((u) => `
              <div class="buff-item">
                <span>${u.title} <small>(${u.desc})</small></span>
                <small>x${u.count}</small>
              </div>
            `).join('')}
            ${tempList.length === 0 && permList.length === 0 ? '<small style="color:var(--muted);">No buffs or upgrades active yet.</small>' : ''}
          </div>
        </div>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button id="resumeBtn" class="primary">Resume Game (Tab / P)</button>
        <button id="sheetRegenBtn">Regenerate Map</button>
      </div>
    `;

    document.getElementById('resumeBtn').addEventListener('click', () => fsm.change('playing'));
    document.getElementById('sheetRegenBtn').addEventListener('click', () => {
      regenerateArena(true);
      fsm.change('playing');
    });
  },
  update: () => {
    if (input.isPressed('pause')) {
      fsm.change('playing');
    }
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
      <h2>Level ${level} — Choose an Upgrade</h2>
      <p>Select one permanent stat boost:</p>
      <div class="upgrade-grid">
        ${choices.map((c, idx) => `
          <button class="upgrade-btn" data-idx="${idx}">
            <span class="tag">${c.tag}</span>
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
        const prev = acquiredUpgrades.get(pick.id);
        if (prev) prev.count++;
        else acquiredUpgrades.set(pick.id, { title: pick.title, desc: pick.desc, count: 1 });
        spawnFloatingText(player.pos.x, player.pos.y - 20, pick.title.toUpperCase(), '#00ffcc', 750);
        fsm.change('playing');
      });
    });
  }
});

fsm.add('gameover', {
  enter: () => {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h2 style="color: #ff3366;">Game Over</h2>
      <p>
        Survived <strong>${(survivalTime / 1000).toFixed(1)}s</strong> on Seed <code>${seedInput.value}</code><br>
        Wave ${wave} &nbsp;|&nbsp; Map ${mapCount} &nbsp;|&nbsp; Kills: ${kills} &nbsp;|&nbsp; Score: ${score}
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

const drawEnemyShape = (e) => {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.shape === 'dart') {
    ctx.rotate(e.angle);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(e.r + 2, 0);
    ctx.lineTo(-e.r, -e.r * 0.78);
    ctx.lineTo(-e.r * 0.45, 0);
    ctx.lineTo(-e.r, e.r * 0.78);
    ctx.closePath();
    ctx.fill();
  } else if (e.shape === 'spinner') {
    ctx.rotate(e.spin);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * (e.r + 3), Math.sin(a) * (e.r + 3));
      ctx.lineTo(Math.cos(a + 0.4) * (e.r * 0.4), Math.sin(a + 0.4) * (e.r * 0.4));
    }
    ctx.closePath();
    ctx.fill();
  } else if (e.shape === 'lancer') {
    ctx.rotate(e.angle);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(e.r + 4, 0);
    ctx.lineTo(0, -e.r * 0.65);
    ctx.lineTo(-e.r, 0);
    ctx.lineTo(0, e.r * 0.65);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.rotate(e.angle);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const px = Math.cos(a) * e.r;
      const py = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#181b22';
    ctx.fillRect(-e.r * 0.45, -e.r * 0.45, e.r * 0.9, e.r * 0.9);
  }

  ctx.restore();
};

const drawPickupShape = (p) => {
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = '#141820';
  ctx.strokeStyle = p.type.color;
  ctx.lineWidth = 2;
  const r = p.r;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r);
  ctx.lineTo(r * 0.5, -r);
  ctx.lineTo(r, -r * 0.5);
  ctx.lineTo(r, r * 0.5);
  ctx.lineTo(r * 0.5, r);
  ctx.lineTo(-r * 0.5, r);
  ctx.lineTo(-r, r * 0.5);
  ctx.lineTo(-r, -r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = p.type.color;
  ctx.strokeStyle = p.type.color;
  ctx.lineWidth = 2;

  if (p.type.id === 'heal') {
    ctx.fillRect(-2, -6, 4, 12);
    ctx.fillRect(-6, -2, 12, 4);
  } else if (p.type.id === 'haste') {
    ctx.beginPath();
    ctx.moveTo(-3, -5); ctx.lineTo(3, 0); ctx.lineTo(-3, 5);
    ctx.moveTo(1, -5); ctx.lineTo(6, 0); ctx.lineTo(1, 5);
    ctx.stroke();
  } else if (p.type.id === 'overclock') {
    ctx.fillRect(-5, -5, 4, 10);
    ctx.fillRect(1, -5, 4, 10);
  } else if (p.type.id === 'nova') {
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
  } else if (p.type.id === 'vacuum') {
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
};

const drawPlayer = () => {
  ctx.save();
  ctx.translate(player.pos.x, player.pos.y);

  ctx.strokeStyle = 'rgba(0, 255, 204, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, player.stats.get('pickupRadius'), 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(player.facing);

  ctx.fillStyle = '#8b949e';
  ctx.fillRect(6, -3.5, player.r + 7, 7);

  ctx.fillStyle = invulnFrames ? '#ffffff' : '#00ffcc';
  ctx.strokeStyle = '#0b0e14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.r + 2, 0);
  ctx.lineTo(-player.r * 0.7, -player.r * 0.9);
  ctx.lineTo(-player.r, -player.r * 0.4);
  ctx.lineTo(-player.r, player.r * 0.4);
  ctx.lineTo(-player.r * 0.7, player.r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#141820';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

const render = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0c0f14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  camera.apply(ctx);

  for (let i = 0; i < floorDecals.length; i++) {
    const d = floorDecals[i];
    ctx.fillStyle = d.variant === 0 ? '#11151d' : '#0f131a';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = '#161b24';
    ctx.lineWidth = 1;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
  }

  ctx.strokeStyle = '#ff3366';
  ctx.lineWidth = 4;
  ctx.strokeRect(-ARENA_HALF, -ARENA_HALF, WORLD_SIZE, WORLD_SIZE);

  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    ctx.fillStyle = '#1b202b';
    ctx.fillRect(o.x, o.y, o.w, o.h);

    ctx.fillStyle = '#232a38';
    ctx.fillRect(o.x + 6, o.y + 6, o.w - 12, o.h - 12);

    ctx.strokeStyle = '#364054';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.w, o.h);

    ctx.fillStyle = '#48546d';
    ctx.fillRect(o.x + 4, o.y + 4, 3, 3);
    ctx.fillRect(o.x + o.w - 7, o.y + 4, 3, 3);
    ctx.fillRect(o.x + 4, o.y + o.h - 7, 3, 3);
    ctx.fillRect(o.x + o.w - 7, o.y + o.h - 7, 3, 3);
  }

  for (let i = 0; i < activeGems.length; i++) {
    const g = activeGems[i];
    ctx.fillStyle = g.value >= 5 ? '#ffea00' : '#00ffcc';
    ctx.beginPath();
    ctx.moveTo(g.x, g.y - g.r);
    ctx.lineTo(g.x + g.r, g.y);
    ctx.lineTo(g.x, g.y + g.r);
    ctx.lineTo(g.x - g.r, g.y);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < activePickups.length; i++) {
    drawPickupShape(activePickups[i]);
  }

  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < activeBullets.length; i++) {
    const b = activeBullets[i];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillRect(-6, -2, 12, 4);
    ctx.restore();
  }

  for (let i = 0; i < activeEnemies.length; i++) {
    drawEnemyShape(activeEnemies[i]);
  }

  // Particles are the only elements with glow
  ctx.save();
  for (let i = 0; i < activeParticles.length; i++) {
    const p = activeParticles[i];
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();

  drawPlayer();

  // Floating combat text (no glow, solid outline for contrast)
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0b0d12';
  for (let i = 0; i < activeTexts.length; i++) {
    const t = activeTexts[i];
    ctx.globalAlpha = Math.max(0, 1 - t.life / t.maxLife);
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(worldMouse.x - 8, worldMouse.y); ctx.lineTo(worldMouse.x - 3, worldMouse.y);
  ctx.moveTo(worldMouse.x + 3, worldMouse.y); ctx.lineTo(worldMouse.x + 8, worldMouse.y);
  ctx.moveTo(worldMouse.x, worldMouse.y - 8); ctx.lineTo(worldMouse.x, worldMouse.y - 3);
  ctx.moveTo(worldMouse.x, worldMouse.y + 3); ctx.lineTo(worldMouse.x, worldMouse.y + 8);
  ctx.stroke();

  // Screen-space HUD
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.fillStyle = '#1f2430';
  ctx.fillRect(16, 16, 220, 16);
  ctx.fillStyle = '#ff3366';
  ctx.fillRect(16, 16, 220 * player.stats.healthRatio, 16);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`HP ${Math.ceil(player.stats.health)} / ${Math.ceil(player.stats.maxHealth)}`, 22, 28);

  ctx.fillStyle = '#1f2430';
  ctx.fillRect(16, 38, 220, 10);
  ctx.fillStyle = '#00ffcc';
  ctx.fillRect(16, 38, 220 * (xp / xpNext), 10);

  ctx.fillStyle = '#1f2430';
  ctx.fillRect(16, 54, 120, 6);
  ctx.fillStyle = dashReady ? '#00ffcc' : '#ff9900';
  ctx.fillRect(16, 54, 120 * (1 - dashCooldownRatio), 6);

  let buffY = 74;
  for (const buff of activeTempBuffs.values()) {
    const ratio = buff.remainingMs / buff.durationMs;
    ctx.fillStyle = '#181b22';
    ctx.fillRect(16, buffY, 175, 14);
    ctx.fillStyle = buff.color;
    ctx.fillRect(16, buffY, 175 * ratio, 14);
    ctx.fillStyle = '#0b0e14';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`${buff.shortName} ${(buff.remainingMs / 1000).toFixed(1)}s`, 20, buffY + 11);
    buffY += 18;
  }

  ctx.fillStyle = '#e6edf3';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`LVL ${level}  |  WAVE ${wave}  |  MAP ${mapCount}  |  SCORE ${score}`, 255, 29);

  telemetryEl.textContent =
    `=== 12-MODULE LIVE TELEMETRY ===\n` +
    `[GameLoop]     FPS: ${loop.fps} | Step: ${loop.step.toFixed(1)}ms\n` +
    `[StateMachine] State: "${fsm.currentStateName}"\n` +
    `[Random]       Seed: "${seedInput.value}" (Map ${mapCount})\n` +
    `[TimerManager] Active Timers: ${timer.timers.length}\n` +
    `[Vec2]         Player: (${player.pos.x.toFixed(0)}, ${player.pos.y.toFixed(0)})\n` +
    `[Camera]       Zoom: ${camera.zoom.toFixed(2)}x | Shake: ${camera.shakeTimer > 0 ? 'ACTIVE' : 'idle'}\n` +
    `[InputManager] Mouse: (${input.mouse.x.toFixed(0)}, ${input.mouse.y.toFixed(0)})\n` +
    `[SpatialHash]  Tracked: ${grid.size} | Active Cells: ${grid.cellCount}\n` +
    `[Pool]         Enemies   use:${enemyPool.inUse} idle:${enemyPool.available}\n` +
    `               Bullets   use:${bulletPool.inUse} idle:${bulletPool.available}\n` +
    `               Pickups   use:${pickupPool.inUse} idle:${pickupPool.available}\n` +
    `               XP Gems   use:${gemPool.inUse} idle:${gemPool.available}\n` +
    `               Particles use:${particlePool.inUse} idle:${particlePool.available}\n` +
    `               Dmg Text  use:${textPool.inUse} idle:${textPool.available}\n` +
    `[Stats]        HP: ${Math.ceil(player.stats.health)}/${Math.ceil(player.stats.maxHealth)} | Spd: ${player.stats.get('speed').toFixed(0)}\n` +
    `               Dmg: ${player.stats.get('damage').toFixed(1)} | Mods: ${player.stats.modifiers.size}\n` +
    `[collision]    Obstacles: ${obstacles.length} | Pickups: ${activePickups.length}\n` +
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

document.getElementById('regenMapBtn').addEventListener('click', () => {
  if (fsm.currentStateName === 'playing' || fsm.currentStateName === 'paused') {
    regenerateArena(true);
  }
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  if (fsm.currentStateName === 'playing') fsm.change('paused');
  else if (fsm.currentStateName === 'paused') fsm.change('playing');
});

autoFireBtn.addEventListener('click', () => {
  autoFire = !autoFire;
  autoFireBtn.textContent = `Auto-Fire: ${autoFire ? 'ON' : 'OFF'}`;
});

resetRun(seedInput.value);
loop.start();