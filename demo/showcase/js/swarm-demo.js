import {
  Vec2,
  EventEmitter,
  GameLoop,
  InputManager,
  TimerManager,
  Random,
  StorageManager,
  SoundManager,
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
  StatusEffectManager,
  WeaponSystem,
  steering,
  FlowField,
  lineOfSight,
  SwarmDirector,
  Tilemap,
  TilemapRenderer,
  procgen,
  ParticleSystem,
  FloatingTextSystem,
  DevConsole,
  DialogueSystem
} from '../../../index.js';
import { CodeEditor } from '../../code-editor.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const telemetryEl = document.getElementById('telemetry');
const seedInput = document.getElementById('seedInput');
const aiModeBtn = document.getElementById('aiModeBtn');
const weaponModeBtn = document.getElementById('weaponModeBtn');
const elementModeBtn = document.getElementById('elementModeBtn');
const shrineBtn = document.getElementById('shrineBtn');
const regenMapBtn = document.getElementById('regenMapBtn');
const chunkBtn = document.getElementById('chunkBtn');
const visionBtn = document.getElementById('visionBtn');
const flowBtn = document.getElementById('flowBtn');
const consoleBtn = document.getElementById('consoleBtn');
const muteBtn = document.getElementById('muteBtn');

const WORLD_SIZE = 1600;
const ARENA_HALF = WORLD_SIZE / 2;
const TILE_SIZE = 32;
const GRID_COLS = WORLD_SIZE / TILE_SIZE;

const events = new EventEmitter();
const input = new InputManager(canvas);
const timer = new TimerManager();
const rng = new Random(seedInput.value);
const storage = new StorageManager({ namespace: 'gamekit_swarm_showcase' });
const audio = new SoundManager({ masterVolume: 0.35 });
const camera = new Camera(canvas.width, canvas.height);
const grid = new SpatialHash(72);
const gameFsm = new StateMachine();
const abilities = new AbilityManager();
const spawner = new WaveSpawner({ rng: () => rng.next() });
const director = new SwarmDirector({
  rng: () => rng.next(),
  maxActive: 95,
  baseCreditRate: 4.2,
  spawnInterval: 1200,
  buildupDuration: 12000,
  peakDuration: 4500,
  breatherDuration: 3500
});
const progression = new Progression({ baseXp: 10, growthFactor: 1.35, linearStep: 6 });
const inventory = new Inventory({ maxSlots: 3 });
const statuses = new StatusEffectManager();
const weapons = new WeaponSystem({ maxProjectiles: 900, maxZones: 40 });
const devConsole = new DevConsole({ toggleKey: 'Backquote', sampleCount: 80 });

const tilemap = new Tilemap({
  cols: GRID_COLS,
  rows: GRID_COLS,
  tileSize: TILE_SIZE,
  originX: -ARENA_HALF,
  originY: -ARENA_HALF
});

const mapRenderer = new TilemapRenderer(tilemap, { chunkSize: 16 });

const flowField = new FlowField({
  cols: GRID_COLS,
  rows: GRID_COLS,
  cellSize: TILE_SIZE,
  originX: -ARENA_HALF,
  originY: -ARENA_HALF
});

const particles = new ParticleSystem({
  maxParticles: 1200,
  preallocate: 250,
  rng: () => rng.next()
});

const combatText = new FloatingTextSystem({
  maxItems: 300,
  preallocate: 60,
  rng: () => rng.next()
});

const mobLoot = new LootTable({ dropChance: 0.16 })
  .add('medkit', { weight: 38, min: 1, max: 1 })
  .add('bomb', { weight: 27, min: 1, max: 1 })
  .add('haste', { weight: 20, min: 1, max: 1 })
  .add('rapid', { weight: 10, min: 1, max: 1 })
  .add('magnet', { weight: 5, min: 1, max: 1 });

const tankLoot = new LootTable({ dropChance: 0.7 })
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
input.bind('cryoZone', ['KeyE']);
input.bind('cycleWeapon', ['KeyQ']);
input.bind('cycleElement', ['KeyR']);
input.bind('toggleAiMode', ['KeyB']);
input.bind('interactShrine', ['KeyH']);
input.bind('slot1', ['Digit1']);
input.bind('slot2', ['Digit2']);
input.bind('slot3', ['Digit3']);
input.bind('pause', ['KeyP', 'Tab', 'Escape']);
input.bind('regen', ['KeyG']);
input.bind('toggleChunks', ['KeyX']);
input.bind('toggleVision', ['KeyC']);
input.bind('toggleFlow', ['KeyV']);
input.bind('toggleMute', ['KeyM']);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const manifold = { nx: 0, ny: 0, depth: 0 };
const tileHit = { hit: false, nx: 0, ny: 0, depth: 0 };
const slotTarget = { x: 0, y: 0, ringIndex: 0, slotIndex: 0 };
const queryScratch = [];
const effectScratch = [];
const visibleSet = [];
const visionPoly = [];
const flowDir = { x: 0, y: 0 };
const steerForce = { x: 0, y: 0 };
const sepForce = { x: 0, y: 0 };
const worldMouse = new Vec2();
const moveDir = new Vec2();
const aimDir = new Vec2(1, 0);

const BIOMES = ['arena', 'cave', 'dungeon'];
const WEAPON_MODES = ['linear', 'spread', 'ricochet', 'boomerang'];
const ELEMENT_MODES = ['burn', 'chill', 'stun'];

let biomeIndex = 0;
let weaponModeIndex = 0;
let elementModeIndex = 0;
let useDirectorMode = true;
let showChunkBorders = false;
let visionMode = false;
let showFlowArrows = false;
let godMode = false;

let score = 0;
let kills = 0;
let survivalTime = 0;
let mapCount = 1;
let orbiterRank = 1;
let shrineBuffCount = 0;
let invulnFrames = false;
let lastDirectorPhase = 'buildup';
let lastFlowCell = { col: -1, row: -1 };
let aiCounts = { engage: 0, track: 0, search: 0 };

const shrineEntity = { x: 140, y: -110, r: 22, cooldown: 0 };

const activeEnemies = [];
const activeGems = [];
const activePickups = [];
const activeBombs = [];
const obstacles = [];

const saveRecord = () => {
  const bestScore = Math.max(score, storage.get('highScore', 0));
  const bestWave = Math.max(
    useDirectorMode ? director.waveNumber : spawner.waveNumber,
    storage.get('bestWave', 1)
  );
  const totalKills = storage.get('lifetimeKills', 0) + kills;
  storage.setMany({
    highScore: bestScore,
    bestWave,
    lifetimeKills: totalKills,
    lastSeed: seedInput.value
  });
};

const ITEM_TYPES = {
  medkit: { id: 'medkit', shortName: 'MEDKIT', label: 'Medkit (+50 HP & Cleanse)', color: '#6bc98f', storable: true, r: 11 },
  bomb: { id: 'bomb', shortName: 'BREACH BOMB', label: 'Breach Bomb (140 AoE Dmg + Destroys Walls)', color: '#c96b6b', storable: true, r: 11 },
  haste: { id: 'haste', shortName: 'OVERCHARGE', label: 'Overcharge (+55% Speed & HoT, 8s)', color: '#78b0d9', storable: true, r: 11 },
  rapid: { id: 'rapid', shortName: 'FRENZY', label: 'Frenzy (-40% Fire Delay, 7s)', color: '#d9b978', storable: false, r: 11 },
  magnet: { id: 'magnet', shortName: 'MAGNET', label: 'Magnet (Pull All XP)', color: '#f3ead3', storable: false, r: 11 }
};

const ENEMY_PRESETS = {
  dart:    { r: 12, speed: 115, hp: 28, damage: 12, color: '#c96b6b', shape: 'dart',    sight: 460, xp: 1, score: 10 },
  spinner: { r: 11, speed: 160, hp: 20, damage: 10, color: '#b08ed9', shape: 'spinner', sight: 480, xp: 2, score: 15 },
  lancer:  { r: 13, speed: 138, hp: 44, damage: 14, color: '#78b0d9', shape: 'lancer',  sight: 500, xp: 3, score: 20 },
  ranged:  { r: 12, speed: 126, hp: 34, damage: 11, color: '#d9b978', shape: 'ranged',  sight: 460, xp: 4, score: 25 },
  tank:    { r: 18, speed: 78,  hp: 95, damage: 24, color: '#e69f66', shape: 'tank',    sight: 520, xp: 7, score: 45 }
};

