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
  Camera,
  AbilityManager,
  WaveSpawner,
  Progression,
  LootTable,
  Inventory,
  steering,
  FlowField,
  lineOfSight
} from '../../../index.js';
import { CodeEditor } from '../../code-editor.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const telemetryEl = document.getElementById('telemetry');
const seedInput = document.getElementById('seedInput');
const visionBtn = document.getElementById('visionBtn');
const flowBtn = document.getElementById('flowBtn');

const WORLD_SIZE = 1600;
const ARENA_HALF = WORLD_SIZE / 2;
const FLOW_CELL = 32;
const FLOW_COLS = WORLD_SIZE / FLOW_CELL;

const events = new EventEmitter();
const input = new InputManager(canvas);
const timer = new TimerManager();
const rng = new Random(seedInput.value);
const camera = new Camera(canvas.width, canvas.height);
const grid = new SpatialHash(72);
const gameFsm = new StateMachine();
const abilities = new AbilityManager();
const spawner = new WaveSpawner({ rng: () => rng.next() });
const progression = new Progression({ baseXp: 10, growthFactor: 1.35, linearStep: 6 });
const inventory = new Inventory({ maxSlots: 3 });
const flowField = new FlowField({
  cols: FLOW_COLS,
  rows: FLOW_COLS,
  cellSize: FLOW_CELL,
  originX: -ARENA_HALF,
  originY: -ARENA_HALF
});

const mobLoot = new LootTable({ dropChance: 0.14 })
  .add('medkit', { weight: 40, min: 1, max: 1 })
  .add('bomb', { weight: 25, min: 1, max: 1 })
  .add('haste', { weight: 20, min: 1, max: 1 })
  .add('rapid', { weight: 10, min: 1, max: 1 })
  .add('magnet', { weight: 5, min: 1, max: 1 });

const tankLoot = new LootTable({ dropChance: 0.65 })
  .add('medkit', { weight: 35, min: 1, max: 1 })
  .add('bomb', { weight: 30, min: 1, max: 1 })
  .add('haste', { weight: 20, min: 1, max: 1 })
  .add('magnet', { weight: 15, min: 1, max: 1 });

input.bind('up', ['KeyW', 'ArrowUp']);
input.bind('down', ['KeyS', 'ArrowDown']);
input.bind('left', ['KeyA', 'ArrowLeft']);
input.bind('right', ['KeyD', 'ArrowRight']);
input.bind('dash', ['ShiftLeft', 'ShiftRight']);
input.bind('shockwave', ['KeyF', 'Mouse2']);
input.bind('slot1', ['Digit1']);
input.bind('slot2', ['Digit2']);
input.bind('slot3', ['Digit3']);
input.bind('pause', ['KeyP', 'Tab', 'Escape']);
input.bind('regen', ['KeyG']);
input.bind('toggleVision', ['KeyC']);
input.bind('toggleFlow', ['KeyV']);
input.bind('zoomIn', ['KeyE']);
input.bind('zoomOut', ['KeyQ']);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const manifold = { nx: 0, ny: 0, depth: 0 };
const queryScratch = [];
const visibleSet = [];
const visionPoly = [];
const flowDir = { x: 0, y: 0 };
const steerForce = { x: 0, y: 0 };
const sepForce = { x: 0, y: 0 };
const worldMouse = new Vec2();
const moveDir = new Vec2();
const aimDir = new Vec2(1, 0);

let score = 0;
let kills = 0;
let survivalTime = 0;
let mapCount = 1;
let invulnFrames = false;
let visionMode = false;
let showFlowArrows = false;
let lastFlowCell = { col: -1, row: -1 };
let aiCounts = { engage: 0, track: 0, search: 0 };

const activeEnemies = [];
const activeBullets = [];
const activeEnemyBullets = [];
const activeGems = [];
const activePickups = [];
const activeBombs = [];
const activeParticles = [];
const activeTexts = [];
const obstacles = [];
const floorDecals = [];
const activeTempBuffs = new Map();

const ITEM_TYPES = {
  medkit: { id: 'medkit', shortName: 'MEDKIT', label: 'Medkit (+50 HP)', color: '#6bc98f', storable: true, r: 11 },
  bomb: { id: 'bomb', shortName: 'TIME BOMB', label: 'Time Bomb (1.2s Fuse, 140 AoE Dmg)', color: '#c96b6b', storable: true, r: 11 },
  haste: {
    id: 'haste', shortName: 'SPEED BOOST', label: 'Speed Boost (+55% Speed, 10s)',
    color: '#78b0d9', storable: true, r: 11, duration: 10000, stat: 'speed', modType: 'percent', val: 0.55
  },
  rapid: {
    id: 'rapid', shortName: 'RAPID FIRE', label: 'Rapid Fire (+40% Attack Speed, 8s)',
    color: '#d9b978', storable: false, r: 11, duration: 8000, stat: 'fireDelay', modType: 'percent', val: -0.4
  },
  magnet: { id: 'magnet', shortName: 'MAGNET', label: 'Magnet (Pull All XP)', color: '#f3ead3', storable: false, r: 11 }
};

const ENEMY_PRESETS = {
  dart:    { r: 13, speed: 115, hp: 28, damage: 14, color: '#c96b6b', shape: 'dart',    sight: 460, xp: 1, score: 10 },
  spinner: { r: 11, speed: 162, hp: 18, damage: 10, color: '#b08ed9', shape: 'spinner', sight: 480, xp: 2, score: 15 },
  lancer:  { r: 14, speed: 138, hp: 42, damage: 16, color: '#78b0d9', shape: 'lancer',  sight: 500, xp: 3, score: 20 },
  ranged:  { r: 13, speed: 128, hp: 32, damage: 12, color: '#d9b978', shape: 'ranged',  sight: 460, xp: 4, score: 25 },
  tank:    { r: 20, speed: 76,  hp: 95, damage: 26, color: '#e69f66', shape: 'tank',    sight: 520, xp: 7, score: 45 }
};

const player = {
  pos: new Vec2(0, 0),
  r: 14,
  facing: 0,
  stats: new Stats({
    maxHealth: 100,
    speed: 220,
    damage: 20,
    fireDelay: 190,
    bulletSpeed: 590,
    pickupRadius: 85,
    pierce: 0
  })
};