const player = {
  pos: new Vec2(0, 0),
  r: 13,
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

const emitParticles = (x, y, color, count = 8, speedMax = 180, isExplosion = false) => {
  particles.emit(x, y, {
    count,
    color,
    speedMin: 35,
    speedMax,
    sizeMin: isExplosion ? 3 : 2.5,
    sizeMax: isExplosion ? 5.5 : 4,
    lifeMin: 160,
    lifeMax: isExplosion ? 520 : 360,
    glow: isExplosion
  });
};

const spawnFloatingText = (x, y, text, color = '#f3ead3', duration = 560) => {
  combatText.spawn(x, y - 10, text, { color, duration, jitterX: 8 });
};

const syncPlayerOrbiters = () => {
  weapons.setOrbiters(player, {
    count: orbiterRank,
    radius: 56,
    speed: 3.4,
    r: 6,
    damage: Math.round(player.stats.get('damage') * 0.65),
    hitCooldown: 380,
    team: 'player',
    color: '#d9b978'
  });
};

// Configure DialogueSystem branching Corrupt Shrine encounter + non-blocking radio barks
const dialogue = new DialogueSystem({
  charsPerSecond: 55,
  onEnd: () => {
    if (gameFsm.currentStateName === 'dialogue') {
      gameFsm.change('playing');
    }
  }
});

dialogue
  .addNode('shrine_root', {
    speaker: 'CORRUPT OBELISK // SECTOR SHRINE',
    text: 'The obelisk resonates with the swarm hive. Make an offering or step back:',
    choices: [
      {
        label: 'Blood Pact: Sacrifice 30 HP -> Gain +30% Weapon Damage & 1 Orbiter Blade (Requires >30 HP)',
        next: 'shrine_pact_done',
        condition: (p) => p.stats.health > 30,
        action: (p) => {
          p.stats.takeDamage(30);
          shrineBuffCount++;
          p.stats.addModifier(`shrine_dmg_${shrineBuffCount}`, 'damage', 'percent', 0.3);
          orbiterRank++;
          syncPlayerOrbiters();
          audio.play('levelup');
          spawnFloatingText(p.pos.x, p.pos.y - 20, 'BLOOD PACT: +30% DMG & +1 ORBITER', '#c96b6b', 900);
        }
      },
      {
        label: 'Supply Drop: Spend 50 Score -> Receive 2 Breach Bombs & Overcharge (Requires >=50 Score)',
        next: 'shrine_supply_done',
        condition: () => score >= 50,
        action: (p) => {
          score -= 50;
          inventory.add('bomb', 2);
          statuses.apply(p, 'overcharge');
          audio.play('pickup');
          spawnFloatingText(p.pos.x, p.pos.y - 20, '+2 BOMBS & OVERCHARGE', '#78b0d9', 900);
        }
      },
      {
        label: 'Emergency Nanites: Restore +35 HP & Cleanse Debuffs (Free)',
        next: 'shrine_heal_done',
        action: (p) => {
          p.stats.heal(35);
          statuses.remove(p, 'burn');
          statuses.remove(p, 'chill');
          statuses.remove(p, 'bleed');
          audio.play('pickup');
          spawnFloatingText(p.pos.x, p.pos.y - 20, '+35 HP RESTORED', '#6bc98f', 850);
        }
      },
      {
        label: 'Step away from the shrine',
        next: null
      }
    ]
  })
  .addNode('shrine_pact_done', {
    speaker: 'CORRUPT OBELISK',
    text: 'Crimson energy surges through your weapon core. Return when you hunger for more.',
    next: null
  })
  .addNode('shrine_supply_done', {
    speaker: 'CORRUPT OBELISK',
    text: 'Ordance materialized on your tactical belt. Use [2] to breach solid walls.',
    next: null
  })
  .addNode('shrine_heal_done', {
    speaker: 'CORRUPT OBELISK',
    text: 'Suit integrity stabilized. Get back into the fight.',
    next: null
  });

statuses
  .define('burn', {
    duration: 2800,
    maxStacks: 5,
    tickInterval: 550,
    color: '#c96b6b',
    onTick: (ent, inst) => {
      if (ent.stats.dead) return;
      const dmg = 5 * inst.stacks;
      const ex = ent.pos ? ent.pos.x : ent.x;
      const ey = ent.pos ? ent.pos.y : ent.y;
      spawnFloatingText(ex, ey - 10, `-${dmg}`, '#c96b6b', 420);
      if (ent === player) {
        if (!godMode && player.stats.takeDamage(dmg)) {
          saveRecord();
          gameFsm.change('gameover');
        }
      } else if (ent.stats.takeDamage(dmg)) {
        events.emit('enemyKilled', { enemy: ent });
      }
    }
  })
  .define('chill', {
    duration: 3000,
    maxStacks: 3,
    stat: 'speed',
    modType: 'percent',
    value: -0.22,
    color: '#78b0d9'
  })
  .define('stun', {
    duration: 950,
    control: 'stun',
    color: '#f3ead3'
  })
  .define('bleed', {
    duration: 2500,
    maxStacks: 3,
    tickInterval: 600,
    color: '#c96b6b',
    onTick: (ent, inst) => {
      const dmg = 4 * inst.stacks;
      const ex = ent.pos ? ent.pos.x : ent.x;
      const ey = ent.pos ? ent.pos.y : ent.y;
      spawnFloatingText(ex, ey - 14, `-${dmg} BLEED`, '#c96b6b', 500);
      if (ent === player && !godMode && player.stats.takeDamage(dmg)) {
        saveRecord();
        gameFsm.change('gameover');
      }
    }
  })
  .define('overcharge', {
    duration: 8000,
    tickInterval: 1000,
    stat: 'speed',
    modType: 'percent',
    value: 0.55,
    color: '#78b0d9',
    onTick: (ent) => {
      ent.stats.heal(6);
      const ex = ent.pos ? ent.pos.x : ent.x;
      const ey = ent.pos ? ent.pos.y : ent.y;
      spawnFloatingText(ex, ey - 16, '+6 HP', '#6bc98f', 480);
    }
  })
  .define('frenzy', {
    duration: 7000,
    stat: 'fireDelay',
    modType: 'percent',
    value: -0.4,
    color: '#d9b978'
  });

function createEnemyEntity() {
  const e = {
    x: 0, y: 0, vx: 0, vy: 0, r: 12, speed: 90, maxForce: 560, color: '#c96b6b', shape: 'dart',
    sightRange: 460, angle: 0, spin: 0, fireTimer: 0, trackTimer: 0, orbitCw: true,
    xpValue: 2, scoreValue: 10, elite: false,
    stats: new Stats({ maxHealth: 25, damage: 12, speed: 90 }),
    fsm: new StateMachine()
  };

  e.fsm.add('search', {
    update: () => {
      const distSq = Vec2.distanceSq(e, player.pos);
      const canSee = distSq <= e.sightRange * e.sightRange &&
        lineOfSight.hasLineOfSight(e, player.pos, obstacles);

      if (canSee) {
        e.fsm.change('engage');
        return;
      }

      const effSpeed = e.stats.get('speed');
      steering.wander(e, effSpeed * 0.75, { distance: 60, radius: 34, jitter: 0.3 }, steerForce);
      if (Math.hypot(e.vx, e.vy) > 5) {
        e.angle = Math.atan2(e.vy, e.vx);
      }
    }
  });

  e.fsm.add('engage', {
    update: (dt) => {
      const distSq = Vec2.distanceSq(e, player.pos);
      const canSee = lineOfSight.hasLineOfSight(e, player.pos, obstacles);

      if (!canSee) {
        e.fsm.change('track');
        return;
      }

      const effSpeed = e.stats.get('speed');
      e.angle = Math.atan2(player.pos.y - e.y, player.pos.x - e.x);

      if (e.shape === 'ranged') {
        if (distSq < 135 * 135) {
          steering.flee(e, player.pos, effSpeed, 145, steerForce);
        } else {
          steering.orbit(e, player.pos, 220, effSpeed, e.orbitCw, steerForce);
        }

        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && distSq < 390 * 390) {
          e.fireTimer = 1800;
          const aim = Math.atan2(player.pos.y - e.y, player.pos.x - e.x);
          weapons.fire(e.x, e.y, aim, {
            count: e.elite ? 3 : 1,
            spread: 0.35,
            speed: 285,
            r: 5,
            life: 2100,
            damage: e.stats.get('damage'),
            team: 'enemy',
            color: '#78b0d9',
            onHit: (targetPlayer) => {
              statuses.apply(targetPlayer, 'chill', { stacks: 1, duration: 2200 });
            }
          });
        }
      } else if (useDirectorMode) {
        director.assignSlot(e, player.pos.x, player.pos.y, slotTarget);
        steering.arrive(e, slotTarget, effSpeed, 30, steerForce);
      } else {
        steering.seek(e, player.pos, effSpeed, steerForce);
      }
    }
  });

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

      const effSpeed = e.stats.get('speed');
      flowField.sample(e.x, e.y, flowDir);
      if (flowDir.x !== 0 || flowDir.y !== 0) {
        steerForce.x = flowDir.x * effSpeed - e.vx;
        steerForce.y = flowDir.y * effSpeed - e.vy;
      } else {
        steering.wander(e, effSpeed, { distance: 50, radius: 30, jitter: 0.4 }, steerForce);
      }

      if (Math.hypot(e.vx, e.vy) > 5) {
        e.angle = Math.atan2(e.vy, e.vx);
      }
    }
  });

  return e;
}