// Attaches a 3-state AI StateMachine ('search', 'engage', 'track') to each pooled enemy
function createEnemyEntity() {
  const e = {
    x: 0, y: 0, vx: 0, vy: 0, r: 12, speed: 90, maxForce: 560, color: '#c96b6b', shape: 'dart',
    sightRange: 460, angle: 0, spin: 0, fireTimer: 0, trackTimer: 0, orbitCw: true,
    xpValue: 2, scoreValue: 10,
    stats: new Stats({ maxHealth: 25, damage: 12 }),
    fsm: new StateMachine()
  };

  // STATE 1: SEARCH — Enemy has no line of sight and patrols via steering.wander()
  e.fsm.add('search', {
    update: (dt) => {
      const distSq = Vec2.distanceSq(e, player.pos);
      const canSee = distSq <= e.sightRange * e.sightRange &&
        lineOfSight.hasLineOfSight(e, player.pos, obstacles);

      if (canSee) {
        e.fsm.change('engage');
        return;
      }

      steering.wander(e, e.speed * 0.75, { distance: 60, radius: 34, jitter: 0.3 }, steerForce);
      if (Math.hypot(e.vx, e.vy) > 5) {
        e.angle = Math.atan2(e.vy, e.vx);
      }
    }
  });

  // STATE 2: ENGAGE — Enemy has clear line of sight to the player
  e.fsm.add('engage', {
    update: (dt) => {
      const distSq = Vec2.distanceSq(e, player.pos);
      const canSee = lineOfSight.hasLineOfSight(e, player.pos, obstacles);

      // The moment a wall blocks line of sight, switch to 'track' to navigate around the block
      if (!canSee) {
        e.fsm.change('track');
        return;
      }

      e.angle = Math.atan2(player.pos.y - e.y, player.pos.x - e.x);

      if (e.shape === 'ranged') {
        if (distSq < 135 * 135) {
          steering.flee(e, player.pos, e.speed, 145, steerForce);
        } else {
          steering.orbit(e, player.pos, 220, e.speed, e.orbitCw, steerForce);
        }

        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && distSq < 380 * 380) {
          e.fireTimer = 1750;
          const dx = player.pos.x - e.x;
          const dy = player.pos.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          activeEnemyBullets.push(
            enemyBulletPool.get(e.x, e.y, (dx / d) * 290, (dy / d) * 290, e.stats.get('damage'))
          );
        }
      } else {
        steering.seek(e, player.pos, e.speed, steerForce);
      }
    }
  });

  // STATE 3: TRACK — Line of sight is blocked by a wall; follow FlowField around corners
  e.fsm.add('track', {
    enter: () => {
      e.trackTimer = 5500;
    },
    update: (dt) => {
      const canSee = lineOfSight.hasLineOfSight(e, player.pos, obstacles);
      if (canSee) {
        e.fsm.change('engage');
        return;
      }

      e.trackTimer -= dt;
      if (e.trackTimer <= 0) {
        e.fsm.change('search');
        return;
      }

      flowField.sample(e.x, e.y, flowDir);
      if (flowDir.x !== 0 || flowDir.y !== 0) {
        steerForce.x = flowDir.x * e.speed - e.vx;
        steerForce.y = flowDir.y * e.speed - e.vy;
      } else {
        steering.wander(e, e.speed, { distance: 50, radius: 30, jitter: 0.4 }, steerForce);
      }

      // Face movement direction while rounding corners instead of staring through walls
      if (Math.hypot(e.vx, e.vy) > 5) {
        e.angle = Math.atan2(e.vy, e.vx);
      }
    }
  });

  return e;
}

const bulletPool = new Pool({
  create: () => ({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, r: 4, damage: 10, life: 0, pierce: 0 }),
  init: (b, x, y, vx, vy, angle, damage, pierce) => {
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.angle = angle;
    b.damage = damage; b.pierce = pierce; b.life = 1150;
  },
  size: 100,
  maxSize: 600
});

const enemyBulletPool = new Pool({
  create: () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 5, damage: 12, life: 0 }),
  init: (b, x, y, vx, vy, damage) => {
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.damage = damage; b.life = 2200;
  },
  size: 50,
  maxSize: 300
});

const enemyPool = new Pool({
  create: createEnemyEntity,
  init: (e, x, y, preset, waveScale = 1) => {
    const startAngle = rng.range(0, Math.PI * 2);
    e.x = x;
    e.y = y;
    e.vx = Math.cos(startAngle) * 40;
    e.vy = Math.sin(startAngle) * 40;
    e.r = preset.r;
    e.speed = preset.speed * (1 + (waveScale - 1) * 0.05);
    e.maxForce = 620;
    e.color = preset.color;
    e.shape = preset.shape;
    e.sightRange = preset.sight;
    e.angle = startAngle;
    e.spin = 0;
    e.orbitCw = rng.next() < 0.5;
    e.fireTimer = 900 + rng.range(0, 700);
    e.xpValue = preset.xp;
    e.scoreValue = preset.score;
    e.stats.base.maxHealth = Math.round(preset.hp * (1 + (waveScale - 1) * 0.22));
    e.stats.base.damage = preset.damage;
    e.stats.dead = false;
    e.stats.health = e.stats.maxHealth;

    // Start in 'engage' if spawned with clear LOS, otherwise 'track' around obstacles
    const hasLOS = lineOfSight.hasLineOfSight(e, player.pos, obstacles);
    e.fsm.change(hasLOS ? 'engage' : 'track');
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
    p.x = x; p.y = y; p.type = type; p.r = type.r; p.life = 20000;
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
  create: () => ({ x: 0, y: 0, vy: -42, text: '', color: '#f3ead3', life: 0, maxLife: 550 }),
  init: (t, x, y, text, color = '#f3ead3', maxLife = 550) => {
    t.x = x; t.y = y; t.vy = -42; t.text = text; t.color = color; t.life = 0; t.maxLife = maxLife;
  },
  size: 60,
  maxSize: 300
});

const spawnBurst = (x, y, color, count = 8, speedMax = 180) => {
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const spd = rng.range(40, speedMax);
    activeParticles.push(
      particlePool.get(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color,
        rng.range(2.5, 4.5),
        rng.range(180, 420)
      )
    );
  }
};

const spawnFloatingText = (x, y, text, color = '#f3ead3', duration = 550) => {
  activeTexts.push(textPool.get(x + rng.range(-8, 8), y - 10, text, color, duration));
};

const applyTemporaryBuff = (type) => {
  const existing = activeTempBuffs.get(type.id);
  if (existing) timer.cancel(existing.timerRef);

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

const plantTimeBomb = (x, y) => {
  const bombObj = { x, y, r: 220, progress: 0 };
  activeBombs.push(bombObj);
  spawnFloatingText(x, y - 14, 'BOMB SET (1.2s)', '#c96b6b', 700);

  timer.add(
    1200,
    () => {
      const idx = activeBombs.indexOf(bombObj);
      if (idx !== -1) activeBombs.splice(idx, 1);

      camera.shake(260, 12);
      spawnBurst(bombObj.x, bombObj.y, '#c96b6b', 24, 280);
      spawnFloatingText(bombObj.x, bombObj.y - 16, 'BOOM!', '#c96b6b', 750);

      grid.queryRadius(bombObj.x, bombObj.y, bombObj.r, queryScratch);
      for (let i = 0; i < queryScratch.length; i++) {
        const e = queryScratch[i];
        if (!e.stats.dead && Vec2.distanceSq(e, bombObj) <= bombObj.r * bombObj.r) {
          spawnFloatingText(e.x, e.y - e.r, '-140', '#d9b978');
          if (e.stats.takeDamage(140)) {
            events.emit('enemyKilled', { enemy: e });
          }
        }
      }
    },
    (p) => {
      bombObj.progress = p;
    }
  );
};

inventory
  .defineItem('medkit', {
    name: 'Medkit',
    maxStack: 5,
    consumable: true,
    onUse: () => {
      player.stats.heal(50);
      spawnBurst(player.pos.x, player.pos.y, '#6bc98f', 12);
      spawnFloatingText(player.pos.x, player.pos.y - 18, '+50 HP', '#6bc98f', 750);
    }
  })
  .defineItem('bomb', {
    name: 'Time Bomb',
    maxStack: 5,
    consumable: true,
    onUse: () => {
      plantTimeBomb(player.pos.x, player.pos.y);
    }
  })
  .defineItem('haste', {
    name: 'Speed Boost',
    maxStack: 5,
    consumable: true,
    onUse: () => {
      applyTemporaryBuff(ITEM_TYPES.haste);
      spawnFloatingText(player.pos.x, player.pos.y - 18, 'SPEED BOOST!', '#78b0d9', 750);
    }
  });

abilities
  .register('gun', {
    cooldown: 190,
    charges: 1,
    auto: true,
    onUse: () => {
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
    }
  })
  .register('dash', {
    cooldown: 1800,
    charges: 2,
    duration: 200,
    onUse: () => {
      invulnFrames = true;
      player.stats.addModifier('dashBoost', 'speed', 'percent', 1.5);
      spawnBurst(player.pos.x, player.pos.y, '#f3ead3', 10);
    },
    onEnd: () => {
      player.stats.removeModifier('dashBoost');
      invulnFrames = false;
    }
  })
  .register('shockwave', {
    cooldown: 5000,
    charges: 1,
    duration: 300,
    onUse: () => {
      camera.shake(200, 9);
      spawnBurst(player.pos.x, player.pos.y, '#d9b978', 20, 260);
      spawnFloatingText(player.pos.x, player.pos.y - 20, 'SHOCKWAVE!', '#d9b978', 700);

      grid.queryRadius(player.pos.x, player.pos.y, 190, queryScratch);
      for (let i = 0; i < queryScratch.length; i++) {
        const e = queryScratch[i];
        if (!e.stats.dead) {
          const dx = e.x - player.pos.x;
          const dy = e.y - player.pos.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d <= 190) {
            e.x += (dx / d) * 65;
            e.y += (dy / d) * 65;
            grid.update(e);
            spawnFloatingText(e.x, e.y - e.r, '-45', '#d9b978');
            if (e.stats.takeDamage(45)) {
              events.emit('enemyKilled', { enemy: e });
            }
          }
        }
      }
    }
  });