const enemyPool = new Pool({
  create: createEnemyEntity,
  init: (e, x, y, preset, waveScale = 1, isElite = false) => {
    const startAngle = rng.range(0, Math.PI * 2);
    const eliteMult = isElite ? 1.65 : 1;
    e.x = x;
    e.y = y;
    e.vx = Math.cos(startAngle) * 40;
    e.vy = Math.sin(startAngle) * 40;
    e.r = isElite ? Math.round(preset.r * 1.25) : preset.r;
    e.elite = isElite;
    e.speed = preset.speed * (1 + (waveScale - 1) * 0.05);
    e.maxForce = 620;
    e.color = isElite ? '#f3ead3' : preset.color;
    e.shape = preset.shape;
    e.sightRange = preset.sight;
    e.angle = startAngle;
    e.spin = 0;
    e.orbitCw = rng.next() < 0.5;
    e.fireTimer = 900 + rng.range(0, 700);
    e.xpValue = Math.round(preset.xp * eliteMult);
    e.scoreValue = Math.round(preset.score * eliteMult);

    e.stats.modifiers.clear();
    e.stats.base.maxHealth = Math.round(preset.hp * (1 + (waveScale - 1) * 0.22) * eliteMult);
    e.stats.base.damage = Math.round(preset.damage * (isElite ? 1.3 : 1));
    e.stats.base.speed = e.speed;
    e.stats.dead = false;
    e.stats.health = e.stats.maxHealth;

    const hasLOS = lineOfSight.hasLineOfSight(e, player.pos, obstacles);
    e.fsm.change(hasLOS ? 'engage' : 'track');
  },
  reset: (e) => {
    statuses.clearEntity(e);
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

const findNearestWalkableWorld = (wx, wy, radius = 14) => {
  const probe = { x: wx, y: wy, r: radius };
  tilemap.collideCircle(probe, tileHit);
  if (!tilemap.isSolidAtWorld(probe.x, probe.y)) {
    return probe;
  }
  const cell = tilemap.worldToTile(wx, wy);
  for (let rad = 1; rad < 12; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const c = cell.col + dc;
        const r = cell.row + dr;
        if (tilemap.inBounds(c, r) && !tilemap.isSolid(c, r)) {
          return tilemap.tileToWorld(c, r, probe);
        }
      }
    }
  }
  return tilemap.tileToWorld(Math.floor(GRID_COLS / 2), Math.floor(GRID_COLS / 2), probe);
};

const rebuildFlowFieldWalls = () => {
  flowField.clearWalls();
  for (let i = 0; i < tilemap.data.length; i++) {
    flowField.walls[i] = tilemap.data[i];
  }
  flowField.compute(player.pos.x, player.pos.y);
  flowField.worldToCell(player.pos.x, player.pos.y, lastFlowCell);
};

const plantTimeBomb = (x, y) => {
  const bombObj = { x, y, r: 210, progress: 0 };
  activeBombs.push(bombObj);
  spawnFloatingText(x, y - 14, 'BREACH BOMB (1.2s)', '#c96b6b', 700);

  timer.add(
    1200,
    () => {
      const idx = activeBombs.indexOf(bombObj);
      if (idx !== -1) activeBombs.splice(idx, 1);

      audio.play('explosion');
      camera.shake(260, 12);
      emitParticles(bombObj.x, bombObj.y, '#c96b6b', 34, 300, true);
      spawnFloatingText(bombObj.x, bombObj.y - 16, 'BREACH BOOM!', '#c96b6b', 750);

      const centerTile = tilemap.worldToTile(bombObj.x, bombObj.y);
      const tileRad = Math.ceil((bombObj.r * 0.7) / TILE_SIZE);
      let wallsBroken = false;

      for (let dr = -tileRad; dr <= tileRad; dr++) {
        for (let dc = -tileRad; dc <= tileRad; dc++) {
          const c = centerTile.col + dc;
          const r = centerTile.row + dr;
          if (c > 1 && c < tilemap.cols - 2 && r > 1 && r < tilemap.rows - 2) {
            if (tilemap.isSolid(c, r) && dc * dc + dr * dr <= tileRad * tileRad) {
              tilemap.set(c, r, 0);
              mapRenderer.invalidateTile(c, r);
              wallsBroken = true;
            }
          }
        }
      }

      if (wallsBroken) {
        tilemap.extractWallRects(obstacles);
        rebuildFlowFieldWalls();
      }

      grid.queryRadius(bombObj.x, bombObj.y, bombObj.r, queryScratch);
      for (let i = 0; i < queryScratch.length; i++) {
        const e = queryScratch[i];
        if (!e.stats.dead && Vec2.distanceSq(e, bombObj) <= bombObj.r * bombObj.r) {
          statuses.apply(e, 'burn', { stacks: 2 });
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
      audio.play('pickup');
      player.stats.heal(50);
      statuses.remove(player, 'burn');
      statuses.remove(player, 'chill');
      statuses.remove(player, 'bleed');
      emitParticles(player.pos.x, player.pos.y, '#6bc98f', 12, 160, false);
      spawnFloatingText(player.pos.x, player.pos.y - 18, '+50 HP & CLEANSED', '#6bc98f', 750);
    }
  })
  .defineItem('bomb', {
    name: 'Breach Bomb',
    maxStack: 5,
    consumable: true,
    onUse: () => {
      plantTimeBomb(player.pos.x, player.pos.y);
    }
  })
  .defineItem('haste', {
    name: 'Overcharge',
    maxStack: 5,
    consumable: true,
    onUse: () => {
      audio.play('dash');
      statuses.apply(player, 'overcharge');
      spawnFloatingText(player.pos.x, player.pos.y - 18, 'OVERCHARGE!', '#78b0d9', 750);
    }
  });

abilities
  .register('gun', {
    cooldown: 190,
    charges: 1,
    auto: true,
    onUse: () => {
      if (statuses.isSilenced(player)) return;
      audio.play('shoot', { volumeScale: 0.5 });

      const wMode = WEAPON_MODES[weaponModeIndex];
      const elem = ELEMENT_MODES[elementModeIndex];
      const elemColors = { burn: '#f3ead3', chill: '#78b0d9', stun: '#d9b978' };
      const bSpeed = player.stats.get('bulletSpeed');
      const baseDmg = player.stats.get('damage');
      const pierce = Math.floor(player.stats.get('pierce'));
      const sx = player.pos.x + aimDir.x * (player.r + 6);
      const sy = player.pos.y + aimDir.y * (player.r + 6);

      if (wMode === 'spread') {
        weapons.fire(sx, sy, player.facing, {
          count: 3,
          spread: 0.42,
          speed: bSpeed,
          damage: Math.round(baseDmg * 0.78),
          pierce,
          behavior: 'linear',
          color: elemColors[elem]
        });
      } else if (wMode === 'ricochet') {
        weapons.fire(sx, sy, player.facing, {
          count: 1,
          speed: bSpeed * 1.05,
          damage: Math.round(baseDmg * 1.1),
          behavior: 'ricochet',
          bounces: 3 + pierce,
          bounceRange: 210,
          color: elemColors[elem]
        });
      } else if (wMode === 'boomerang') {
        weapons.fire(sx, sy, player.facing, {
          count: 1,
          speed: bSpeed * 0.82,
          life: 1350,
          r: 7,
          damage: Math.round(baseDmg * 0.9),
          behavior: 'boomerang',
          owner: player,
          color: elemColors[elem]
        });
      } else {
        weapons.fire(sx, sy, player.facing, {
          count: 1,
          speed: bSpeed,
          damage: baseDmg,
          pierce,
          behavior: 'linear',
          color: elemColors[elem]
        });
      }
    }
  })
  .register('dash', {
    cooldown: 1800,
    charges: 2,
    duration: 200,
    onUse: () => {
      audio.play('dash');
      invulnFrames = true;
      player.stats.addModifier('dashBoost', 'speed', 'percent', 1.5);
      emitParticles(player.pos.x, player.pos.y, '#f3ead3', 10, 160, false);
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
      audio.play('explosion');
      camera.shake(200, 9);
      emitParticles(player.pos.x, player.pos.y, '#d9b978', 26, 270, true);
      spawnFloatingText(player.pos.x, player.pos.y - 20, 'SHOCKWAVE + STUN!', '#d9b978', 700);

      grid.queryRadius(player.pos.x, player.pos.y, 195, queryScratch);
      for (let i = 0; i < queryScratch.length; i++) {
        const e = queryScratch[i];
        if (!e.stats.dead) {
          const dx = e.x - player.pos.x;
          const dy = e.y - player.pos.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d <= 195) {
            e.x += (dx / d) * 65;
            e.y += (dy / d) * 65;
            tilemap.collideCircle(e, tileHit);
            grid.update(e);
            statuses.apply(e, 'stun', { duration: 1400 });
            spawnFloatingText(e.x, e.y - e.r, '-45 STUN', '#d9b978');
            if (e.stats.takeDamage(45)) {
              events.emit('enemyKilled', { enemy: e });
            }
          }
        }
      }
    }
  })
  .register('cryoZone', {
    cooldown: 6500,
    charges: 1,
    onUse: () => {
      audio.play('dash');
      spawnFloatingText(worldMouse.x, worldMouse.y - 16, 'CRYO HAZARD ZONE!', '#78b0d9', 700);
      weapons.spawnZone(worldMouse.x, worldMouse.y, {
        r: 95,
        duration: 4500,
        tickInterval: 450,
        team: 'player',
        color: '#78b0d9',
        onTick: (e) => {
          statuses.apply(e, 'chill', { stacks: 1 });
          spawnFloatingText(e.x, e.y - e.r, '-10 CHILL', '#78b0d9', 400);
          if (e.stats.takeDamage(10)) {
            events.emit('enemyKilled', { enemy: e });
          }
        }
      });
    }
  });

progression
  .registerUpgrade({
    id: 'rapid', tag: 'Attack Speed', title: 'Rapid Fire', desc: '-15% Fire Delay', maxRank: 4, weight: 3,
    apply: (rank) => player.stats.addModifier('up_rapid', 'fireDelay', 'percent', -0.15 * rank)
  })
  .registerUpgrade({
    id: 'damage', tag: 'Offense', title: 'Damage Up', desc: '+25% Weapon & Orbiter Damage', maxRank: 5, weight: 3,
    apply: (rank) => {
      player.stats.addModifier('up_dmg', 'damage', 'percent', 0.25 * rank);
      syncPlayerOrbiters();
    }
  })
  .registerUpgrade({
    id: 'orbiters', tag: 'WeaponSystem', title: 'Guardian Blades', desc: '+1 Rotating Orbiter Blade', maxRank: 4, weight: 3,
    apply: (rank) => {
      orbiterRank = 1 + rank;
      syncPlayerOrbiters();
    }
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
    id: 'pierce', tag: 'Weapon', title: 'Piercing / Bounce', desc: '+1 Pierce or Ricochet Bounce', maxRank: 3, weight: 2,
    apply: (rank) => player.stats.addModifier('up_prc', 'pierce', 'add', rank)
  });

director
  .registerEnemy('dart',    { cost: 1, weight: 5, minWave: 1 })
  .registerEnemy('spinner', { cost: 2, weight: 3, minWave: 1 })
  .registerEnemy('ranged',  { cost: 2, weight: 2, minWave: 1 })
  .registerEnemy('lancer',  { cost: 3, weight: 2, minWave: 1 })
  .registerEnemy('tank',    { cost: 5, weight: 1, minWave: 1, elite: true });

spawner
  .addWave({
    duration: 14000, interval: 2600, count: 6, shape: 'ring', minRadius: 430, maxRadius: 580,
    types: [{ id: 'dart', weight: 5 }, { id: 'spinner', weight: 2 }, { id: 'ranged', weight: 1 }]
  })
  .addWave({
    duration: 16000, interval: 2300, count: 8, shape: 'ring', minRadius: 430, maxRadius: 600,
    types: [{ id: 'dart', weight: 4 }, { id: 'spinner', weight: 3 }, { id: 'ranged', weight: 2 }, { id: 'tank', weight: 1 }]
  })
  .addWave({
    duration: 20000, interval: 2000, count: 10, shape: 'ring', minRadius: 440, maxRadius: 620,
    types: [{ id: 'dart', weight: 3 }, { id: 'lancer', weight: 3 }, { id: 'ranged', weight: 2 }, { id: 'tank', weight: 2 }]
  });

const spawnEnemyFromRule = ({ x, y, type, wave, elite = false }) => {
  const sx = Math.max(-ARENA_HALF + 45, Math.min(ARENA_HALF - 45, x));
  const sy = Math.max(-ARENA_HALF + 45, Math.min(ARENA_HALF - 45, y));
  const preset = ENEMY_PRESETS[type] || ENEMY_PRESETS.dart;
  const validPos = findNearestWalkableWorld(sx, sy, preset.r);

  const enemy = enemyPool.get(validPos.x, validPos.y, preset, wave, elite);
  activeEnemies.push(enemy);
  grid.insert(enemy);
};

const spawnGroundItem = (x, y, itemId) => {
  const type = ITEM_TYPES[itemId] || ITEM_TYPES.medkit;
  const validPos = findNearestWalkableWorld(x, y, type.r);
  const p = pickupPool.get(validPos.x, validPos.y, type);
  activePickups.push(p);
};

const handleWeaponHit = (target, source) => {
  if (target === player) {
    if (!invulnFrames && !godMode) {
      invulnFrames = true;
      events.emit('playerDamaged', { amount: source.damage ?? 12 });
      timer.add(450, () => { invulnFrames = false; });
    }
    return;
  }

  const e = target;
  if (e.stats.dead) return;

  audio.play('hit', { volumeScale: 0.45 });
  const dmg = Math.round(source.damage ?? player.stats.get('damage'));
  const elem = ELEMENT_MODES[elementModeIndex];

  if (elem === 'burn' && rng.next() < 0.45) {
    statuses.apply(e, 'burn', { stacks: 1 });
  } else if (elem === 'chill') {
    statuses.apply(e, 'chill', { stacks: 1 });
  } else if (elem === 'stun' && rng.next() < 0.28) {
    statuses.apply(e, 'stun', { duration: 750 });
  }

  spawnFloatingText(e.x, e.y - e.r, `-${dmg}`, '#f3ead3');
  if (e.fsm.currentStateName === 'search') {
    e.fsm.change('track');
  }
  if (e.stats.takeDamage(dmg)) {
    events.emit('enemyKilled', { enemy: e });
  } else {
    emitParticles(e.x, e.y, '#f3ead3', 3, 110, false);
  }
};

events.on('enemyKilled', ({ enemy }) => {
  kills++;
  score += enemy.scoreValue;
  director.recordKill();
  activeGems.push(gemPool.get(enemy.x, enemy.y, enemy.xpValue));

  const isHeavy = enemy.shape === 'tank' || enemy.elite;
  if (isHeavy) {
    audio.play('explosion');
    camera.shake(150, 7);
    emitParticles(enemy.x, enemy.y, enemy.color, 22, 240, true);
  } else {
    emitParticles(enemy.x, enemy.y, enemy.color, 9, 170, false);
  }

  const table = isHeavy ? tankLoot : mobLoot;
  const drops = table.roll(() => rng.next());
  for (let i = 0; i < drops.length; i++) {
    spawnGroundItem(enemy.x + rng.range(-12, 12), enemy.y + rng.range(-12, 12), drops[i].id);
  }
});

events.on('pickupCollected', (pickup) => {
  const t = pickup.type;
  audio.play('pickup');
  emitParticles(pickup.x, pickup.y, t.color, 10, 170, false);

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
  } else if (t.id === 'haste') {
    statuses.apply(player, 'overcharge');
    spawnFloatingText(player.pos.x, player.pos.y - 16, 'OVERCHARGE!', t.color, 750);
  } else if (t.id === 'rapid') {
    statuses.apply(player, 'frenzy');
    spawnFloatingText(player.pos.x, player.pos.y - 16, 'FRENZY!', t.color, 750);
  } else if (t.id === 'magnet') {
    spawnFloatingText(player.pos.x, player.pos.y - 16, 'MAGNET!', t.color, 750);
    for (let i = 0; i < activeGems.length; i++) {
      activeGems[i].magnetized = true;
    }
  }
});

events.on('playerDamaged', ({ amount }) => {
  if (godMode) return;
  audio.play('hit');
  director.recordPlayerDamage(amount);
  camera.shake(220, 10);
  emitParticles(player.pos.x, player.pos.y, '#c96b6b', 14, 190, false);
  spawnFloatingText(player.pos.x, player.pos.y - 18, `-${Math.round(amount)} HP`, '#c96b6b', 700);
  if (player.stats.takeDamage(amount)) {
    saveRecord();
    gameFsm.change('gameover');
  }
});

// Configure DevConsole watchers and runtime commands
devConsole
  .watch('Mobs', () => activeEnemies.length)
  .watch('Proj', () => weapons.activeProjectileCount)
  .watch('Phase', () => (useDirectorMode ? director.phase.toUpperCase() : `WAVE ${spawner.waveNumber}`))
  .registerCommand('spawn', ([type = 'tank', count = '3']) => {
    const n = Math.max(1, Math.min(50, Number(count) || 1));
    for (let i = 0; i < n; i++) {
      spawnEnemyFromRule({
        x: player.pos.x + rng.range(-240, 240),
        y: player.pos.y + rng.range(-240, 240),
        type,
        wave: useDirectorMode ? director.waveNumber : spawner.waveNumber,
        elite: type === 'tank'
      });
    }
    return `Spawned ${n}x ${type}`;
  }, 'spawn <dart|spinner|lancer|ranged|tank> [count]')
  .registerCommand('give', ([item = 'bomb', count = '2']) => {
    const res = inventory.add(item, Number(count) || 1);
    return `Added ${res.added}x ${item} to belt (Overflow: ${res.overflow})`;
  }, 'give <medkit|bomb|haste> [count]')
  .registerCommand('levelup', ([levels = '1']) => {
    const lvls = Math.max(1, Number(levels) || 1);
    for (let i = 0; i < lvls; i++) {
      progression.addXp(progression.xpToNext);
    }
    gameFsm.change('levelup');
    return `Triggered ${lvls} level-up(s)`;
  }, 'levelup [count] - Grant immediate level-up draft')
  .registerCommand('god', () => {
    godMode = !godMode;
    return `God Mode (Invulnerability): ${godMode ? 'ON' : 'OFF'}`;
  }, 'Toggle player invulnerability')
  .registerCommand('shrine', () => {
    gameFsm.change('dialogue');
    return 'Opened Corrupt Shrine dialogue.';
  }, 'Open the Corrupt Shrine dialogue encounter');

const regenerateArena = (keepEntities = false) => {
  if (keepEntities) {
    biomeIndex = (biomeIndex + 1) % BIOMES.length;
  }

  const currentBiome = BIOMES[biomeIndex];
  regenMapBtn.textContent = `Biome: ${currentBiome.toUpperCase()} (G)`;

  const randFn = () => rng.next();
  let generated;

  if (currentBiome === 'cave') {
    generated = procgen.cellularAutomata({
      cols: GRID_COLS,
      rows: GRID_COLS,
      fillChance: 0.41,
      steps: 4,
      ensureConnected: true,
      rng: randFn
    });
  } else if (currentBiome === 'dungeon') {
    generated = procgen.dungeonRooms({
      cols: GRID_COLS,
      rows: GRID_COLS,
      roomCount: 14,
      minSize: 6,
      maxSize: 12,
      corridorWidth: 3,
      rng: randFn
    });
  } else {
    generated = procgen.arenaPillars({
      cols: GRID_COLS,
      rows: GRID_COLS,
      pillarCount: 18,
      minSize: 2,
      maxSize: 5,
      corridorGap: 3,
      clearCenterRadius: 5,
      rng: randFn
    });
  }

  tilemap.loadGrid(generated.grid);
  tilemap.extractWallRects(obstacles);
  mapRenderer.invalidateAll();

  if (!keepEntities) {
    const spawnWorld = tilemap.tileToWorld(generated.spawn.col, generated.spawn.row);
    player.pos.set(spawnWorld.x, spawnWorld.y);
  } else {
    mapCount++;
    camera.shake(180, 7);
    const validPlayer = findNearestWalkableWorld(player.pos.x, player.pos.y, player.r);
    player.pos.set(validPlayer.x, validPlayer.y);
    emitParticles(player.pos.x, player.pos.y, '#f3ead3', 16, 200, false);
    spawnFloatingText(player.pos.x, player.pos.y - 22, `BIOME: ${currentBiome.toUpperCase()}`, '#f3ead3', 800);
    dialogue.bark('OVERWATCH HQ', `Sector topology shifted to ${currentBiome.toUpperCase()} biome.`, {
      duration: 2800,
      color: '#78b0d9'
    });

    for (let i = 0; i < activeEnemies.length; i++) {
      const e = activeEnemies[i];
      const validEnemy = findNearestWalkableWorld(e.x, e.y, e.r);
      e.x = validEnemy.x;
      e.y = validEnemy.y;
      grid.update(e);
    }
  }

  const validShrine = findNearestWalkableWorld(player.pos.x + 150, player.pos.y - 110, shrineEntity.r);
  shrineEntity.x = validShrine.x;
  shrineEntity.y = validShrine.y;
  shrineEntity.cooldown = 0;

  rebuildFlowFieldWalls();
};

const clearAllEntities = () => {
  while (activeEnemies.length) enemyPool.release(activeEnemies.pop());
  while (activeGems.length) gemPool.release(activeGems.pop());
  while (activePickups.length) pickupPool.release(activePickups.pop());
  weapons.clear();
  statuses.clearAll();
  particles.clear();
  combatText.clear();
  dialogue.clearBarks();
  activeBombs.length = 0;
  grid.clear();
};

const resetRun = (seedStr) => {
  rng.setSeed(seedStr);
  timer.clear();
  clearAllEntities();
  progression.reset();
  spawner.reset();
  director.reset();
  abilities.reset();
  inventory.clear();

  inventory.add('medkit', 1);
  inventory.add('bomb', 2);
  inventory.add('haste', 1);

  score = 0;
  kills = 0;
  survivalTime = 0;
  mapCount = 1;
  biomeIndex = 0;
  orbiterRank = 1;
  shrineBuffCount = 0;
  invulnFrames = false;
  lastDirectorPhase = 'buildup';

  player.stats = new Stats({
    maxHealth: 100,
    speed: 220,
    damage: 20,
    fireDelay: 190,
    bulletSpeed: 590,
    pickupRadius: 85,
    pierce: 0
  });

  syncPlayerOrbiters();
  regenerateArena(false);
  camera.setZoom(1);
  camera.follow(player.pos, 1);

  if (useDirectorMode) {
    director.update(1200, {
      playerX: player.pos.x,
      playerY: player.pos.y,
      activeCount: 0,
      onSpawn: spawnEnemyFromRule
    });
  } else {
    spawner.update(2600, player.pos.x, player.pos.y, spawnEnemyFromRule);
  }

  dialogue.bark('OVERWATCH HQ', 'Drop pod landed. Approach the Corrupt Shrine [H] or press [~] for DevConsole.', {
    duration: 3800,
    color: '#d9b978'
  });

  gameFsm.change('playing');
};

const toggleAiMode = () => {
  useDirectorMode = !useDirectorMode;
  aiModeBtn.textContent = useDirectorMode
    ? 'AI: DIRECTOR+SLOTS (B)'
    : 'AI: LOS+STEERING (B)';
  spawnFloatingText(
    player.pos.x,
    player.pos.y - 22,
    useDirectorMode ? 'DIRECTOR + SURROUND SLOTS' : 'WAVESPAWNER + LOS STEERING',
    '#d9b978',
    800
  );
};

const cycleWeaponMode = () => {
  weaponModeIndex = (weaponModeIndex + 1) % WEAPON_MODES.length;
  const label = WEAPON_MODES[weaponModeIndex].toUpperCase();
  weaponModeBtn.textContent = `Gun: ${label} (Q)`;
  spawnFloatingText(player.pos.x, player.pos.y - 20, `GUN: ${label}`, '#f3ead3', 650);
};

const cycleElementMode = () => {
  elementModeIndex = (elementModeIndex + 1) % ELEMENT_MODES.length;
  const label = ELEMENT_MODES[elementModeIndex].toUpperCase();
  elementModeBtn.textContent = `Ammo: ${label} (R)`;
  spawnFloatingText(player.pos.x, player.pos.y - 20, `AMMO: ${label}`, '#78b0d9', 650);
};

const toggleAudioMute = () => {
  const isMuted = audio.toggleMute();
  muteBtn.textContent = `Audio (M): ${isMuted ? 'OFF' : 'ON'}`;
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
    if (input.isPressed('interactShrine')) {
      gameFsm.change('dialogue');
      return;
    }
    if (input.isPressed('regen')) regenerateArena(true);
    if (input.isPressed('toggleAiMode')) toggleAiMode();
    if (input.isPressed('cycleWeapon')) cycleWeaponMode();
    if (input.isPressed('cycleElement')) cycleElementMode();
    if (input.isPressed('toggleChunks')) {
      showChunkBorders = !showChunkBorders;
      chunkBtn.textContent = `Chunks (X): ${showChunkBorders ? 'ON' : 'OFF'}`;
    }
    if (input.isPressed('toggleVision')) {
      visionMode = !visionMode;
      visionBtn.textContent = `Sight (C): ${visionMode ? 'ON' : 'OFF'}`;
    }
    if (input.isPressed('toggleFlow')) {
      showFlowArrows = !showFlowArrows;
      flowBtn.textContent = `Flow (V): ${showFlowArrows ? 'ON' : 'OFF'}`;
    }
    if (input.isPressed('toggleMute')) {
      toggleAudioMute();
    }

    if (input.isPressed('slot1')) inventory.use('medkit', player);
    if (input.isPressed('slot2')) inventory.use('bomb', player);
    if (input.isPressed('slot3')) inventory.use('haste', player);

    survivalTime += dt;
    if (shrineEntity.cooldown > 0) shrineEntity.cooldown = Math.max(0, shrineEntity.cooldown - dt);

    timer.update(dt);
    statuses.update(dt);
    dialogue.update(dt);

    if (useDirectorMode) {
      director.update(dt, {
        playerX: player.pos.x,
        playerY: player.pos.y,
        activeCount: activeEnemies.length,
        minRadius: 420,
        maxRadius: 580,
        onSpawn: spawnEnemyFromRule
      });

      if (director.phase !== lastDirectorPhase) {
        if (director.phase === 'peak') {
          dialogue.bark(
            'OVERWATCH HQ',
            `Wave ${director.waveNumber} PEAK SURGE! Swarm surrounding from 360 degrees!`,
            { duration: 3200, color: '#c96b6b' }
          );
        } else if (director.phase === 'breather') {
          dialogue.bark(
            'OVERWATCH HQ',
            'Swarm pressure subsiding. Breather window open — collect XP & loot!',
            { duration: 2800, color: '#6bc98f' }
          );
        }
        lastDirectorPhase = director.phase;
      }
    } else {
      spawner.update(dt, player.pos.x, player.pos.y, spawnEnemyFromRule);
    }

    if (!statuses.isRooted(player)) {
      moveDir.set(
        (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0),
        (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0)
      );

      if (moveDir.magSq() > 0) {
        moveDir.normalize().mult(player.stats.get('speed') * (dt / 1000));
        player.pos.add(moveDir);
      }
    }

    const playerCircle = { x: player.pos.x, y: player.pos.y, r: player.r };
    tilemap.collideCircle(playerCircle, tileHit);
    player.pos.x = Math.max(-ARENA_HALF + player.r, Math.min(ARENA_HALF - player.r, playerCircle.x));
    player.pos.y = Math.max(-ARENA_HALF + player.r, Math.min(ARENA_HALF - player.r, playerCircle.y));

    if (shrineEntity.cooldown <= 0 && collision.circleCircle(playerCircle, shrineEntity)) {
      shrineEntity.cooldown = 6000;
      gameFsm.change('dialogue');
      return;
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
    if (input.isPressed('cryoZone')) abilities.use('cryoZone', player);
    abilities.update(dt, player, fireScale);

    weapons.update(dt, {
      spatialHash: grid,
      player,
      tilemap,
      boundsHalf: ARENA_HALF,
      onHit: handleWeaponHit
    });

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

      if (!statuses.isStunned(e)) {
        e.fsm.update(dt);
        aiCounts[e.fsm.currentStateName] = (aiCounts[e.fsm.currentStateName] || 0) + 1;

        grid.queryRadius(e.x, e.y, e.r + 26, queryScratch);
        const effSpeed = e.stats.get('speed');
        steering.separate(e, queryScratch, e.r * 2.3, effSpeed, sepForce);
        steerForce.x += sepForce.x * 1.35;
        steerForce.y += sepForce.y * 1.35;

        steering.applyForce(e, steerForce, e.maxForce, effSpeed, dt);
        e.spin += dt * 0.008;
      } else {
        grid.queryRadius(e.x, e.y, e.r + 26, queryScratch);
      }

      for (let j = 0; j < queryScratch.length; j++) {
        const other = queryScratch[j];
        if (other === e || other.stats.dead) continue;
        const hit = collision.circleCircleInfo(e, other, manifold);
        if (hit) {
          e.x += hit.nx * hit.depth * 0.5;
          e.y += hit.ny * hit.depth * 0.5;
        }
      }

      tilemap.collideCircle(e, tileHit);
      if (tileHit.hit) {
        const dot = e.vx * tileHit.nx + e.vy * tileHit.ny;
        if (dot < 0) {
          e.vx -= tileHit.nx * dot;
          e.vy -= tileHit.ny * dot;
        }
      }

      e.x = Math.max(-ARENA_HALF + e.r, Math.min(ARENA_HALF - e.r, e.x));
      e.y = Math.max(-ARENA_HALF + e.r, Math.min(ARENA_HALF - e.r, e.y));
      grid.update(e);

      if (!invulnFrames && !godMode && collision.circleCircle(e, playerCircle)) {
        invulnFrames = true;
        if (e.shape === 'lancer') {
          statuses.apply(player, 'bleed', { stacks: 1 });
        }
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
          audio.play('levelup');
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

    particles.update(dt);
    combatText.update(dt);

    camera.follow(player.pos, 0.12, dt);
    camera.update(dt);
  }
});

// Interactive Branching Shrine Dialogue State powered by DialogueSystem
gameFsm.add('dialogue', {
  enter: () => {
    overlay.classList.remove('hidden');

    const renderDialogueOverlay = () => {
      const st = dialogue.getState();
      if (!st) return;

      overlay.innerHTML = `
        <div class="dialogue-card">
          <div class="dialogue-speaker">${st.speaker}</div>
          <div class="dialogue-text" id="dlgLiveText">${st.visibleText}</div>
          <div class="dialogue-choices" id="dlgLiveChoices"></div>
          <div style="margin-top:0.85rem; display:flex; justify-content:space-between; align-items:center;">
            <small style="color:var(--muted); font-family:monospace;">HP: ${Math.ceil(player.stats.health)}/${Math.ceil(player.stats.maxHealth)} | Score: ${score}</small>
            <button id="dlgSkipBtn">${st.isTyping ? 'Skip Typewriter' : 'Continue / Close'}</button>
          </div>
        </div>
      `;

      const choicesBox = document.getElementById('dlgLiveChoices');
      if (!st.isTyping && st.choices.length > 0) {
        st.choices.forEach((c, idx) => {
          const btn = document.createElement('button');
          btn.className = 'dialogue-choice-btn';
          btn.textContent = `[${idx + 1}] ${c.label}`;
          btn.addEventListener('click', () => {
            dialogue.choose(idx);
            if (dialogue.isActive) renderDialogueOverlay();
          });
          choicesBox.appendChild(btn);
        });
      }

      document.getElementById('dlgSkipBtn').addEventListener('click', () => {
        const wasTyping = dialogue.isTyping;
        dialogue.advance();
        if (wasTyping && dialogue.isActive) {
          renderDialogueOverlay();
        }
      });
    };

    dialogue.onNodeEnter = renderDialogueOverlay;
    dialogue.start('shrine_root', player);
  },
  update: (dt) => {
    const wasTyping = dialogue.isTyping;
    dialogue.update(dt);
    const st = dialogue.getState();
    if (st) {
      const textEl = document.getElementById('dlgLiveText');
      if (textEl) textEl.textContent = st.visibleText;
      if (wasTyping && !st.isTyping && dialogue.onNodeEnter) {
        dialogue.onNodeEnter();
      }
    }
    if (input.isPressed('pause')) {
      dialogue.close();
    }
  }
});

gameFsm.add('paused', {
  enter: () => {
    overlay.classList.remove('hidden');
    const playerEffects = statuses.getEffects(player);
    const rankedList = [];
    for (const u of progression.upgrades.values()) {
      const r = progression.getRank(u.id);
      if (r > 0) rankedList.push({ ...u, rank: r });
    }

    overlay.innerHTML = `
      <h2>Character, Statuses &amp; Saved Records</h2>
      <p>High Score: <strong>${storage.get('highScore', 0)}</strong> &bull; Best Wave: <strong>${storage.get('bestWave', 1)}</strong> &bull; Lifetime Kills: <strong>${storage.get('lifetimeKills', 0)}</strong></p>
      <div class="char-sheet">
        <div class="sheet-box">
          <h3>Player Stats</h3>
          <div class="stat-row"><span>Health</span><strong>${Math.ceil(player.stats.health)} / ${Math.ceil(player.stats.maxHealth)} HP</strong></div>
          <div class="stat-row"><span>Weapon Pattern [Q]</span><strong>${WEAPON_MODES[weaponModeIndex].toUpperCase()}</strong></div>
          <div class="stat-row"><span>Ammo Element [R]</span><strong>${ELEMENT_MODES[elementModeIndex].toUpperCase()}</strong></div>
          <div class="stat-row"><span>AI Mode [B]</span><strong>${useDirectorMode ? 'DIRECTOR + SLOTS' : 'LOS + STEERING'}</strong></div>
          <div class="stat-row"><span>Damage</span><strong>${player.stats.get('damage').toFixed(1)}</strong></div>
          <div class="stat-row"><span>Move Speed</span><strong>${player.stats.get('speed').toFixed(0)} px/s</strong></div>
          <div class="stat-row"><span>Guardian Orbiters</span><strong>${orbiterRank} Blades</strong></div>
          <div class="stat-row"><span>Belt Slots</span><strong>[1] Med:${inventory.count('medkit')} [2] Bomb:${inventory.count('bomb')} [3] Ovr:${inventory.count('haste')}</strong></div>
        </div>
        <div class="sheet-box">
          <h3>Active Statuses &amp; Upgrade Ranks</h3>
          <div class="buff-list">
            ${playerEffects.map((eff) => `
              <div class="buff-item temp">
                <span>Status: ${eff.id.toUpperCase()} (x${eff.stacks})</span>
                <small>${(eff.remaining / 1000).toFixed(1)}s</small>
              </div>
            `).join('')}
            ${rankedList.map((u) => `
              <div class="buff-item">
                <span>${u.title} <small>(${u.desc})</small></span>
                <small>Rank ${u.rank}/${u.maxRank}</small>
              </div>
            `).join('')}
            ${playerEffects.length === 0 && rankedList.length === 0 ? '<small style="color:var(--muted);">No active statuses or upgrades yet.</small>' : ''}
          </div>
        </div>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button id="resumeBtn" class="primary">Resume Game (Tab / P)</button>
        <button id="sheetShrineBtn">Open Corrupt Shrine (H)</button>
        <button id="sheetRegenBtn">Cycle Procgen Biome (G)</button>
      </div>
    `;

    document.getElementById('resumeBtn').addEventListener('click', () => gameFsm.change('playing'));
    document.getElementById('sheetShrineBtn').addEventListener('click', () => gameFsm.change('dialogue'));
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
        audio.play('pickup');
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
    const waveNum = useDirectorMode ? director.waveNumber : spawner.waveNumber;
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h2 style="color: #c96b6b;">Game Over</h2>
      <p>
        Survived <strong>${(survivalTime / 1000).toFixed(1)}s</strong> on Seed <code>${seedInput.value}</code><br>
        Wave ${waveNum} &nbsp;|&nbsp; Level ${progression.level} &nbsp;|&nbsp; Kills: ${kills} &nbsp;|&nbsp; Score: ${score}<br>
        <small style="color:var(--amber);">All-Time High Score: ${storage.get('highScore', 0)} &bull; Best Wave: ${storage.get('bestWave', 1)}</small>
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

const drawShrine = () => {
  ctx.save();
  ctx.translate(shrineEntity.x, shrineEntity.y);

  ctx.strokeStyle = shrineEntity.cooldown > 0 ? '#233452' : '#d9b978';
  ctx.fillStyle = '#101624';
  ctx.lineWidth = 2;

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = Math.cos(a) * shrineEntity.r;
    const py = Math.sin(a) * shrineEntity.r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = shrineEntity.cooldown > 0 ? '#8e9bb0' : '#d9b978';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();

  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d9b978';
  ctx.fillText('SHRINE [H]', 0, -shrineEntity.r - 6);
  ctx.restore();
};

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

  const isStunned = statuses.isStunned(e);
  const isChilled = statuses.has(e, 'chill');
  ctx.fillStyle = isStunned ? '#f3ead3' : (isChilled ? '#78b0d9' : e.color);

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

  statuses.getEffects(e, effectScratch);
  for (let i = 0; i < effectScratch.length; i++) {
    const eff = effectScratch[i];
    ctx.fillStyle = eff.color;
    ctx.fillRect(-e.r + i * 9, e.r + 4, 7 * eff.ratio, 2.5);
  }

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

  if (useDirectorMode && director.rings.length > 0) {
    const innerRing = director.rings[0];
    ctx.strokeStyle = 'rgba(217, 185, 120, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, innerRing.radius, 0, Math.PI * 2);
    ctx.stroke();

    const step = (Math.PI * 2) / innerRing.slots;
    for (let s = 0; s < innerRing.slots; s++) {
      if (innerRing.occupied[s]) {
        const sx = Math.cos(s * step) * innerRing.radius;
        const sy = Math.sin(s * step) * innerRing.radius;
        ctx.fillStyle = '#d9b978';
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
    }
  }

  ctx.strokeStyle = 'rgba(243, 234, 211, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, player.stats.get('pickupRadius'), 0, Math.PI * 2);
  ctx.stroke();

  statuses.getEffects(player, effectScratch);
  for (let i = 0; i < effectScratch.length; i++) {
    const eff = effectScratch[i];
    ctx.fillStyle = eff.color;
    ctx.fillRect(-16 + i * 12, player.r + 6, 10 * eff.ratio, 3);
  }

  ctx.rotate(player.facing);

  ctx.fillStyle = '#8e9bb0';
  ctx.fillRect(6, -3.5, player.r + 7, 7);

  ctx.fillStyle = invulnFrames || godMode ? '#ffffff' : (statuses.has(player, 'chill') ? '#78b0d9' : '#f3ead3');
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

  const viewW = canvas.width / camera.zoom;
  const viewH = canvas.height / camera.zoom;

  mapRenderer.render(ctx, camera.x, camera.y, viewW, viewH);

  if (showChunkBorders) {
    const cp = mapRenderer.chunkPixelSize;
    ctx.strokeStyle = 'rgba(217, 185, 120, 0.4)';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < mapRenderer.chunkRows; r++) {
      for (let c = 0; c < mapRenderer.chunkCols; c++) {
        ctx.strokeRect(
          tilemap.originX + c * cp,
          tilemap.originY + r * cp,
          cp,
          cp
        );
      }
    }
  }

  if (showFlowArrows) {
    ctx.strokeStyle = '#283e64';
    ctx.lineWidth = 1;
    tilemap.forEachVisible(camera.x, camera.y, viewW, viewH, (c, r, id, wx, wy) => {
      if (id === 1) return;
      const idx = r * flowField.cols + c;
      const vx = flowField.dirX[idx];
      const vy = flowField.dirY[idx];
      if (vx !== 0 || vy !== 0) {
        const cx = wx + TILE_SIZE * 0.5;
        const cy = wy + TILE_SIZE * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + vx * 9, cy + vy * 9);
        ctx.stroke();
      }
    });
  }

  if (visionMode) {
    lineOfSight.castVisionPolygon(player.pos, player.facing, Math.PI * 0.65, 420, 64, obstacles, visionPoly);
    lineOfSight.filterVisible(player.pos, player.facing, activeEnemies, 420, Math.PI * 0.65, obstacles, visibleSet);

    if (visionPoly.length > 1) {
      ctx.fillStyle = 'rgba(243, 234, 211, 0.08)';
      ctx.beginPath();
      ctx.moveTo(player.pos.x, player.pos.y);
      for (let i = 0; i < visionPoly.length; i++) {
        ctx.lineTo(visionPoly[i].x, visionPoly[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  drawShrine();

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

  weapons.render(ctx);

  for (let i = 0; i < activeEnemies.length; i++) {
    const e = activeEnemies[i];
    const dimmed = visionMode && !visibleSet.includes(e);
    drawEnemyShape(e, dimmed);
  }

  devConsole.renderSpatialDebug(ctx, {
    spatialHash: grid,
    entities: activeEnemies,
    obstacles
  });

  particles.render(ctx);
  drawPlayer();
  combatText.render(ctx);

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
  ctx.fillText(`HP ${Math.ceil(player.stats.health)} / ${Math.ceil(player.stats.maxHealth)}${godMode ? ' [GOD]' : ''}`, 22, 28);

  ctx.fillStyle = '#182236';
  ctx.fillRect(16, 36, 220, 9);
  ctx.fillStyle = '#f3ead3';
  ctx.fillRect(16, 36, 220 * progression.xpRatio, 9);

  const dashState = abilities.getState('dash');
  const shockState = abilities.getState('shockwave');
  const cryoState = abilities.getState('cryoZone');

  ctx.fillStyle = '#182236';
  ctx.fillRect(16, 50, 70, 12);
  ctx.fillStyle = dashState.ready ? '#78b0d9' : '#233452';
  ctx.fillRect(16, 50, 70 * (1 - dashState.cooldownRatio), 12);
  ctx.fillStyle = '#f3ead3';
  ctx.font = '9px monospace';
  ctx.fillText(`DASH (${dashState.charges})`, 20, 59);

  ctx.fillStyle = '#182236';
  ctx.fillRect(90, 50, 72, 12);
  ctx.fillStyle = shockState.ready ? '#d9b978' : '#233452';
  ctx.fillRect(90, 50, 72 * (1 - shockState.cooldownRatio), 12);
  ctx.fillStyle = '#f3ead3';
  ctx.fillText(shockState.ready ? 'SHOCK [F]' : `${(shockState.cooldownLeft / 1000).toFixed(1)}s`, 94, 59);

  ctx.fillStyle = '#182236';
  ctx.fillRect(166, 50, 70, 12);
  ctx.fillStyle = cryoState.ready ? '#6bc98f' : '#233452';
  ctx.fillRect(166, 50, 70 * (1 - cryoState.cooldownRatio), 12);
  ctx.fillStyle = '#f3ead3';
  ctx.fillText(cryoState.ready ? 'CRYO [E]' : `${(cryoState.cooldownLeft / 1000).toFixed(1)}s`, 170, 59);

  const beltItems = [
    { key: '1', id: 'medkit', label: 'Medkit', color: '#6bc98f' },
    { key: '2', id: 'bomb', label: 'Breach', color: '#c96b6b' },
    { key: '3', id: 'haste', label: 'OvrChg', color: '#78b0d9' }
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

  let buffY = 68;
  statuses.getEffects(player, effectScratch);
  for (let i = 0; i < effectScratch.length; i++) {
    const eff = effectScratch[i];
    ctx.fillStyle = '#101624';
    ctx.fillRect(16, buffY, 175, 14);
    ctx.fillStyle = eff.color;
    ctx.fillRect(16, buffY, 175 * eff.ratio, 14);
    ctx.fillStyle = '#080b12';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`${eff.id.toUpperCase()} x${eff.stacks} ${(eff.remaining / 1000).toFixed(1)}s`, 20, buffY + 11);
    buffY += 17;
  }

  const waveNum = useDirectorMode ? director.waveNumber : spawner.waveNumber;
  const phaseLabel = useDirectorMode
    ? `DIR:${director.phase.toUpperCase()} (${(director.intensity * 100).toFixed(0)}%)`
    : `SPAWNER:RING`;

  ctx.fillStyle = '#f3ead3';
  ctx.font = 'bold 11.5px monospace';
  ctx.fillText(
    `LVL ${progression.level} | W${waveNum} [${phaseLabel}] | GUN:${WEAPON_MODES[weaponModeIndex].toUpperCase()}+${ELEMENT_MODES[elementModeIndex].toUpperCase()} | SCORE ${score}`,
    250,
    29
  );

  // Render DialogueSystem non-blocking radio comms banner and DevConsole profiler overlay
  dialogue.renderBarkBanner(ctx, canvas.width, 44);
  devConsole.renderOverlay(ctx, canvas.width - 197, 44);

  telemetryEl.textContent =
    `=== 32-MODULE LIVE TELEMETRY ===\n` +
    `[GameLoop]         FPS: ${loop.fps} | Step: ${loop.step.toFixed(1)}ms\n` +
    `[DevConsole]       Avg: ${devConsole.avgFrameMs.toFixed(2)}ms | Peak: ${devConsole.maxFrameMs.toFixed(1)}ms | Drawer [~]: ${devConsole.isOpen ? 'OPEN' : 'CLOSED'}\n` +
    `[DialogueSystem]   Shrine [H]: ${dialogue.isActive ? 'OPEN' : 'READY'} | Radio Bark: ${dialogue.activeBark ? dialogue.activeBark.speaker : 'idle'}\n` +
    `[StateMachine]     Game: "${gameFsm.currentStateName}" | AI E:${aiCounts.engage} T:${aiCounts.track} S:${aiCounts.search}\n` +
    `[SwarmDirector]    Mode: ${useDirectorMode ? 'ACTIVE [B]' : 'STANDBY [B]'} | Phase: ${director.phase.toUpperCase()} | Stress: ${(director.intensity * 100).toFixed(0)}%\n` +
    `[WaveSpawner]      Mode: ${!useDirectorMode ? 'ACTIVE [B]' : 'STANDBY [B]'} | Wave: ${spawner.waveNumber}\n` +
    `[WeaponSystem]     Pattern [Q]: ${WEAPON_MODES[weaponModeIndex].toUpperCase()} | Proj: ${weapons.activeProjectileCount} | Zones [E]: ${weapons.activeZoneCount} | Orbiters: ${orbiterRank}\n` +
    `[StatusEffects]    Ammo [R]: ${ELEMENT_MODES[elementModeIndex].toUpperCase()} | Entities w/ Status: ${statuses.activeEntityCount}\n` +
    `[TilemapRenderer]  16x16 Chunks Drawn: ${mapRenderer.chunksDrawnThisFrame}/${mapRenderer.totalChunks} | Rebuilt: ${mapRenderer.chunksRebuiltThisFrame}\n` +
    `[Tilemap]          Grid: ${GRID_COLS}x${GRID_COLS} | Merged LOS Walls: ${obstacles.length}\n` +
    `[procgen]          Biome [G]: ${BIOMES[biomeIndex].toUpperCase()} (Map #${mapCount})\n` +
    `[FlowField]        Player Cell: (${lastFlowCell.col},${lastFlowCell.row})\n` +
    `[steering]         ${useDirectorMode ? 'Arrive(SurroundSlot) + Separate' : 'Seek(Player) + Separate'}\n` +
    `[lineOfSight]      LOS Gate + Sight Cone (${visionMode ? 'ON' : 'OFF'})\n` +
    `[SpatialHash]      Tracked: ${grid.size} | Cells: ${grid.cellCount}\n` +
    `[Pool]             Mobs:${enemyPool.inUse} Gems:${gemPool.inUse} Pickups:${pickupPool.inUse}\n` +
    `[Stats]            HP: ${Math.ceil(player.stats.health)}/${Math.ceil(player.stats.maxHealth)} | Speed: ${player.stats.get('speed').toFixed(0)}\n` +
    `[AbilityManager]   Dash:${dashState.charges} | Shock:${shockState.ready ? 'RDY' : (shockState.cooldownLeft / 1000).toFixed(1) + 's'} | Cryo:${cryoState.ready ? 'RDY' : (cryoState.cooldownLeft / 1000).toFixed(1) + 's'}\n` +
    `[Progression]      Lvl: ${progression.level} (${progression.xp}/${progression.xpToNext} XP)\n` +
    `[Loot / Inventory] Ground: ${activePickups.length} | Belt: Med:${inventory.count('medkit')} Bomb:${inventory.count('bomb')} Ovr:${inventory.count('haste')}\n` +
    `[Particle / Text]  Particles: ${particles.activeCount} | Combat Popups: ${combatText.activeCount}\n` +
    `[Storage / Audio]  HighScore: ${storage.get('highScore', 0)} | Audio: ${audio.muted ? 'MUTED' : 'ON'}`;
};

const loop = new GameLoop(
  (dt) => {
    devConsole.beginUpdate();
    gameFsm.update(dt);
    input.update();
    devConsole.endUpdate();
  },
  () => {
    devConsole.beginFrame();
    render();
    devConsole.endFrame();
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

aiModeBtn.addEventListener('click', toggleAiMode);
weaponModeBtn.addEventListener('click', cycleWeaponMode);
elementModeBtn.addEventListener('click', cycleElementMode);

shrineBtn.addEventListener('click', () => {
  if (gameFsm.currentStateName === 'playing') {
    gameFsm.change('dialogue');
  } else if (gameFsm.currentStateName === 'dialogue') {
    dialogue.close();
  }
});

regenMapBtn.addEventListener('click', () => {
  if (gameFsm.currentStateName === 'playing' || gameFsm.currentStateName === 'paused') {
    regenerateArena(true);
  }
});

chunkBtn.addEventListener('click', () => {
  showChunkBorders = !showChunkBorders;
  chunkBtn.textContent = `Chunks (X): ${showChunkBorders ? 'ON' : 'OFF'}`;
});

visionBtn.addEventListener('click', () => {
  visionMode = !visionMode;
  visionBtn.textContent = `Sight (C): ${visionMode ? 'ON' : 'OFF'}`;
});

flowBtn.addEventListener('click', () => {
  showFlowArrows = !showFlowArrows;
  flowBtn.textContent = `Flow (V): ${showFlowArrows ? 'ON' : 'OFF'}`;
});

consoleBtn.addEventListener('click', () => {
  devConsole.toggle();
});

muteBtn.addEventListener('click', toggleAudioMute);

document.getElementById('pauseBtn').addEventListener('click', () => {
  if (gameFsm.currentStateName === 'playing') gameFsm.change('paused');
  else if (gameFsm.currentStateName === 'paused') gameFsm.change('playing');
});

resetRun(seedInput.value);
loop.start();

const DOC_CARDS = [
  {
    title: 'DevConsole — Live Profiler Overlay, Spatial Debug & CLI Commands [Press ~]',
    tag: 'ui/devConsole.js',
    desc: 'Press [~] or click "Console (~)" to run commands like "spawn tank 5", "give bomb 4", "levelup 2", "god", "grid", or "hitboxes". The top-right canvas overlay graphs rolling frame times from a Float32Array ring buffer.',
    code: `const dev = new DevConsole({ mountElement: null });
dev.registerCommand('spawn', ([type, n = 1]) => \`Spawned \${n}x \${type}\`);
console.log(dev.execute('spawn tank 3'));`
  },
  {
    title: 'DialogueSystem — Corrupt Shrine Branching Choices & Radio Barks [Press H]',
    tag: 'ui/dialogue.js',
    desc: 'Walk into the Corrupt Shrine obelisk or press [H] to open branching choices with live HP and Score conditions. Non-blocking Overwatch HQ radio barks automatically announce Peak Swarm surges.',
    code: `const dlg = new DialogueSystem();
dlg.bark('OVERWATCH HQ', 'Peak Swarm Surge detected!', { duration: 3000 });
console.log('Active radio bark:', dlg.activeBark.speaker, '|', dlg.activeBark.text);`
  },
  {
    title: 'SwarmDirector — Adaptive Pacing & 360° Surround Slots [Toggle with B]',
    tag: 'ai/director.js',
    desc: 'Press [B] in-game to compare SwarmDirector (enemies claim concentric angular surround slots around the player and spawn in Build-Up / Peak / Breather waves) against classic WaveSpawner + direct Seek.',
    code: `const dir = new SwarmDirector({ rings: [{ radius: 50, slots: 8 }] });
const s1 = dir.assignSlot({ x: 200, y: 100 }, 100, 100);
const s2 = dir.assignSlot({ x: 210, y: 100 }, 100, 100);
console.log('Slot 1:', s1.x.toFixed(0), s1.y.toFixed(0), '| Slot 2:', s2.x.toFixed(0), s2.y.toFixed(0));`
  },
  {
    title: 'WeaponSystem — Spread, Ricochet, Boomerang, Orbiters & Zones [Cycle with Q / E]',
    tag: 'gameplay/weapons.js',
    desc: 'Press [Q] in-game to cycle primary weapon behavior (Linear, Spread Cone, Chain Ricochet, Returning Boomerang) and press [E] to drop a Cryo Hazard Zone at the cursor.',
    code: `const ws = new WeaponSystem();
ws.fire(100, 100, 0, { count: 3, spread: 0.4, behavior: 'ricochet', bounces: 3 });
ws.setOrbiters({ x: 100, y: 100 }, { count: 2, radius: 56 });
console.log('Active projectiles:', ws.activeProjectileCount, '| Orbiter groups:', ws.orbitGroups.size);`
  },
  {
    title: 'StatusEffectManager — Player & Enemy DoT, Slows & Crowd Control [Cycle with R]',
    tag: 'gameplay/statusEffects.js',
    desc: 'Press [R] to switch ammo between Burn (stacking DoT), Chill (-22% speed/stack), and Stun. Enemy Lancers inflict Bleed on contact and Ranged Gunners inflict Chill on the player.',
    code: `const sm = new StatusEffectManager();
const entity = { stats: new Stats({ maxHealth: 100, speed: 200 }) };
sm.define('chill', { duration: 2000, maxStacks: 3, stat: 'speed', modType: 'percent', value: -0.22 });
sm.apply(entity, 'chill', { stacks: 2 });
console.log('Chilled speed (2 stacks):', entity.stats.get('speed'));`
  },
  {
    title: 'TilemapRenderer — 16x16 Offscreen Chunk Cache & Breach Wall Destruction [Toggle with X]',
    tag: 'world/tilemapRenderer.js',
    desc: 'Draws the 50x50 Tilemap in 4-6 drawImage calls per frame. Press [2] to plant a Breach Bomb near interior walls: broken tiles call invalidateTile(c, r) to rebuild only that 16x16 chunk.',
    code: `const tm = new Tilemap({ cols: 50, rows: 50, tileSize: 32 });
const tr = new TilemapRenderer(tm, { chunkSize: 16 });
tr.chunks.forEach((c) => { c.dirty = false; });
tm.set(10, 10, 0);
tr.invalidateTile(10, 10);
console.log('Dirty chunks after wall breach:', tr.chunks.filter((c) => c.dirty).length, '/', tr.totalChunks);`
  },
  {
    title: 'procgen & Tilemap — Seeded Biomes & O(1) Circle Collision [Cycle with G]',
    tag: 'world/procgen.js + world/tilemap.js',
    desc: 'Press [G] to cycle between Tactical Pillar Arena, Cellular Automata Cave, and Dungeon Rooms. Greedy wall rects are extracted for LOS raycasting.',
    code: `const rng = new Random('miku-39');
const cave = procgen.cellularAutomata({ cols: 40, rows: 40, rng: () => rng.next() });
const tm = new Tilemap({ cols: 40, rows: 40, tileSize: 32 }).loadGrid(cave.grid);
console.log('Merged wall rects:', tm.extractWallRects().length);`
  },
  {
    title: 'FlowField, steering & lineOfSight — 3-State AI Navigation',
    tag: 'ai/flowField.js + ai/steering.js + ai/lineOfSight.js',
    desc: 'Enemies check lineOfSight against merged Tilemap walls: clear sight triggers "engage", blocked sight triggers "track" (FlowField pathing around corners), and lost aggro triggers "search" (wander).',
    code: `const walls = [{ x: 100, y: 0, w: 40, h: 100 }];
const canSee = lineOfSight.hasLineOfSight({ x: 20, y: 50 }, { x: 200, y: 50 }, walls);
console.log('Clear LOS:', canSee, '-> AI State:', canSee ? 'engage' : 'track');`
  },
  {
    title: 'ParticleSystem & FloatingTextSystem — Pooled World-Space FX',
    tag: 'ui/particles.js + ui/floatingText.js',
    desc: 'Renders damage numbers, status ticks, non-glowing hit sparks (glow: false), and glowing explosions (glow: true) with zero garbage-collection spikes.',
    code: `const fx = new ParticleSystem();
const fct = new FloatingTextSystem();
fx.emit(100, 100, { count: 10, glow: false });
fct.spawn(100, 90, '-45 CRIT', { color: '#d9b978' });
console.log('Particles:', fx.activeCount, '| Text popups:', fct.activeCount);`
  },
  {
    title: 'Core & Gameplay Backbone — Loop, Input, Camera, SpatialHash, Pool, Stats, Progression, Loot, Inventory, Audio & Storage',
    tag: 'core/* + gameplay/*',
    desc: 'Runs on a 60Hz GameLoop with canvas-relative InputManager coordinates, SpatialHash broad-phase queries, AbilityManager cooldowns, LootTable drops, Inventory belt slots [1-3], SoundManager throttling, and StorageManager high-score persistence.',
    code: `const hash = new SpatialHash(72);
hash.insert({ id: 'mob', x: 120, y: 120, r: 12 });
console.log('SpatialHash candidates:', hash.queryRadius(100, 100, 50).length);`
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