progression
  .registerUpgrade({
    id: 'rapid', tag: 'Attack Speed', title: 'Rapid Fire', desc: '-15% Fire Delay', maxRank: 4, weight: 3,
    apply: (rank) => player.stats.addModifier('up_rapid', 'fireDelay', 'percent', -0.15 * rank)
  })
  .registerUpgrade({
    id: 'damage', tag: 'Offense', title: 'Damage Up', desc: '+25% Bullet Damage', maxRank: 5, weight: 3,
    apply: (rank) => player.stats.addModifier('up_dmg', 'damage', 'percent', 0.25 * rank)
  })
  .registerUpgrade({
    id: 'speed', tag: 'Mobility', title: 'Move Speed', desc: '+16% Move Speed', maxRank: 4, weight: 3,
    apply: (rank) => player.stats.addModifier('up_spd', 'speed', 'percent', 0.16 * rank)
  })
  .registerUpgrade({
    id: 'health', tag: 'Defense', title: 'Max Health Up', desc: '+45 Max HP & Heal 45', maxRank: 5, weight: 3,
    apply: (rank) => {
      player.stats.addModifier('up_hp', 'maxHealth', 'add', 45 * rank);
      player.stats.heal(45);
    }
  })
  .registerUpgrade({
    id: 'magnet', tag: 'Utility', title: 'Magnet Range', desc: '+45% Pickup Range', maxRank: 3, weight: 2,
    apply: (rank) => player.stats.addModifier('up_mag', 'pickupRadius', 'percent', 0.45 * rank)
  })
  .registerUpgrade({
    id: 'pierce', tag: 'Weapon', title: 'Piercing Shots', desc: '+1 Bullet Pierce', maxRank: 3, weight: 2,
    apply: (rank) => player.stats.addModifier('up_prc', 'pierce', 'add', rank)
  })
  .registerUpgrade({
    id: 'velocity', tag: 'Weapon', title: 'Fast Bullets', desc: '+25% Bullet Speed & +10% Dmg', maxRank: 3, weight: 2,
    apply: (rank) => {
      player.stats.addModifier('up_vel', 'bulletSpeed', 'percent', 0.25 * rank);
      player.stats.addModifier('up_vel_d', 'damage', 'percent', 0.1 * rank);
    }
  })
  .registerUpgrade({
    id: 'glass', tag: 'Trade-off', title: 'Glass Cannon', desc: '+55% Damage, -25 Max HP', maxRank: 2, weight: 1,
    apply: (rank) => {
      player.stats.addModifier('up_gc_d', 'damage', 'percent', 0.55 * rank);
      player.stats.addModifier('up_gc_h', 'maxHealth', 'add', -25 * rank);
    }
  });

spawner
  .addWave({
    duration: 14000, interval: 2800, count: 6, shape: 'ring', minRadius: 430, maxRadius: 580,
    types: [{ id: 'dart', weight: 5 }, { id: 'spinner', weight: 2 }, { id: 'ranged', weight: 1 }]
  })
  .addWave({
    duration: 16000, interval: 2500, count: 8, shape: 'ring', minRadius: 430, maxRadius: 600,
    types: [{ id: 'dart', weight: 4 }, { id: 'spinner', weight: 3 }, { id: 'ranged', weight: 2 }, { id: 'tank', weight: 1 }]
  })
  .addWave({
    duration: 20000, interval: 2200, count: 10, shape: 'ring', minRadius: 440, maxRadius: 620,
    types: [{ id: 'dart', weight: 3 }, { id: 'lancer', weight: 3 }, { id: 'ranged', weight: 2 }, { id: 'tank', weight: 2 }]
  });

const spawnEnemyFromRule = ({ x, y, type, wave }) => {
  let sx = Math.max(-ARENA_HALF + 35, Math.min(ARENA_HALF - 35, x));
  let sy = Math.max(-ARENA_HALF + 35, Math.min(ARENA_HALF - 35, y));
  const preset = ENEMY_PRESETS[type] || ENEMY_PRESETS.dart;

  const probe = { x: sx, y: sy, r: preset.r };
  for (let i = 0; i < obstacles.length; i++) {
    const hit = collision.circleBoxInfo(probe, obstacles[i], manifold);
    if (hit) {
      probe.x += hit.nx * hit.depth;
      probe.y += hit.ny * hit.depth;
    }
  }

  const enemy = enemyPool.get(probe.x, probe.y, preset, wave);
  activeEnemies.push(enemy);
  grid.insert(enemy);
};

const spawnGroundItem = (x, y, itemId) => {
  const type = ITEM_TYPES[itemId] || ITEM_TYPES.medkit;
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
  spawnBurst(enemy.x, enemy.y, enemy.color, 9);

  const table = enemy.shape === 'tank' ? tankLoot : mobLoot;
  const drops = table.roll(() => rng.next());
  for (let i = 0; i < drops.length; i++) {
    spawnGroundItem(enemy.x + rng.range(-12, 12), enemy.y + rng.range(-12, 12), drops[i].id);
  }
  if (enemy.r >= 18) camera.shake(140, 6);
});

events.on('pickupCollected', (pickup) => {
  const t = pickup.type;
  spawnBurst(pickup.x, pickup.y, t.color, 12, 200);

  if (t.storable) {
    const res = inventory.add(t.id, 1);
    if (res.added > 0) {
      spawnFloatingText(player.pos.x, player.pos.y - 16, `+1 ${t.shortName} (Belt)`, t.color, 750);
      return;
    }
  }

  if (t.id === 'medkit') {
    player.stats.heal(50);
    spawnFloatingText(player.pos.x, player.pos.y - 16, '+50 HP', t.color, 750);
  } else if (t.id === 'bomb') {
    plantTimeBomb(player.pos.x, player.pos.y);
  } else if (t.id === 'haste' || t.id === 'rapid') {
    applyTemporaryBuff(t);
    spawnFloatingText(player.pos.x, player.pos.y - 16, t.shortName, t.color, 750);
  } else if (t.id === 'magnet') {
    spawnFloatingText(player.pos.x, player.pos.y - 16, 'MAGNET!', t.color, 750);
    for (let i = 0; i < activeGems.length; i++) {
      activeGems[i].magnetized = true;
    }
  }
});

events.on('playerDamaged', ({ amount }) => {
  camera.shake(220, 10);
  spawnBurst(player.pos.x, player.pos.y, '#c96b6b', 14);
  spawnFloatingText(player.pos.x, player.pos.y - 18, `-${Math.round(amount)} HP`, '#c96b6b', 700);
  if (player.stats.takeDamage(amount)) {
    gameFsm.change('gameover');
  }
});

const rebuildFlowFieldWalls = () => {
  flowField.clearWalls();
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    flowField.setObstacleRect(o.x, o.y, o.w, o.h, 8);
  }
  flowField.compute(player.pos.x, player.pos.y);
  flowField.worldToCell(player.pos.x, player.pos.y, lastFlowCell);
};

// Generates non-overlapping blocks with guaranteed 64px walkable corridors around every obstacle
const regenerateArena = (keepEntities = false) => {
  obstacles.length = 0;
  floorDecals.length = 0;

  for (let i = 0; i < 60; i++) {
    floorDecals.push({
      x: rng.int(-ARENA_HALF + 40, ARENA_HALF - 120),
      y: rng.int(-ARENA_HALF + 40, ARENA_HALF - 120),
      w: rng.int(40, 130),
      h: rng.int(24, 90),
      variant: rng.int(0, 2)
    });
  }

  const CORRIDOR_PAD = 64;
  let attempts = 0;

  while (obstacles.length < 14 && attempts < 80) {
    attempts++;
    const w = rng.int(80, 150);
    const h = rng.int(80, 150);
    const x = rng.int(-ARENA_HALF + 100, ARENA_HALF - w - 100);
    const y = rng.int(-ARENA_HALF + 100, ARENA_HALF - h - 100);

    // Keep clear of player position
    if (Math.abs(x + w / 2 - player.pos.x) < 170 && Math.abs(y + h / 2 - player.pos.y) < 170) {
      continue;
    }

    // Ensure at least a 64px corridor between obstacles so enemies never get pinched
    const padded = {
      x: x - CORRIDOR_PAD,
      y: y - CORRIDOR_PAD,
      w: w + CORRIDOR_PAD * 2,
      h: h + CORRIDOR_PAD * 2
    };

    let overlapsExisting = false;
    for (let i = 0; i < obstacles.length; i++) {
      if (collision.boxBox(padded, obstacles[i])) {
        overlapsExisting = true;
        break;
      }
    }

    if (!overlapsExisting) {
      obstacles.push({ x, y, w, h });
    }
  }

  rebuildFlowFieldWalls();

  if (!keepEntities) return;

  mapCount++;
  camera.shake(180, 7);
  spawnBurst(player.pos.x, player.pos.y, '#f3ead3', 18, 240);
  spawnFloatingText(player.pos.x, player.pos.y - 22, 'MAP REGENERATED', '#f3ead3', 800);

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
};

const clearAllEntities = () => {
  while (activeEnemies.length) enemyPool.release(activeEnemies.pop());
  while (activeBullets.length) bulletPool.release(activeBullets.pop());
  while (activeEnemyBullets.length) enemyBulletPool.release(activeEnemyBullets.pop());
  while (activeGems.length) gemPool.release(activeGems.pop());
  while (activePickups.length) pickupPool.release(activePickups.pop());
  while (activeParticles.length) particlePool.release(activeParticles.pop());
  while (activeTexts.length) textPool.release(activeTexts.pop());
  activeBombs.length = 0;
  grid.clear();
};

const resetRun = (seedStr) => {
  rng.setSeed(seedStr);
  timer.clear();
  clearAllEntities();
  activeTempBuffs.clear();
  progression.reset();
  spawner.reset();
  abilities.reset();
  inventory.clear();

  inventory.add('medkit', 1);
  inventory.add('bomb', 1);
  inventory.add('haste', 1);

  score = 0;
  kills = 0;
  survivalTime = 0;
  mapCount = 1;
  invulnFrames = false;

  player.pos.set(0, 0);
  player.stats = new Stats({
    maxHealth: 100,
    speed: 220,
    damage: 20,
    fireDelay: 190,
    bulletSpeed: 590,
    pickupRadius: 85,
    pierce: 0
  });

  camera.setZoom(1);
  camera.follow(player.pos, 1);

  regenerateArena(false);
  spawner.update(2800, player.pos.x, player.pos.y, spawnEnemyFromRule);

  gameFsm.change('playing');
};

gameFsm.add('playing', {
  enter: () => {
    overlay.classList.add('hidden');
  },
  update: (dt) => {
    if (input.isPressed('pause')) {
      gameFsm.change('paused');
      return;
    }
    if (input.isPressed('regen')) regenerateArena(true);
    if (input.isPressed('toggleVision')) {
      visionMode = !visionMode;
      visionBtn.textContent = `Sight Cone (C): ${visionMode ? 'ON' : 'OFF'}`;
    }
    if (input.isPressed('toggleFlow')) {
      showFlowArrows = !showFlowArrows;
      flowBtn.textContent = `Flow Arrows (V): ${showFlowArrows ? 'ON' : 'OFF'}`;
    }

    if (input.isPressed('slot1')) inventory.use('medkit', player);
    if (input.isPressed('slot2')) inventory.use('bomb', player);
    if (input.isPressed('slot3')) inventory.use('haste', player);

    survivalTime += dt;
    timer.update(dt);
    spawner.update(dt, player.pos.x, player.pos.y, spawnEnemyFromRule);

    if (input.isPressed('zoomIn')) camera.setZoom(Math.min(1.6, camera.zoom + 0.15));
    if (input.isPressed('zoomOut')) camera.setZoom(Math.max(0.65, camera.zoom - 0.15));

    moveDir.set(
      (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0),
      (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0)
    );

    if (moveDir.magSq() > 0) {
      moveDir.normalize().mult(player.stats.get('speed') * (dt / 1000));
      player.pos.add(moveDir);
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

    const currCell = flowField.worldToCell(player.pos.x, player.pos.y);
    if (currCell.col !== lastFlowCell.col || currCell.row !== lastFlowCell.row) {
      flowField.compute(player.pos.x, player.pos.y);
      lastFlowCell.col = currCell.col;
      lastFlowCell.row = currCell.row;
    }

    camera.screenToWorld(input.mouse.x, input.mouse.y, worldMouse);
    Vec2.sub(worldMouse, player.pos, aimDir).normalize();
    player.facing = Math.atan2(aimDir.y, aimDir.x);

    const fireScale = Math.max(0.2, player.stats.get('fireDelay') / 190);
    if (input.isPressed('dash')) abilities.use('dash', player);
    if (input.isPressed('shockwave')) abilities.use('shockwave', player);
    abilities.update(dt, player, fireScale);

    // Update Player Bullets
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
            spawnBurst(b.x, b.y, '#f3ead3', 4);
            break;
          }
        }
      }

      if (!removeBullet) {
        grid.queryRadius(b.x, b.y, b.r + 24, queryScratch);
        for (let j = 0; j < queryScratch.length; j++) {
          const e = queryScratch[j];
          if (!e.stats.dead && collision.circleCircle(b, e)) {
            spawnFloatingText(e.x, e.y - e.r, `-${Math.round(b.damage)}`, '#f3ead3');
            // Taking fire alerts an enemy in 'search' state to 'track' toward the player
            if (e.fsm.currentStateName === 'search') {
              e.fsm.change('track');
            }
            if (e.stats.takeDamage(b.damage)) {
              events.emit('enemyKilled', { enemy: e });
            } else {
              spawnBurst(b.x, b.y, '#f3ead3', 3);
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

    // Update Enemy Bullets
    for (let i = activeEnemyBullets.length - 1; i >= 0; i--) {
      const eb = activeEnemyBullets[i];
      eb.x += eb.vx * (dt / 1000);
      eb.y += eb.vy * (dt / 1000);
      eb.life -= dt;

      let remove = eb.life <= 0 || Math.abs(eb.x) > ARENA_HALF || Math.abs(eb.y) > ARENA_HALF;
      if (!remove) {
        for (let j = 0; j < obstacles.length; j++) {
          if (collision.circleBox(eb, obstacles[j])) {
            remove = true;
            break;
          }
        }
      }
      if (!remove && !invulnFrames && collision.circleCircle(eb, playerCircle)) {
        remove = true;
        invulnFrames = true;
        events.emit('playerDamaged', { amount: eb.damage });
        timer.add(450, () => { invulnFrames = false; });
      }
      if (remove) {
        enemyBulletPool.release(eb);
        activeEnemyBullets.splice(i, 1);
      }
    }

    // Update Enemies (StateMachine + lineOfSight + FlowField + steering)
    aiCounts.engage = 0;
    aiCounts.track = 0;
    aiCounts.search = 0;

    for (let i = activeEnemies.length - 1; i >= 0; i--) {
      const e = activeEnemies[i];
      if (e.stats.dead) {
        grid.remove(e);
        enemyPool.release(e);
        activeEnemies.splice(i, 1);
        continue;
      }

      // Run enemy AI StateMachine ('search', 'engage', or 'track')
      e.fsm.update(dt);
      aiCounts[e.fsm.currentStateName] = (aiCounts[e.fsm.currentStateName] || 0) + 1;

      grid.queryRadius(e.x, e.y, e.r + 26, queryScratch);
      steering.separate(e, queryScratch, e.r * 2.3, e.speed, sepForce);
      steerForce.x += sepForce.x * 1.35;
      steerForce.y += sepForce.y * 1.35;

      // Soft wall-avoidance feeler so enemies smoothly round corners without scraping walls
      const padCircle = { x: e.x, y: e.y, r: e.r + 14 };
      for (let j = 0; j < obstacles.length; j++) {
        const nearWall = collision.circleBoxInfo(padCircle, obstacles[j], manifold);
        if (nearWall) {
          steerForce.x += nearWall.nx * e.maxForce * 0.85;
          steerForce.y += nearWall.ny * e.maxForce * 0.85;
        }
      }

      steering.applyForce(e, steerForce, e.maxForce, e.speed, dt);
      e.spin += dt * 0.008;

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
          // Slide velocity along the wall tangent instead of pushing into the wall normal
          const dot = e.vx * hit.nx + e.vy * hit.ny;
          if (dot < 0) {
            e.vx -= hit.nx * dot;
            e.vy -= hit.ny * dot;
          }
        }
      }

      e.x = Math.max(-ARENA_HALF + e.r, Math.min(ARENA_HALF - e.r, e.x));
      e.y = Math.max(-ARENA_HALF + e.r, Math.min(ARENA_HALF - e.r, e.y));
      grid.update(e);

      if (!invulnFrames && collision.circleCircle(e, playerCircle)) {
        invulnFrames = true;
        events.emit('playerDamaged', { amount: e.stats.get('damage') });
        timer.add(450, () => { invulnFrames = false; });
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
        if (progression.addXp(val) > 0) {
          gameFsm.change('levelup');
        }
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

gameFsm.add('paused', {
  enter: () => {
    overlay.classList.remove('hidden');
    const tempList = Array.from(activeTempBuffs.values());
    const rankedList = [];
    for (const u of progression.upgrades.values()) {
      const r = progression.getRank(u.id);
      if (r > 0) rankedList.push({ ...u, rank: r });
    }

    overlay.innerHTML = `
      <h2>Character, Inventory &amp; Buffs</h2>
      <p>Game paused. All cooldowns, wave spawners, and bomb fuses are frozen.</p>
      <div class="char-sheet">
        <div class="sheet-box">
          <h3>Player Stats</h3>
          <div class="stat-row"><span>Health</span><strong>${Math.ceil(player.stats.health)} / ${Math.ceil(player.stats.maxHealth)} HP</strong></div>
          <div class="stat-row"><span>Damage</span><strong>${player.stats.get('damage').toFixed(1)}</strong></div>
          <div class="stat-row"><span>Fire Delay</span><strong>${Math.max(45, player.stats.get('fireDelay')).toFixed(0)} ms</strong></div>
          <div class="stat-row"><span>Move Speed</span><strong>${player.stats.get('speed').toFixed(0)} px/s</strong></div>
          <div class="stat-row"><span>Bullet Speed</span><strong>${player.stats.get('bulletSpeed').toFixed(0)} px/s</strong></div>
          <div class="stat-row"><span>Bullet Pierce</span><strong>${Math.floor(player.stats.get('pierce'))}</strong></div>
          <div class="stat-row"><span>Pickup Range</span><strong>${player.stats.get('pickupRadius').toFixed(0)} px</strong></div>
          <div class="stat-row"><span>Inventory Belt</span><strong>[1] Med:${inventory.count('medkit')} [2] Bomb:${inventory.count('bomb')} [3] Spd:${inventory.count('haste')}</strong></div>
        </div>
        <div class="sheet-box">
          <h3>Active Buffs &amp; Progression Ranks</h3>
          <div class="buff-list">
            ${tempList.map((b) => `
              <div class="buff-item temp">
                <span>${b.label}</span>
                <small>${(b.remainingMs / 1000).toFixed(1)}s</small>
              </div>
            `).join('')}
            ${rankedList.map((u) => `
              <div class="buff-item">
                <span>${u.title} <small>(${u.desc})</small></span>
                <small>Rank ${u.rank}/${u.maxRank}</small>
              </div>
            `).join('')}
            ${tempList.length === 0 && rankedList.length === 0 ? '<small style="color:var(--muted);">No buffs or upgrades active yet.</small>' : ''}
          </div>
        </div>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button id="resumeBtn" class="primary">Resume Game (Tab / P)</button>
        <button id="sheetRegenBtn">Regenerate Map</button>
      </div>
    `;

    document.getElementById('resumeBtn').addEventListener('click', () => gameFsm.change('playing'));
    document.getElementById('sheetRegenBtn').addEventListener('click', () => {
      regenerateArena(true);
      gameFsm.change('playing');
    });
  },
  update: () => {
    if (input.isPressed('pause')) gameFsm.change('playing');
  }
});

gameFsm.add('levelup', {
  enter: () => {
    const choices = progression.rollChoices(3, () => rng.next());
    if (choices.length === 0) {
      progression.pendingLevels = 0;
      gameFsm.change('playing');
      return;
    }

    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h2>Level ${progression.level} — Choose an Upgrade</h2>
      <p>Select one upgrade (weighted draft via Progression module):</p>
      <div class="upgrade-grid">
        ${choices.map((c, idx) => `
          <button class="upgrade-btn" data-idx="${idx}">
            <span class="tag">${c.tag} &bull; Rank ${c.currentRank}/${c.maxRank}</span>
            <h4>${c.title}</h4>
            <span>${c.desc}</span>
          </button>
        `).join('')}
      </div>
    `;

    overlay.querySelectorAll('.upgrade-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pick = choices[Number(btn.dataset.idx)];
        progression.selectUpgrade(pick.id, player);
        spawnFloatingText(player.pos.x, player.pos.y - 20, `${pick.title.toUpperCase()}`, '#f3ead3', 750);
        if (progression.pendingLevels > 0) {
          gameFsm.change('levelup');
        } else {
          gameFsm.change('playing');
        }
      });
    });
  }
});

gameFsm.add('gameover', {
  enter: () => {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h2 style="color: #c96b6b;">Game Over</h2>
      <p>
        Survived <strong>${(survivalTime / 1000).toFixed(1)}s</strong> on Seed <code>${seedInput.value}</code><br>
        Wave ${spawner.waveNumber} &nbsp;|&nbsp; Level ${progression.level} &nbsp;|&nbsp; Kills: ${kills} &nbsp;|&nbsp; Score: ${score}
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

const drawEnemyShape = (e, dimmed = false) => {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (dimmed) {
    ctx.strokeStyle = '#233452';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, e.r - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.fillStyle = e.color;

  if (e.shape === 'dart') {
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.moveTo(e.r + 2, 0);
    ctx.lineTo(-e.r, -e.r * 0.78);
    ctx.lineTo(-e.r * 0.45, 0);
    ctx.lineTo(-e.r, e.r * 0.78);
    ctx.closePath();
    ctx.fill();
  } else if (e.shape === 'spinner') {
    ctx.rotate(e.spin);
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
    ctx.beginPath();
    ctx.moveTo(e.r + 4, 0);
    ctx.lineTo(0, -e.r * 0.65);
    ctx.lineTo(-e.r, 0);
    ctx.lineTo(0, e.r * 0.65);
    ctx.closePath();
    ctx.fill();
  } else if (e.shape === 'ranged') {
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-e.r, -e.r, e.r * 2, e.r * 2);
  } else {
    ctx.rotate(e.angle);
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
    ctx.fillStyle = '#101624';
    ctx.fillRect(-e.r * 0.45, -e.r * 0.45, e.r * 0.9, e.r * 0.9);
  }

  // Subtle state indicator above enemies in 'track' or 'search' state
  const st = e.fsm.currentStateName;
  if (st === 'track') {
    ctx.fillStyle = '#d9b978';
    ctx.fillRect(-2, -e.r - 6, 4, 2);
  } else if (st === 'search') {
    ctx.fillStyle = '#8e9bb0';
    ctx.fillRect(-1.5, -e.r - 6, 3, 2);
  }

  ctx.restore();
};

const drawPickupShape = (p) => {
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = '#101624';
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

  if (p.type.id === 'medkit') {
    ctx.fillRect(-2, -6, 4, 12);
    ctx.fillRect(-6, -2, 12, 4);
  } else if (p.type.id === 'haste') {
    ctx.beginPath();
    ctx.moveTo(-3, -5); ctx.lineTo(3, 0); ctx.lineTo(-3, 5);
    ctx.moveTo(1, -5); ctx.lineTo(6, 0); ctx.lineTo(1, 5);
    ctx.stroke();
  } else if (p.type.id === 'rapid') {
    ctx.fillRect(-5, -5, 4, 10);
    ctx.fillRect(1, -5, 4, 10);
  } else if (p.type.id === 'bomb') {
    ctx.beginPath();
    ctx.arc(0, 1, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type.id === 'magnet') {
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
};

const drawPlayer = () => {
  ctx.save();
  ctx.translate(player.pos.x, player.pos.y);

  ctx.strokeStyle = 'rgba(243, 234, 211, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, player.stats.get('pickupRadius'), 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(player.facing);

  ctx.fillStyle = '#8e9bb0';
  ctx.fillRect(6, -3.5, player.r + 7, 7);

  ctx.fillStyle = invulnFrames ? '#ffffff' : '#f3ead3';
  ctx.strokeStyle = '#080b12';
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

  ctx.fillStyle = '#182236';
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
  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  camera.apply(ctx);

  for (let i = 0; i < floorDecals.length; i++) {
    const d = floorDecals[i];
    ctx.fillStyle = d.variant === 0 ? '#0d121d' : '#0b1019';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = '#141c2c';
    ctx.lineWidth = 1;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
  }

  if (showFlowArrows) {
    ctx.strokeStyle = '#233452';
    ctx.lineWidth = 1;
    for (let r = 0; r < flowField.rows; r++) {
      for (let c = 0; c < flowField.cols; c++) {
        const idx = r * flowField.cols + c;
        const vx = flowField.dirX[idx];
        const vy = flowField.dirY[idx];
        if (vx !== 0 || vy !== 0) {
          const cx = flowField.originX + c * FLOW_CELL + FLOW_CELL * 0.5;
          const cy = flowField.originY + r * FLOW_CELL + FLOW_CELL * 0.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + vx * 9, cy + vy * 9);
          ctx.stroke();
        }
      }
    }
  }

  if (visionMode) {
    lineOfSight.castVisionPolygon(player.pos, player.facing, Math.PI * 0.65, 420, 64, obstacles, visionPoly);
    lineOfSight.filterVisible(player.pos, player.facing, activeEnemies, 420, Math.PI * 0.65, obstacles, visibleSet);

    if (visionPoly.length > 1) {
      ctx.fillStyle = 'rgba(243, 234, 211, 0.09)';
      ctx.beginPath();
      ctx.moveTo(player.pos.x, player.pos.y);
      for (let i = 0; i < visionPoly.length; i++) {
        ctx.lineTo(visionPoly[i].x, visionPoly[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.strokeStyle = '#c96b6b';
  ctx.lineWidth = 4;
  ctx.strokeRect(-ARENA_HALF, -ARENA_HALF, WORLD_SIZE, WORLD_SIZE);

  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    ctx.fillStyle = '#101624';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#182236';
    ctx.fillRect(o.x + 6, o.y + 6, o.w - 12, o.h - 12);
    ctx.strokeStyle = '#233452';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  for (let i = 0; i < activeBombs.length; i++) {
    const b = activeBombs[i];
    ctx.strokeStyle = '#c96b6b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(201, 107, 107, 0.16)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * b.progress, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < activeGems.length; i++) {
    const g = activeGems[i];
    ctx.fillStyle = g.value >= 5 ? '#d9b978' : '#f3ead3';
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

  ctx.fillStyle = '#f3ead3';
  for (let i = 0; i < activeBullets.length; i++) {
    const b = activeBullets[i];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillRect(-6, -2, 12, 4);
    ctx.restore();
  }

  ctx.fillStyle = '#d9b978';
  for (let i = 0; i < activeEnemyBullets.length; i++) {
    const eb = activeEnemyBullets[i];
    ctx.beginPath();
    ctx.arc(eb.x, eb.y, eb.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < activeEnemies.length; i++) {
    const e = activeEnemies[i];
    const dimmed = visionMode && !visibleSet.includes(e);
    drawEnemyShape(e, dimmed);
  }

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

  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#080b12';
  for (let i = 0; i < activeTexts.length; i++) {
    const t = activeTexts[i];
    ctx.globalAlpha = Math.max(0, 1 - t.life / t.maxLife);
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  ctx.strokeStyle = '#f3ead3';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(worldMouse.x - 8, worldMouse.y); ctx.lineTo(worldMouse.x - 3, worldMouse.y);
  ctx.moveTo(worldMouse.x + 3, worldMouse.y); ctx.lineTo(worldMouse.x + 8, worldMouse.y);
  ctx.moveTo(worldMouse.x, worldMouse.y - 8); ctx.lineTo(worldMouse.x, worldMouse.y - 3);
  ctx.moveTo(worldMouse.x, worldMouse.y + 3); ctx.lineTo(worldMouse.x, worldMouse.y + 8);
  ctx.stroke();

  // Screen-Space HUD
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.fillStyle = '#182236';
  ctx.fillRect(16, 16, 220, 16);
  ctx.fillStyle = '#c96b6b';
  ctx.fillRect(16, 16, 220 * player.stats.healthRatio, 16);
  ctx.fillStyle = '#f3ead3';
  ctx.font = '11px monospace';
  ctx.fillText(`HP ${Math.ceil(player.stats.health)} / ${Math.ceil(player.stats.maxHealth)}`, 22, 28);

  ctx.fillStyle = '#182236';
  ctx.fillRect(16, 36, 220, 9);
  ctx.fillStyle = '#f3ead3';
  ctx.fillRect(16, 36, 220 * progression.xpRatio, 9);

  const dashState = abilities.getState('dash');
  const shockState = abilities.getState('shockwave');

  ctx.fillStyle = '#182236';
  ctx.fillRect(16, 50, 105, 12);
  ctx.fillStyle = dashState.ready ? '#78b0d9' : '#233452';
  ctx.fillRect(16, 50, 105 * (1 - dashState.cooldownRatio), 12);
  ctx.fillStyle = '#f3ead3';
  ctx.font = '10px monospace';
  ctx.fillText(`DASH (${dashState.charges}/${dashState.maxCharges})`, 20, 60);

  ctx.fillStyle = '#182236';
  ctx.fillRect(127, 50, 109, 12);
  ctx.fillStyle = shockState.ready ? '#d9b978' : '#233452';
  ctx.fillRect(127, 50, 109 * (1 - shockState.cooldownRatio), 12);
  ctx.fillStyle = '#f3ead3';
  ctx.fillText(shockState.ready ? 'SHOCKWAVE [F]' : `SHOCK ${(shockState.cooldownLeft / 1000).toFixed(1)}s`, 131, 60);

  const beltItems = [
    { key: '1', id: 'medkit', label: 'Medkit', color: '#6bc98f' },
    { key: '2', id: 'bomb', label: 'Bomb', color: '#c96b6b' },
    { key: '3', id: 'haste', label: 'Speed', color: '#78b0d9' }
  ];
  for (let i = 0; i < beltItems.length; i++) {
    const bi = beltItems[i];
    const count = inventory.count(bi.id);
    const bx = 16 + i * 86;
    const by = canvas.height - 42;
    ctx.fillStyle = '#101624';
    ctx.strokeStyle = count > 0 ? bi.color : '#233452';
    ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, 80, 28);
    ctx.strokeRect(bx, by, 80, 28);
    ctx.fillStyle = count > 0 ? '#f3ead3' : '#8e9bb0';
    ctx.font = '10px monospace';
    ctx.fillText(`[${bi.key}] ${bi.label}:${count}`, bx + 5, by + 18);
  }

  let buffY = 70;
  for (const buff of activeTempBuffs.values()) {
    const ratio = buff.remainingMs / buff.durationMs;
    ctx.fillStyle = '#101624';
    ctx.fillRect(16, buffY, 175, 14);
    ctx.fillStyle = buff.color;
    ctx.fillRect(16, buffY, 175 * ratio, 14);
    ctx.fillStyle = '#080b12';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`${buff.shortName} ${(buff.remainingMs / 1000).toFixed(1)}s`, 20, buffY + 11);
    buffY += 18;
  }

  ctx.fillStyle = '#f3ead3';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`LVL ${progression.level}  |  WAVE ${spawner.waveNumber}  |  MAP ${mapCount}  |  SCORE ${score}`, 255, 29);

  telemetryEl.textContent =
    `=== 20-MODULE LIVE TELEMETRY ===\n` +
    `[1. GameLoop]       FPS: ${loop.fps} | Step: ${loop.step.toFixed(1)}ms\n` +
    `[2. StateMachine]   Game: "${gameFsm.currentStateName}"\n` +
    `                    AI States -> Engage:${aiCounts.engage} Track:${aiCounts.track} Search:${aiCounts.search}\n` +
    `[3. Random]         Seed: "${seedInput.value}"\n` +
    `[4. TimerManager]   Active Timers: ${timer.timers.length}\n` +
    `[5. Vec2]           Player: (${player.pos.x.toFixed(0)}, ${player.pos.y.toFixed(0)})\n` +
    `[6. Camera]         Zoom: ${camera.zoom.toFixed(2)}x | Shake: ${camera.shakeTimer > 0 ? 'ON' : 'idle'}\n` +
    `[7. InputManager]   Mouse: (${input.mouse.x.toFixed(0)}, ${input.mouse.y.toFixed(0)})\n` +
    `[8. EventEmitter]   Kills: ${kills} | Time: ${(survivalTime / 1000).toFixed(1)}s\n` +
    `[9. SpatialHash]    Tracked: ${grid.size} | Cells: ${grid.cellCount}\n` +
    `[10. Pool]          Mobs:${enemyPool.inUse} Bullets:${bulletPool.inUse} Text:${textPool.inUse}\n` +
    `[11. collision]     Obstacles: ${obstacles.length} (64px Corridor Pad)\n` +
    `[12. Stats]         HP: ${Math.ceil(player.stats.health)}/${Math.ceil(player.stats.maxHealth)} | Mods: ${player.stats.modifiers.size}\n` +
    `[13. AbilityMgr]    Dash: ${dashState.charges}/${dashState.maxCharges} | Shockwave: ${shockState.ready ? 'RDY' : (shockState.cooldownLeft / 1000).toFixed(1) + 's'}\n` +
    `[14. WaveSpawner]   Wave: ${spawner.waveNumber} | Spawned: ${spawner.totalSpawned}\n` +
    `[15. Progression]   Lvl: ${progression.level} (${progression.xp}/${progression.xpToNext} XP)\n` +
    `[16. LootTable]     Ground Pickups: ${activePickups.length}\n` +
    `[17. Inventory]     Slots: ${inventory.usedSlots}/${inventory.maxSlots} (Med:${inventory.count('medkit')} Bomb:${inventory.count('bomb')})\n` +
    `[18. FlowField]     Grid: ${flowField.cols}x${flowField.rows} | Player Cell: (${lastFlowCell.col},${lastFlowCell.row})\n` +
    `[19. steering]      Seek / Orbit / Flee / Wander / Separate\n` +
    `[20. lineOfSight]   Per-Enemy LOS Gate + Sight Cone (${visionMode ? 'ON' : 'OFF'})`;
};

const loop = new GameLoop(
  (dt) => {
    gameFsm.update(dt);
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
  if (gameFsm.currentStateName === 'playing' || gameFsm.currentStateName === 'paused') {
    regenerateArena(true);
  }
});

visionBtn.addEventListener('click', () => {
  visionMode = !visionMode;
  visionBtn.textContent = `Sight Cone (C): ${visionMode ? 'ON' : 'OFF'}`;
});

flowBtn.addEventListener('click', () => {
  showFlowArrows = !showFlowArrows;
  flowBtn.textContent = `Flow Arrows (V): ${showFlowArrows ? 'ON' : 'OFF'}`;
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  if (gameFsm.currentStateName === 'playing') gameFsm.change('paused');
  else if (gameFsm.currentStateName === 'paused') gameFsm.change('playing');
});

resetRun(seedInput.value);
loop.start();

// Mount 20 Full-Width (1 per row) Interactive CodeEditor Documentation Cards
const DOC_CARDS = [
  {
    title: '1. Vec2 — Movement & Aim Vectors',
    tag: 'core/vec2.js',
    desc: 'Normalizes diagonal WASD movement, computes aim direction from player to mouse, and checks XP pickup range via distanceSq().',
    code: `const moveDir = new Vec2(1, 1).normalize().mult(220 * 0.016);
const aimDir = Vec2.sub({ x: 300, y: 150 }, { x: 100, y: 100 }).normalize();
console.log('Frame step:', moveDir.x.toFixed(2), '| Aim:', aimDir.x.toFixed(2), aimDir.y.toFixed(2));`
  },
  {
    title: '2. EventEmitter — Decoupled Combat Events',
    tag: 'core/events.js',
    desc: 'Emits enemyKilled, pickupCollected, and playerDamaged so loot, scoring, and floating text react independently.',
    code: `const bus = new EventEmitter();
let score = 0;
bus.on('enemyKilled', ({ scoreValue }) => { score += scoreValue; });
bus.emit('enemyKilled', { scoreValue: 45 });
console.log('Updated Score:', score);`
  },
  {
    title: '3. GameLoop — 60Hz Fixed Timestep',
    tag: 'core/loop.js',
    desc: 'Runs gameFsm.update(dt) and input.update() at a fixed 16.67ms step with a 250ms lag clamp.',
    code: `let steps = 0;
const simLoop = new GameLoop((dt) => { steps++; }, () => {}, 60);
simLoop.isRunning = true; simLoop.lastTime = 0;
simLoop.frame(50); simLoop.stop();
console.log('Fixed steps in 50ms:', steps);`
  },
  {
    title: '4. InputManager — Action & Hotkey Bindings',
    tag: 'core/input.js',
    desc: 'Maps WASD, Shift (Dash), F/Right-Click (Shockwave), and Keys 1-3 (Inventory belt items) to edge-detected actions.',
    code: `const inp = new InputManager();
inp.detach();
inp.bind('slot1', ['Digit1']);
inp.state.set('Digit1', true);
console.log('Pressed [1] Medkit:', inp.isPressed('slot1'));`
  },
  {
    title: '5. TimerManager — Bomb Fuses & Timed Buffs',
    tag: 'core/timer.js',
    desc: 'Drives the 1.2s Time Bomb countdown ring, 10s Speed Boost durations, and 450ms hit invulnerability frames.',
    code: `const tm = new TimerManager();
tm.add(1200, () => console.log('BOOM! 140 AoE Dmg'), (p) => console.log('Fuse:', (p * 100).toFixed(0) + '%'));
tm.update(600);
tm.update(600);`
  },
  {
    title: '6. Random — Seeded Mulberry32 Runs',
    tag: 'core/random.js',
    desc: 'Feeds the same deterministic number stream into arena obstacle generation, WaveSpawner, LootTable, and Progression drafts.',
    code: `const r1 = new Random('miku-39');
const r2 = new Random('miku-39');
console.log('Match:', r1.int(1, 1000) === r2.int(1, 1000));`
  },
  {
    title: '7. Pool — 7 Zero-Allocation Entity Pools',
    tag: 'gameplay/pool.js',
    desc: 'Recycles player bullets, enemy bullets, enemies (with their own StateMachines), XP gems, pickups, particles, and floating combat text.',
    code: `const textPool = new Pool({
  create: () => ({ text: '', life: 0 }),
  init: (t, msg) => { t.text = msg; t.life = 550; },
  size: 10
});
const popup = textPool.get('-45');
console.log('Popup:', popup.text, '| In use:', textPool.inUse);`
  },
  {
    title: '8. SpatialHash — Broad-Phase Neighborhood Queries',
    tag: 'gameplay/spatialHash.js',
    desc: 'Queries only enemies near bullets, Time Bombs, and Shockwaves using a reusable scratch array.',
    code: `const hash = new SpatialHash(72);
hash.insert({ id: 'tank', x: 50, y: 50, r: 20 });
const near = [];
hash.queryRadius(40, 40, 60, near);
console.log('Hits in radius:', near.map((e) => e.id));`
  },
  {
    title: '9. collision — Overlap & Corridor Padding',
    tag: 'gameplay/collision.js',
    desc: 'Enforces a 64px corridor gap between obstacles via boxBox() and slides enemies smoothly along walls via circleBoxInfo().',
    code: `const player = { x: 192, y: 100, r: 14 };
const wall = { x: 200, y: 50, w: 80, h: 100 };
const hit = collision.circleBoxInfo(player, wall);
console.log('Push out:', hit.nx * hit.depth, 'px');`
  },
  {
    title: '10. Stats — Health, Modifiers & Clamping',
    tag: 'gameplay/stats.js',
    desc: 'Combines base stats with permanent Progression upgrades and temporary ground item buffs.',
    code: `const s = new Stats({ maxHealth: 100, speed: 220 });
s.addModifier('up_spd', 'speed', 'percent', 0.32);
s.addModifier('dashBoost', 'speed', 'percent', 1.5);
console.log('Dash Speed:', s.get('speed'));`
  },
  {
    title: '11. StateMachine — Per-Enemy AI (search / engage / track) & Game Flow',
    tag: 'gameplay/stateMachine.js',
    desc: 'Each enemy runs its own StateMachine: "engage" when lineOfSight is clear, "track" (FlowField pathing) when a wall blocks sight, and "search" (wander) when aggro expires.',
    code: `const aiFsm = new StateMachine();
const walls = [{ x: 100, y: 0, w: 40, h: 200 }];
const enemy = { x: 40, y: 80 };
const target = { x: 220, y: 80 };

aiFsm
  .add('engage', { enter: () => console.log('AI -> ENGAGE (Direct Sight)') })
  .add('track',  { enter: () => console.log('AI -> TRACK (Blocked by wall, following FlowField)') })
  .add('search', { enter: () => console.log('AI -> SEARCH (Wandering patrol)') });

const canSee = lineOfSight.hasLineOfSight(enemy, target, walls);
aiFsm.change(canSee ? 'engage' : 'track');`
  },
  {
    title: '12. Camera — Smooth Damping, Shake & Zoom',
    tag: 'gameplay/camera.js',
    desc: 'Follows the player with dt-independent lerp, shakes on explosions, and projects mouse coordinates to world space.',
    code: `const cam = new Camera(800, 540);
cam.follow({ x: 250, y: 180 }, 1);
console.log('World center at (400,270):', cam.screenToWorld(400, 270));`
  },
  {
    title: '13. AbilityManager — Auto-Gun, 2-Charge Dash & Shockwave',
    tag: 'gameplay/abilities.js',
    desc: 'Manages the auto-firing primary gun (scaled by fireDelay), 2-charge Dash with 200ms duration, and 5s Shockwave skill.',
    code: `const ab = new AbilityManager();
ab.register('dash', { cooldown: 1800, charges: 2, duration: 200 });
ab.use('dash');
console.log('Dash state:', ab.getState('dash'));`
  },
  {
    title: '14. WaveSpawner — Escalating Ring Waves',
    tag: 'gameplay/spawner.js',
    desc: 'Spawns batches of enemies in a 430..600px ring around the player using weighted enemy pools.',
    code: `const ws = new WaveSpawner();
ws.addWave({ duration: 14000, interval: 1000, count: 4, types: [{ id: 'dart', weight: 3 }, { id: 'tank', weight: 1 }] });
ws.update(1000, 0, 0, (s) => console.log('Spawn:', s.type, s.x.toFixed(0), s.y.toFixed(0)));`
  },
  {
    title: '15. Progression — XP Curve & Ranked Upgrade Drafts',
    tag: 'gameplay/progression.js',
    desc: 'Tracks XP, queues pending level-ups, enforces maxRank limits, and rolls 3 weighted upgrade choices.',
    code: `const prog = new Progression({ baseXp: 10 });
prog.registerUpgrade({ id: 'dmg', title: 'Damage Up', maxRank: 2 });
prog.addXp(15);
console.log('Level:', prog.level, '| Draft:', prog.rollChoices(3).map((c) => c.title));`
  },
  {
    title: '16. LootTable — Weighted Enemy Item Drops',
    tag: 'gameplay/loot.js',
    desc: 'Rolls mobLoot (14% chance) on regular kills and tankLoot (65% chance) on heavy tank kills.',
    code: `const loot = new LootTable({ dropChance: 1.0 })
  .add('medkit', { weight: 50 })
  .add('bomb', { weight: 50 });
console.log('Rolled drop:', loot.roll());`
  },
  {
    title: '17. Inventory — 3-Slot Tactical Consumable Belt',
    tag: 'gameplay/inventory.js',
    desc: 'Stores looted Medkits [1], Time Bombs [2], and Speed Boosts [3] up to 5 per stack and triggers them on keypress.',
    code: `const inv = new Inventory({ maxSlots: 3 });
let hp = 50;
inv.defineItem('medkit', { maxStack: 5, onUse: () => { hp += 50; } });
inv.add('medkit', 2);
inv.use('medkit');
console.log('HP after [1]:', hp, '| Left:', inv.count('medkit'));`
  },
  {
    title: '18. FlowField — Wall-Hugging Safe Pathfinding',
    tag: 'ai/flowField.js',
    desc: 'Used by enemies in the "track" state to walk around obstacle corners when line of sight is blocked.',
    code: `const ff = new FlowField({ cols: 10, rows: 10, cellSize: 32 });
ff.setObstacleRect(96, 32, 32, 160, 8);
ff.compute(100, 96); // Target hugging the wall still snaps to nearest open cell
console.log('Detour vector around block:', ff.sample(64, 96));`
  },
  {
    title: '19. steering — State-Driven Seek, Orbit, Flee & Wander',
    tag: 'ai/steering.js',
    desc: 'Applies wander() in "search" state, FlowField vectors in "track" state, and seek()/orbit()/flee() in "engage" state.',
    code: `const mob = { x: 100, y: 100, vx: 40, vy: 0 };
const wForce = steering.wander(mob, 120);
console.log('Patrol wander force:', wForce.x.toFixed(1), wForce.y.toFixed(1));`
  },
  {
    title: '20. lineOfSight — AI Perception Gate & Player Sight Cone',
    tag: 'ai/lineOfSight.js',
    desc: 'Gates enemy state transitions between "engage" (direct sight) and "track" (blocked by wall), and renders the Player Sight Cone [C].',
    code: `const walls = [{ x: 100, y: 0, w: 40, h: 100 }];
const hasLOS = lineOfSight.hasLineOfSight({ x: 20, y: 50 }, { x: 200, y: 50 }, walls);
console.log('Has LOS through block:', hasLOS, '-> State:', hasLOS ? 'engage' : 'track');`
  }
];

const docsMount = document.getElementById('showcase-docs-mount');
DOC_CARDS.forEach((card) => {
  new CodeEditor(docsMount, {
    title: card.title,
    tag: card.tag,
    desc: card.desc,
    code: card.code,
    autoRun: true
  });
});