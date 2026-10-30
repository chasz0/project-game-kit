import { CodeEditor } from './code-editor.js';

export const MODULE_DOCS = [
  {
    id: 'vec2',
    name: 'Vec2',
    tier: 'Tier 1: Core',
    file: 'core/vec2.js',
    demoUrl: '/demo/core/vec2-demo.html',
    importCode: "import { Vec2 } from '@core/vec2.js';",
    summary: '2D vector math for positions, velocities, directions, and squared-distance checks. Instance methods mutate in place and chain; static methods write to a new or target vector.',
    api: [
      { sig: 'new Vec2(x = 0, y = 0)', desc: 'Creates a 2D vector.' },
      { sig: 'v.set(x, y) / v.copy(other)', desc: 'Updates coordinates in place without allocating.' },
      { sig: 'v.add(other) / v.sub(other)', desc: 'Adds or subtracts another vector in place.' },
      { sig: 'v.mult(scalar) / v.limit(max)', desc: 'Scales the vector or clamps its magnitude to max.' },
      { sig: 'v.normalize()', desc: 'Converts the vector into a unit vector of length 1.' },
      { sig: 'v.distanceSq(other) / v.distance(other)', desc: 'Squared distance (no sqrt) or exact Euclidean distance.' },
      { sig: 'Vec2.add(a, b, out) / Vec2.sub(a, b, out)', desc: 'Non-mutating helpers that write into out.' }
    ],
    examples: [
      {
        title: 'Diagonal Movement Normalization & Speed Limit',
        tag: 'Example 1',
        desc: 'Edit the input vector or speed below and click Run Code to test normalization and clamping.',
        code: `const inputDir = new Vec2(1, 1);
const speed = 200;
const dt = 0.016;

inputDir.normalize().mult(speed * dt);
console.log('Step:', inputDir.x.toFixed(2), inputDir.y.toFixed(2));

const knockback = new Vec2(260, 260).limit(300);
console.log('Clamped mag:', knockback.mag().toFixed(1));`
      },
      {
        title: 'Non-Mutating Aim Vector (Player to Mouse)',
        tag: 'Example 2',
        desc: 'Uses Vec2.sub() so calculating bullet direction never mutates playerPos or mousePos.',
        code: `const playerPos = new Vec2(100, 100);
const mousePos = new Vec2(400, 500);

const aimDir = Vec2.sub(mousePos, playerPos).normalize();
const bulletVel = aimDir.clone().mult(600);

console.log('Aim dir:', aimDir.x.toFixed(2), aimDir.y.toFixed(2));
console.log('Bullet vel:', bulletVel.x.toFixed(0), bulletVel.y.toFixed(0));
console.log('Player unchanged:', playerPos.x, playerPos.y);`
      },
      {
        title: 'Fast Squared-Distance & Dot Product Cone',
        tag: 'Example 3',
        desc: 'Checks pickup range without Math.sqrt() and checks if a target is in front of the player.',
        code: `const player = new Vec2(0, 0);
const facing = new Vec2(1, 0);
const target = new Vec2(60, 40);
const radius = 80;

const inRange = player.distanceSq(target) < radius * radius;
const toTarget = Vec2.sub(target, player).normalize();
const dot = facing.dot(toTarget);

console.log('In range:', inRange, '(distSq =', player.distanceSq(target) + ')');
console.log('Dot product:', dot.toFixed(2), 'In front:', dot > 0.5);`
      }
    ]
  },
  {
    id: 'events',
    name: 'EventEmitter',
    tier: 'Tier 1: Core',
    file: 'core/events.js',
    demoUrl: '/demo/core/events-demo.html',
    importCode: "import { EventEmitter, events } from '@core/events.js';",
    summary: 'Pub/sub event bus that lets combat, UI, and scoring systems communicate without importing each other.',
    api: [
      { sig: 'events.on(event, fn)', desc: 'Registers a listener and returns an unsubscribe() closure.' },
      { sig: 'events.once(event, fn)', desc: 'Fires the callback once, then automatically unsubscribes.' },
      { sig: 'events.off(event, fn)', desc: 'Removes a specific callback from an event.' },
      { sig: 'events.emit(event, payload)', desc: 'Calls all listeners registered for event over a snapshot copy.' },
      { sig: 'events.clear(event?)', desc: 'Clears one event channel or all channels if omitted.' }
    ],
    examples: [
      {
        title: 'Decoupled Combat Kill Pipeline',
        tag: 'Example 1',
        desc: 'Emit an event with custom payload values and watch multiple independent subscribers react.',
        code: `const bus = new EventEmitter();
let score = 0;
let gems = 0;

bus.on('enemyKilled', (e) => { score += e.points; });
bus.on('enemyKilled', (e) => { if (e.dropGem) gems++; });

bus.emit('enemyKilled', { points: 50, dropGem: true });
console.log('Score:', score, '| Gems:', gems);`
      },
      {
        title: 'Unsubscribe Closure for Cleanup',
        tag: 'Example 2',
        desc: 'Uses the function returned by on() to detach a listener mid-run.',
        code: `const bus = new EventEmitter();
const log = [];

const off = bus.on('hit', (dmg) => log.push(dmg));
bus.emit('hit', 15);
bus.emit('hit', 25);

off();
bus.emit('hit', 999);

console.log('Recorded hits:', log.join(', '));`
      },
      {
        title: 'One-Time Trigger with once()',
        tag: 'Example 3',
        desc: 'Fires a boss phase transition only on the first emission.',
        code: `const bus = new EventEmitter();
let phaseTriggers = 0;

bus.once('bossEnrage', (msg) => {
  phaseTriggers++;
  console.log('Boss enraged:', msg);
});

bus.emit('bossEnrage', 'Phase 2 started');
bus.emit('bossEnrage', 'Duplicate trigger ignored');
console.log('Total triggers:', phaseTriggers);`
      }
    ]
  },
  {
    id: 'loop',
    name: 'GameLoop',
    tier: 'Tier 1: Core',
    file: 'core/loop.js',
    demoUrl: '/demo/core/loop-demo.html',
    importCode: "import { GameLoop } from '@core/loop.js';",
    summary: 'Fixed-timestep accumulator loop. Guarantees physics updates receive an exact fixed delta (ms) and passes an interpolation alpha to render.',
    api: [
      { sig: 'new GameLoop(updateFn, renderFn, fps = 60)', desc: 'Creates a loop with a fixed step of 1000 / fps ms.' },
      { sig: 'loop.start() / loop.stop()', desc: 'Starts or cancels the requestAnimationFrame cycle.' },
      { sig: 'updateFn(dt)', desc: 'Called 0..N times per frame with fixed step in ms.' },
      { sig: 'renderFn(alpha)', desc: 'Called once per screen frame with alpha in [0, 1).' },
      { sig: 'loop.fps', desc: 'Live frames-per-second counter updated every 1000ms.' }
    ],
    examples: [
      {
        title: 'Deterministic Fixed-Step Accumulator',
        tag: 'Example 1',
        desc: 'Change the simulated frame time (e.g., 100ms) to see how many fixed 60Hz steps run.',
        code: `let x = 0;
let steps = 0;

const loop = new GameLoop(
  (dt) => { x += 120 * (dt / 1000); steps++; },
  () => {},
  60
);

loop.isRunning = true;
loop.lastTime = 0;
loop.frame(100);
loop.stop();

console.log('Fixed steps run:', steps);
console.log('Player X:', x.toFixed(2));`
      },
      {
        title: 'Render Interpolation with Alpha',
        tag: 'Example 2',
        desc: 'Blends between previous and current positions using the accumulator remainder.',
        code: `let prevX = 10, currX = 20;
const loop = new GameLoop(
  () => { prevX = currX; currX += 10; },
  (alpha) => {
    const smoothX = prevX + (currX - prevX) * alpha;
    console.log('alpha:', alpha.toFixed(2), '| smoothX:', smoothX.toFixed(2));
  },
  60
);

loop.isRunning = true;
loop.lastTime = 0;
loop.frame(25);
loop.stop();`
      },
      {
        title: '250ms Lag-Spike Clamp',
        tag: 'Example 3',
        desc: 'Simulates a 5000ms background tab freeze and verifies the loop clamps updates to 250ms.',
        code: `let steps = 0;
const loop = new GameLoop(() => steps++, () => {}, 60);

loop.isRunning = true;
loop.lastTime = 0;
loop.frame(5000);
loop.stop();

console.log('5000ms spike clamped to steps:', steps);`
      }
    ]
  },
  {
    id: 'input',
    name: 'InputManager',
    tier: 'Tier 1: Core',
    file: 'core/input.js',
    demoUrl: '/demo/core/input-demo.html',
    importCode: "import { InputManager, input } from '@core/input.js';",
    summary: 'Maps keyboard keys and mouse buttons to logical actions. Tracks continuous hold (isDown), single-frame tap (isPressed), and release (isReleased).',
    api: [
      { sig: 'new InputManager(targetElement?)', desc: 'Creates an input manager and attaches window listeners.' },
      { sig: 'input.setTarget(canvas)', desc: 'Makes input.mouse.x / y relative to the canvas element.' },
      { sig: 'input.bind(action, keys)', desc: 'Binds an action name to a key code or array of key codes.' },
      { sig: 'input.isDown(action)', desc: 'True every frame while any bound key is held.' },
      { sig: 'input.isPressed(action)', desc: 'True ONLY on the first frame the key goes down.' },
      { sig: 'input.isReleased(action)', desc: 'True ONLY on the frame the key is released.' },
      { sig: 'input.update()', desc: 'Copies current state to prevState at the end of each step.' }
    ],
    examples: [
      {
        title: 'Edge Detection: Tap vs Hold vs Release',
        tag: 'Example 1',
        desc: 'Simulates pressing, holding, and releasing Space across 3 consecutive update frames.',
        code: `const inp = new InputManager();
inp.detach();
inp.bind('dash', ['Space', 'ShiftLeft']);

inp.state.set('Space', true);
console.log('Frame 1 (Down):', 'pressed=', inp.isPressed('dash'), 'down=', inp.isDown('dash'));
inp.update();

console.log('Frame 2 (Held):', 'pressed=', inp.isPressed('dash'), 'down=', inp.isDown('dash'));
inp.update();

inp.state.set('Space', false);
console.log('Frame 3 (Up):  ', 'released=', inp.isReleased('dash'), 'down=', inp.isDown('dash'));`
      },
      {
        title: 'Runtime Key Rebinding',
        tag: 'Example 2',
        desc: 'Rebind an action to new keys on the fly without changing gameplay checks.',
        code: `const inp = new InputManager();
inp.detach();
inp.bind('shoot', 'Mouse0');

inp.bind('shoot', ['KeyJ', 'Mouse0']);
inp.state.set('KeyJ', true);

console.log('Shooting with KeyJ:', inp.isDown('shoot'));`
      },
      {
        title: 'Window Blur Stuck-Key Reset',
        tag: 'Example 3',
        desc: 'Verifies that losing window focus clears all held keys.',
        code: `const inp = new InputManager();
inp.detach();
inp.bind('right', 'KeyD');
inp.state.set('KeyD', true);

console.log('Before blur:', inp.isDown('right'));
inp._onBlur();
console.log('After blur:', inp.isDown('right'));`
      }
    ]
  },
  {
    id: 'timer',
    name: 'TimerManager',
    tier: 'Tier 1: Core',
    file: 'core/timer.js',
    demoUrl: '/demo/core/timer-demo.html',
    importCode: "import { TimerManager, timer } from '@core/timer.js';",
    summary: 'General-purpose delta-time scheduler for one-shot delays (bomb fuses, buff durations), progress tweens (0..1 animations), and repeating intervals (poison ticks, clocks).',
    api: [
      { sig: 'timer.add(durationMs, onComplete, onUpdate?)', desc: 'Schedules a one-shot callback and optional 0..1 progress tween.' },
      { sig: 'timer.every(intervalMs, onTick)', desc: 'Runs onTick repeatedly every intervalMs until cancelled.' },
      { sig: 'timer.cancel(handle)', desc: 'Cancels a scheduled delay or repeating interval.' },
      { sig: 'timer.clear()', desc: 'Removes all scheduled timers.' },
      { sig: 'timer.update(dt)', desc: 'Advances all active timers by dt milliseconds.' }
    ],
    examples: [
      {
        title: 'Time Bomb Fuse & Defuse (add + cancel)',
        tag: 'Example 1',
        desc: 'Schedules a 2000ms bomb fuse with a progress tween, then cancels (defuses) it at 1000ms.',
        code: `const tm = new TimerManager();
let exploded = false;

const bomb = tm.add(
  2000,
  () => { exploded = true; },
  (p) => console.log('Fuse at:', (p * 100).toFixed(0) + '%')
);

tm.update(1000);
tm.cancel(bomb);
tm.update(1500);
console.log('Exploded after defuse:', exploded);`
      },
      {
        title: 'Repeating Poison Status Effect (every)',
        tag: 'Example 2',
        desc: 'Applies a 5-damage poison tick every 500ms and stops after 3 ticks.',
        code: `const tm = new TimerManager();
let hp = 100, ticks = 0;

const dot = tm.every(500, () => {
  hp -= 5;
  ticks++;
  if (ticks === 3) tm.cancel(dot);
});

for (let i = 0; i < 5; i++) tm.update(500);
console.log('Ticks fired:', ticks, '| Remaining HP:', hp);`
      },
      {
        title: 'Tweening a Value from A to B',
        tag: 'Example 3',
        desc: 'Uses the 0..1 progress parameter in onUpdate to interpolate a door position from 0 to 200.',
        code: `const tm = new TimerManager();
let doorX = 0;

tm.add(1000, null, (progress) => {
  doorX = 0 + (200 - 0) * progress;
  console.log('Door X:', doorX);
});

tm.update(250);
tm.update(500);
tm.update(250);`
      }
    ]
  },
  {
    id: 'random',
    name: 'Random',
    tier: 'Tier 1: Core',
    file: 'core/random.js',
    demoUrl: '/demo/core/random-demo.html',
    importCode: "import { Random, random } from '@core/random.js';",
    summary: 'Seeded Mulberry32 PRNG with FNV-1a string hashing. Guarantees identical sequences across runs for the same seed.',
    api: [
      { sig: 'new Random(seed = Date.now())', desc: 'Creates a seeded PRNG from any string or finite number.' },
      { sig: 'rng.setSeed(seed)', desc: 'Resets the internal state to replay a seed.' },
      { sig: 'rng.next()', desc: 'Returns a float in [0, 1).' },
      { sig: 'rng.range(min, max)', desc: 'Returns a float in [min, max).' },
      { sig: 'rng.int(min, max)', desc: 'Returns an integer in [min, max] inclusive.' },
      { sig: 'rng.choice(array)', desc: 'Returns a random element from an array.' }
    ],
    examples: [
      {
        title: 'Reproducible Seed Verification',
        tag: 'Example 1',
        desc: 'Try changing the seed string below to see both generators match.',
        code: `const rngA = new Random('miku-39');
const rngB = new Random('miku-39');

const rollsA = [rngA.int(1, 100), rngA.int(1, 100), rngA.int(1, 100)];
const rollsB = [rngB.int(1, 100), rngB.int(1, 100), rngB.int(1, 100)];

console.log('Generator A:', rollsA.join(', '));
console.log('Generator B:', rollsB.join(', '));`
      },
      {
        title: 'Loot Table & Crit Roll',
        tag: 'Example 2',
        desc: 'Uses choice() for item drops and next() for percentage rolls.',
        code: `const rng = new Random(1337);
const items = ['Medkit', 'Speed Boost', 'Rapid Fire', 'Bomb'];

console.log('Dropped:', rng.choice(items));
console.log('Crit hit (25%):', rng.next() < 0.25);
console.log('Damage roll:', rng.int(15, 30));`
      },
      {
        title: 'Drafting 3 Unique Upgrade Cards',
        tag: 'Example 3',
        desc: 'Picks 3 non-repeating upgrades from an array using seeded indices.',
        code: `const rng = new Random('level-up-seed');
const pool = ['Rapid Fire', 'Damage Up', 'Move Speed', 'Max Health', 'Pierce'];
const hand = [];

for (let i = 0; i < 3; i++) {
  const idx = rng.int(0, pool.length - 1);
  hand.push(pool.splice(idx, 1)[0]);
}

console.log('Drafted cards:', hand.join(' | '));`
      }
    ]
  },
  {
    id: 'pool',
    name: 'Pool',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/pool.js',
    demoUrl: '/demo/gameplay/pool-demo.html',
    importCode: "import { Pool } from '@gameplay/pool.js';",
    summary: 'Recycles objects (bullets, enemies, particles, damage text) to eliminate garbage collection spikes during heavy waves.',
    api: [
      { sig: 'new Pool({ create, init, reset, size, maxSize })', desc: 'Pre-allocates size objects and caps idle storage at maxSize.' },
      { sig: 'pool.get(...args)', desc: 'Pops an idle object (or calls create) and runs init(item, ...args).' },
      { sig: 'pool.release(item)', desc: 'Runs reset(item) and returns it to the pool (WeakSet guarded).' },
      { sig: 'pool.available / pool.inUse', desc: 'Counts of idle objects in pool vs active objects handed out.' },
      { sig: 'pool.clear()', desc: 'Empties idle storage.' }
    ],
    examples: [
      {
        title: 'Projectile Pool with init() Arguments',
        tag: 'Example 1',
        desc: 'Spawns and recycles bullets while tracking inUse and available counts.',
        code: `const bullets = new Pool({
  create: () => ({ x: 0, y: 0, vx: 0, vy: 0, active: false }),
  init: (b, x, y, vx, vy) => { b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.active = true; },
  reset: (b) => { b.active = false; },
  size: 4
});

const b1 = bullets.get(50, 80, 400, 0);
console.log('Spawned b1:', b1.x, b1.y, '| inUse:', bullets.inUse, 'idle:', bullets.available);

bullets.release(b1);
console.log('After release | inUse:', bullets.inUse, 'idle:', bullets.available);`
      },
      {
        title: 'Double-Release Protection (WeakSet)',
        tag: 'Example 2',
        desc: 'Releasing the same object twice logs a warning and prevents duplicate references.',
        code: `const pool = new Pool({ create: () => ({ id: 1 }), size: 2 });
const item = pool.get();

pool.release(item);
pool.release(item);

console.log('Idle count:', pool.available, '| In use:', pool.inUse);`
      },
      {
        title: 'Capping Idle Objects with maxSize',
        tag: 'Example 3',
        desc: 'Caps how many idle objects stay in memory after a temporary burst.',
        code: `const fxPool = new Pool({ create: () => ({}), size: 1, maxSize: 3 });

const burst = [fxPool.get(), fxPool.get(), fxPool.get(), fxPool.get(), fxPool.get()];
burst.forEach((p) => fxPool.release(p));

console.log('Kept in pool (maxSize 3):', fxPool.available);`
      }
    ]
  },
  {
    id: 'spatialHash',
    name: 'SpatialHash',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/spatialHash.js',
    demoUrl: '/demo/gameplay/spatialHash-demo.html',
    importCode: "import { SpatialHash } from '@gameplay/spatialHash.js';",
    summary: 'Zero-allocation 2D grid index using 32-bit integer cell keys and WeakMap bounds tracking.',
    api: [
      { sig: 'new SpatialHash(cellSize = 64)', desc: 'Creates a spatial grid with square cells of cellSize pixels.' },
      { sig: 'grid.insert(client)', desc: 'Indexes a circle {x, y, r}, point {x, y}, or box {x, y, w, h}.' },
      { sig: 'grid.update(client)', desc: 'Re-indexes only if the client crossed a cell boundary.' },
      { sig: 'grid.remove(client)', desc: 'Removes a client from all cells it occupies.' },
      { sig: 'grid.query(x, y, w, h, out = [])', desc: 'Fills out with broad-phase candidates in the box.' },
      { sig: 'grid.queryRadius(x, y, r, out = [])', desc: 'Fills out with candidates around center (x, y) within radius r.' }
    ],
    examples: [
      {
        title: 'Zero-Allocation Radius Query',
        tag: 'Example 1',
        desc: 'Finds nearby enemies around (100, 100) using a reusable scratch array.',
        code: `const grid = new SpatialHash(64);
grid.insert({ id: 'slime_1', x: 110, y: 95, r: 10 });
grid.insert({ id: 'slime_2', x: 120, y: 115, r: 10 });
grid.insert({ id: 'boss_far', x: 800, y: 800, r: 25 });

const hits = [];
grid.queryRadius(100, 100, 30, hits);

console.log('Nearby hits:', hits.map((e) => e.id).join(', '));`
      },
      {
        title: 'Early-Exit update() Optimization',
        tag: 'Example 2',
        desc: 'Returns false when an entity moves inside the same cell, skipping Map mutations.',
        code: `const grid = new SpatialHash(64);
const unit = { x: 10, y: 10, r: 4 };
grid.insert(unit);

unit.x = 25;
console.log('Moved to x=25 (same cell):', grid.update(unit));

unit.x = 150;
console.log('Moved to x=150 (new cell):', grid.update(unit));`
      },
      {
        title: 'Negative Coordinates & Mixed Shapes',
        tag: 'Example 3',
        desc: 'Supports both top-left boxes and center circles in negative world coordinates.',
        code: `const grid = new SpatialHash(64);
grid.insert({ name: 'WallBox', x: -200, y: -200, w: 90, h: 90 });
grid.insert({ name: 'DroneCircle', x: -140, y: -140, r: 15 });

const found = grid.query(-180, -180, 60, 60);
console.log('Found in negative sector:', found.map((f) => f.name).join(', '));`
      }
    ]
  },
  {
    id: 'collision',
    name: 'collision',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/collision.js',
    demoUrl: '/demo/gameplay/collision-demo.html',
    importCode: "import { collision } from '@gameplay/collision.js';",
    summary: 'Squared-distance overlap checks and zero-allocation penetration manifolds ({ nx, ny, depth }) for physical separation.',
    api: [
      { sig: 'collision.circleCircle(c1, c2)', desc: 'Fast squared-distance overlap check for circles {x, y, r}.' },
      { sig: 'collision.boxBox(b1, b2)', desc: 'AABB overlap check for top-left boxes {x, y, w, h}.' },
      { sig: 'collision.circleBox(c, b)', desc: 'True if center circle c overlaps top-left box b.' },
      { sig: 'collision.circleCircleInfo(c1, c2, out)', desc: 'Returns {nx, ny, depth} to push c1 out of c2, or null.' },
      { sig: 'collision.circleBoxInfo(c, b, out)', desc: 'Returns {nx, ny, depth} to push circle c out of box b, or null.' },
      { sig: 'collision.boxBoxInfo(b1, b2, out)', desc: 'Returns {nx, ny, depth} minimum translation vector for two boxes.' }
    ],
    examples: [
      {
        title: 'Swarm Crowd Separation (circleCircleInfo)',
        tag: 'Example 1',
        desc: 'Resolves two overlapping enemy circles by pushing each halfway along the collision normal.',
        code: `const a = { x: 100, y: 100, r: 15 };
const b = { x: 118, y: 100, r: 15 };

const hit = collision.circleCircleInfo(a, b);
if (hit) {
  a.x += hit.nx * (hit.depth * 0.5);
  b.x -= hit.nx * (hit.depth * 0.5);
}

console.log('Overlap depth:', hit.depth, '| Resolved a.x:', a.x, 'b.x:', b.x);`
      },
      {
        title: 'Ejecting Circle from Wall (circleBoxInfo)',
        tag: 'Example 2',
        desc: 'Pushes a circular player out of a rectangular obstacle.',
        code: `const player = { x: 195, y: 150, r: 14 };
const wall = { x: 200, y: 100, w: 80, h: 100 };

const hit = collision.circleBoxInfo(player, wall);
if (hit) {
  player.x += hit.nx * hit.depth;
  player.y += hit.ny * hit.depth;
}

console.log('Ejected player to:', player.x, player.y);`
      },
      {
        title: 'Box-vs-Box Penetration Resolution (boxBoxInfo)',
        tag: 'Example 3',
        desc: 'Separates two overlapping bounding boxes along the shallowest axis.',
        code: `const boxA = { x: 45, y: 20, w: 30, h: 30 };
const boxB = { x: 60, y: 0,  w: 100, h: 100 };

const hit = collision.boxBoxInfo(boxA, boxB);
if (hit) {
  boxA.x += hit.nx * hit.depth;
  boxA.y += hit.ny * hit.depth;
}

console.log('Normal:', hit.nx, hit.ny, '| Depth:', hit.depth, '| New boxA.x:', boxA.x);`
      }
    ]
  },
  {
    id: 'stats',
    name: 'Stats',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/stats.js',
    demoUrl: '/demo/gameplay/stats-demo.html',
    importCode: "import { Stats } from '@gameplay/stats.js';",
    summary: 'Health lifecycle and dynamic attribute calculator supporting flat ("add") and additive percentage ("percent") modifiers with automatic clamping.',
    api: [
      { sig: 'new Stats(baseStats)', desc: 'Initializes base stats and sets health = maxHealth.' },
      { sig: "stats.addModifier(id, stat, 'add'|'percent', val)", desc: 'Adds or replaces a modifier and clamps health.' },
      { sig: 'stats.removeModifier(id) / hasModifier(id)', desc: 'Removes or checks a modifier by ID.' },
      { sig: 'stats.get(stat)', desc: "Computes (base + sum('add')) * (1 + sum('percent'))." },
      { sig: 'stats.takeDamage(amount)', desc: 'Reduces health and returns true ONLY on the killing blow.' },
      { sig: 'stats.heal(amount) / stats.revive(hp)', desc: 'Restores health while alive, or revives a dead entity.' }
    ],
    examples: [
      {
        title: 'Stacking Flat & Percent Modifiers',
        tag: 'Example 1',
        desc: 'Formula: (base + flat) * (1 + sum of percent). Try editing the modifier values below.',
        code: `const hero = new Stats({ maxHealth: 100, damage: 20, speed: 200 });

hero.addModifier('ring', 'damage', 'add', 10);
hero.addModifier('perk1', 'damage', 'percent', 0.25);
hero.addModifier('perk2', 'damage', 'percent', 0.25);

console.log('Effective Damage:', hero.get('damage'));`
      },
      {
        title: 'Single Killing Blow & Corpse Guard',
        tag: 'Example 2',
        desc: 'takeDamage() returns true only on the fatal hit and ignores damage while dead.',
        code: `const mob = new Stats({ maxHealth: 30 });

console.log('Hit 1 (20 dmg): killed =', mob.takeDamage(20), '| HP:', mob.health);
console.log('Hit 2 (20 dmg): killed =', mob.takeDamage(20), '| HP:', mob.health);
console.log('Hit 3 (corpse): killed =', mob.takeDamage(20), '| dead:', mob.dead);`
      },
      {
        title: 'Max-HP Buff Removal Clamping',
        tag: 'Example 3',
        desc: 'Removing a maxHealth buff automatically clamps current health to the new maximum.',
        code: `const p = new Stats({ maxHealth: 100 });
p.addModifier('hpBoost', 'maxHealth', 'add', 50);
p.heal(50);
console.log('Boosted HP:', p.health + '/' + p.maxHealth);

p.removeModifier('hpBoost');
console.log('After buff ends:', p.health + '/' + p.maxHealth);`
      }
    ]
  },
  {
    id: 'stateMachine',
    name: 'StateMachine',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/stateMachine.js',
    demoUrl: '/demo/gameplay/stateMachine-demo.html',
    importCode: "import { StateMachine } from '@gameplay/stateMachine.js';",
    summary: 'Finite State Machine with enter, update, and exit hooks for enemy AI and top-level game states.',
    api: [
      { sig: 'new StateMachine()', desc: 'Creates a state machine instance.' },
      { sig: 'fsm.add(name, { enter, update, exit })', desc: 'Registers a named state with lifecycle hooks.' },
      { sig: 'fsm.change(name, enterParams?)', desc: 'Calls current.exit(), switches state, and calls next.enter().' },
      { sig: 'fsm.update(dt)', desc: 'Calls update(dt) on the active state.' },
      { sig: 'fsm.currentStateName / fsm.has(name)', desc: 'Reads active state name or checks registration.' }
    ],
    examples: [
      {
        title: 'AI State Lifecycle & Parameters',
        tag: 'Example 1',
        desc: 'Switches from idle to chase, passing target data into enter().',
        code: `const fsm = new StateMachine();

fsm.add('idle', {
  enter: () => console.log('[idle] scanning...'),
  exit:  () => console.log('[idle] target spotted!')
}).add('chase', {
  enter: (target) => console.log('[chase] pursuing', target),
  update: (dt) => console.log('[chase] moving for', dt + 'ms')
});

fsm.change('idle');
fsm.change('chase', 'Player');
fsm.update(16);`
      },
      {
        title: 'Guaranteed Cleanup in exit()',
        tag: 'Example 2',
        desc: 'Clears temporary flags automatically whenever a state exits.',
        code: `const fsm = new StateMachine();
let invulnerable = false;

fsm.add('dash', {
  enter: () => { invulnerable = true; },
  exit:  () => { invulnerable = false; }
}).add('walk', {});

fsm.change('dash');
console.log('During dash:', invulnerable);

fsm.change('walk');
console.log('After dash exit:', invulnerable);`
      },
      {
        title: 'Unknown State Error Guard',
        tag: 'Example 3',
        desc: 'Throws an explicit error when transitioning to a misspelled state.',
        code: `const fsm = new StateMachine();
fsm.add('playing', {});

fsm.change('playnig');`
      }
    ]
  },
  {
    id: 'camera',
    name: 'Camera',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/camera.js',
    demoUrl: '/demo/gameplay/camera-demo.html',
    importCode: "import { Camera } from '@gameplay/camera.js';",
    summary: '2D viewport camera with dt-independent smooth follow, trauma shake, zoom scaling, and world/screen coordinate conversion.',
    api: [
      { sig: 'new Camera(viewportWidth, viewportHeight)', desc: 'Creates a camera for the canvas dimensions.' },
      { sig: 'cam.follow(target, lerp = 1, dt = 16.67)', desc: 'Centers camera on target {x, y} with damping.' },
      { sig: 'cam.shake(durationMs, intensity)', desc: 'Applies screen shake for durationMs.' },
      { sig: 'cam.setZoom(level)', desc: 'Sets zoom scale (clamped to >= 0.1).' },
      { sig: 'cam.screenToWorld(sx, sy, out)', desc: 'Converts canvas pixel coordinates to world coordinates.' },
      { sig: 'cam.worldToScreen(wx, wy, out)', desc: 'Converts world coordinates to canvas pixel coordinates.' },
      { sig: 'cam.update(dt) / cam.apply(ctx)', desc: 'Updates shake timer and applies transform to Canvas2D.' }
    ],
    examples: [
      {
        title: 'Viewport Centering & Smooth Follow',
        tag: 'Example 1',
        desc: 'Centers an 800x600 camera on a player at (500, 400).',
        code: `const cam = new Camera(800, 600);
const player = { x: 500, y: 400 };

cam.follow(player, 1);
console.log('Camera top-left:', cam.x, cam.y);`
      },
      {
        title: 'Screen-to-World Mouse Projection Under Zoom',
        tag: 'Example 2',
        desc: 'Converts a mouse click at screen center (400, 300) into world space at 2x zoom.',
        code: `const cam = new Camera(800, 600);
cam.setZoom(2);
cam.follow({ x: 1000, y: 1000 }, 1);

const worldPos = cam.screenToWorld(400, 300);
console.log('World coords:', worldPos.x, worldPos.y);`
      },
      {
        title: 'Screen Shake Decay',
        tag: 'Example 3',
        desc: 'Applies a 200ms shake and inspects offsets during and after expiration.',
        code: `const cam = new Camera(800, 600);
cam.shake(200, 12);

cam.update(100);
console.log('At 100ms offset:', cam.offsetX.toFixed(1), cam.offsetY.toFixed(1));

cam.update(150);
console.log('At 250ms offset:', cam.offsetX, cam.offsetY);`
      }
    ]
  },
  {
    id: 'steering',
    name: 'steering',
    tier: 'Tier 3: AI',
    file: 'ai/steering.js',
    demoUrl: '/demo/ai/steering-demo.html',
    importCode: "import { steering } from '@ai/steering.js';",
    summary: 'Zero-allocation steering behaviors (seek, flee with panicRadius limit, arrive, pursue, orbit, wander, separate, flock) and force integration.',
    api: [
      { sig: 'steering.seek(agent, target, maxSpeed, out)', desc: 'Steers agent {x, y, vx, vy} toward target {x, y}.' },
      { sig: 'steering.flee(agent, threat, maxSpeed, panicRadius = 160, out)', desc: 'Flees inside panicRadius; applies braking force once outside safe distance.' },
      { sig: 'steering.arrive(agent, target, maxSpeed, slowRadius, out)', desc: 'Decelerates smoothly inside slowRadius.' },
      { sig: 'steering.orbit(agent, target, radius, maxSpeed, cw, out)', desc: 'Circles target at a fixed standoff radius.' },
      { sig: 'steering.wander(agent, maxSpeed, opts, out)', desc: 'Smooth random patrolling force.' },
      { sig: 'steering.separate(agent, neighbors, sepDist, maxSpeed, out)', desc: 'Repels agent from crowding neighbors.' },
      { sig: 'steering.flock(agent, neighbors, opts, out)', desc: 'Combines separation, alignment, and cohesion in one pass.' },
      { sig: 'steering.applyForce(agent, force, maxForce, maxSpeed, dt)', desc: 'Clamps force, updates velocity, and advances position.' }
    ],
    examples: [
      {
        title: 'Flee with Panic Radius Limit & Braking',
        tag: 'Example 1',
        desc: 'Inside panicRadius (150px) the agent flees; outside 150px it brakes to a stop instead of running forever.',
        code: `const threat = { x: 100, y: 100 };
const closeAgent = { x: 140, y: 100, vx: 50, vy: 0 };
const safeAgent  = { x: 300, y: 100, vx: 50, vy: 0 };

const fClose = steering.flee(closeAgent, threat, 200, 150);
const fSafe  = steering.flee(safeAgent,  threat, 200, 150);

console.log('Inside 150px (flee force.x):', fClose.x.toFixed(1));
console.log('Outside 150px (brake force.x):', fSafe.x.toFixed(1));`
      },
      {
        title: 'Ranged Enemy Orbiting Behavior',
        tag: 'Example 2',
        desc: 'Steers a ranged enemy to circle the player at a 150px standoff distance.',
        code: `const enemy = { x: 250, y: 100, vx: 0, vy: 0 };
const player = { x: 100, y: 100 };

const force = steering.orbit(enemy, player, 150, 180, true);
console.log('Orbit tangent force:', force.x.toFixed(1), force.y.toFixed(1));`
      },
      {
        title: 'Organic Patrol with wander()',
        tag: 'Example 3',
        desc: 'Generates smooth patrolling motion across consecutive steps.',
        code: `const guard = { x: 100, y: 100, vx: 50, vy: 0 };

for (let i = 1; i <= 3; i++) {
  const f = steering.wander(guard, 120);
  steering.applyForce(guard, f, 300, 120, 16);
  console.log('Step', i, 'pos:', guard.x.toFixed(1), guard.y.toFixed(1));
}`
      }
    ]
  },
  {
    id: 'flowField',
    name: 'FlowField',
    tier: 'Tier 3: AI',
    file: 'ai/flowField.js',
    demoUrl: '/demo/ai/flowField-demo.html',
    importCode: "import { FlowField } from '@ai/flowField.js';",
    summary: 'BFS integration and direction vector grid backed by TypedArrays. Solves obstacle pathfinding for thousands of agents in O(1) lookup time per agent.',
    api: [
      { sig: 'new FlowField({ cols, rows, cellSize, originX, originY })', desc: 'Allocates TypedArray grids for walls, costs, and vectors.' },
      { sig: 'field.clearWalls() / field.setWall(col, row, blocked)', desc: 'Clears or sets individual wall cells.' },
      { sig: 'field.setObstacleRect(x, y, w, h, inflate = 0)', desc: 'Marks all cells overlapping a world box as walls.' },
      { sig: 'field.compute(targetX, targetY)', desc: 'Runs BFS from target and populates normalized flow vectors.' },
      { sig: 'field.sample(worldX, worldY, out)', desc: 'Returns the normalized {x, y} flow direction at world coords.' },
      { sig: 'field.getDistance(worldX, worldY)', desc: 'Returns tile step count to the target (-1 if unreachable).' }
    ],
    examples: [
      {
        title: 'Computing & Sampling a Path Around a Wall',
        tag: 'Example 1',
        desc: 'Places a wall between (20, 100) and the goal at (180, 100) and samples the detour direction.',
        code: `const field = new FlowField({ cols: 10, rows: 10, cellSize: 20 });
field.setObstacleRect(80, 40, 20, 120);
field.compute(180, 100);

const dir = field.sample(60, 100);
console.log('Detour vector around wall:', dir.x.toFixed(2), dir.y.toFixed(2));
console.log('Steps to target:', field.getDistance(60, 100));`
      },
      {
        title: 'Negative Arena Coordinates Support',
        tag: 'Example 2',
        desc: 'Configures originX/originY for centered arenas (-800 to +800).',
        code: `const field = new FlowField({
  cols: 40, rows: 40, cellSize: 40, originX: -800, originY: -800
});
field.compute(0, 0);

const dir = field.sample(-400, -400);
console.log('Flow from (-400, -400) to (0, 0):', dir.x.toFixed(2), dir.y.toFixed(2));`
      },
      {
        title: 'Wall Ejection Fallback Sampling',
        tag: 'Example 3',
        desc: 'If an agent is pushed slightly inside a wall tile, sample() automatically steers toward the nearest open neighbor.',
        code: `const field = new FlowField({ cols: 10, rows: 10, cellSize: 20 });
field.setWall(3, 3, true);
field.compute(160, 60);

const escapeDir = field.sample(65, 65);
console.log('Escape vector from wall tile:', escapeDir.x.toFixed(2), escapeDir.y.toFixed(2));`
      }
    ]
  },
  {
    id: 'lineOfSight',
    name: 'lineOfSight',
    tier: 'Tier 3: AI',
    file: 'ai/lineOfSight.js',
    demoUrl: '/demo/ai/lineOfSight-demo.html',
    importCode: "import { lineOfSight } from '@ai/lineOfSight.js';",
    summary: 'Raycasting against boxes and circles, player visibility polygons (castVisionPolygon), and fog-of-war target filtering (filterVisible).',
    api: [
      { sig: 'lineOfSight.hasLineOfSight(a, b, obstacles)', desc: 'Returns true if no box or circle blocks segment a -> b.' },
      { sig: 'lineOfSight.raycast(x1, y1, x2, y2, obstacles, out)', desc: 'Returns closest hit {t, x, y, nx, ny, obstacle} or null.' },
      { sig: 'lineOfSight.inVisionCone(obs, angle, target, range, fov, obstacles?)', desc: 'Checks distance, FOV cone angle, and wall occlusion.' },
      { sig: 'lineOfSight.filterVisible(obs, angle, targets, range, fov, obstacles, out)', desc: 'Fills out with only the targets currently visible to the player/observer.' },
      { sig: 'lineOfSight.castVisionPolygon(origin, angle, fov, range, rays, obstacles, out)', desc: 'Casts a fan of rays to build a flashlight or 360-degree sight polygon.' }
    ],
    examples: [
      {
        title: 'Filtering Enemies Visible to Player (filterVisible)',
        tag: 'Example 1',
        desc: 'Culls enemies hidden behind walls or outside the player flashlight cone.',
        code: `const player = { x: 100, y: 100 };
const walls = [{ x: 180, y: 60, w: 30, h: 80 }];
const enemies = [
  { id: 'visible_grunt', x: 150, y: 100 },
  { id: 'hidden_behind_wall', x: 250, y: 100 },
  { id: 'behind_player', x: 40, y: 100 }
];

const seen = lineOfSight.filterVisible(player, 0, enemies, 300, Math.PI / 2, walls);
console.log('Player sees:', seen.map((e) => e.id).join(', '));`
      },
      {
        title: 'Player Flashlight Polygon (castVisionPolygon)',
        tag: 'Example 2',
        desc: 'Casts 8 rays across a 90-degree cone and clips them against a wall.',
        code: `const player = { x: 100, y: 100 };
const walls = [{ x: 160, y: 50, w: 40, h: 100 }];

const poly = lineOfSight.castVisionPolygon(player, 0, Math.PI / 2, 250, 5, walls);
console.log('Vertices:', poly.length, '| Center ray clipped at x =', poly[2].x.toFixed(0));`
      },
      {
        title: 'Laser Raycast Impact & Surface Normal',
        tag: 'Example 3',
        desc: 'Finds the exact impact coordinates and surface normal against mixed obstacles.',
        code: `const obstacles = [
  { x: 150, y: 0, w: 40, h: 100 },
  { x: 90, y: 50, r: 20 }
];

const hit = lineOfSight.raycast(0, 50, 300, 50, obstacles);
console.log('Hit at:', hit.x.toFixed(1), hit.y.toFixed(1), '| Normal:', hit.nx, hit.ny);`
      }
    ]
  },
  {
    id: 'abilities',
    name: 'AbilityManager',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/abilities.js',
    demoUrl: '/demo/gameplay/abilities-demo.html',
    importCode: "import { AbilityManager } from '@gameplay/abilities.js';",
    summary: 'Manages weapons and active skills with cooldowns, multi-charge regeneration, active durations, cooldown scaling, and auto-casting.',
    api: [
      { sig: 'abilities.register(id, { cooldown, charges, duration, auto, onUse, onEnd })', desc: 'Registers a weapon or ability.' },
      { sig: 'abilities.canUse(id)', desc: 'Returns true if at least 1 charge is available.' },
      { sig: 'abilities.use(id, context, cooldownScale = 1)', desc: 'Consumes a charge, starts recharge timer, and triggers onUse.' },
      { sig: 'abilities.update(dt, context, cooldownScale = 1)', desc: 'Advances recharge timers, active durations, and auto-cast skills.' },
      { sig: 'abilities.getState(id)', desc: 'Returns { ready, charges, maxCharges, cooldownLeft, cooldownRatio, isActive }.' }
    ],
    examples: [
      {
        title: 'Multi-Charge Dash with Cooldown Recovery',
        tag: 'Example 1',
        desc: 'Registers a 2-charge Dash with a 1000ms recharge per charge and steps through time.',
        code: `const skills = new AbilityManager();
skills.register('dash', { cooldown: 1000, charges: 2 });

skills.use('dash');
skills.use('dash');
console.log('After 2 dashes:', skills.getState('dash').charges, 'charges');

skills.update(1000);
console.log('After 1000ms:', skills.getState('dash').charges, 'charge recovered');`
      },
      {
        title: 'Cooldown Reduction Scaling (Haste)',
        tag: 'Example 2',
        desc: 'Passing cooldownScale = 0.5 reduces a 2000ms cooldown to 1000ms.',
        code: `const skills = new AbilityManager();
skills.register('nova', { cooldown: 2000, charges: 1 });

skills.use('nova', null, 0.5);
console.log('Scaled cooldown left:', skills.getState('nova').cooldownLeft + 'ms');`
      },
      {
        title: 'Auto-Casting Primary Weapon',
        tag: 'Example 3',
        desc: 'Setting auto: true fires the weapon automatically whenever its cooldown finishes.',
        code: `const skills = new AbilityManager();
let shots = 0;
skills.register('gun', { cooldown: 200, auto: true, onUse: () => shots++ });

skills.update(200);
skills.update(200);
skills.update(200);
console.log('Auto shots fired:', shots);`
      }
    ]
  },
  {
    id: 'spawner',
    name: 'WaveSpawner',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/spawner.js',
    demoUrl: '/demo/gameplay/spawner-demo.html',
    importCode: "import { WaveSpawner } from '@gameplay/spawner.js';",
    summary: 'Timed wave scheduler with weighted enemy pools and ring or perimeter spawn geometry.',
    api: [
      { sig: 'new WaveSpawner({ rng = Math.random })', desc: 'Creates a wave spawner using the provided PRNG function.' },
      { sig: 'spawner.addWave({ duration, interval, count, shape, minRadius, maxRadius, types })', desc: 'Appends a wave configuration.' },
      { sig: 'spawner.update(dt, centerX, centerY, onSpawn)', desc: 'Advances timers and invokes onSpawn({ x, y, type, wave }).' },
      { sig: 'spawner.pointOnRing(cx, cy, minR, maxR, out)', desc: 'Returns a random point inside the annulus around (cx, cy).' },
      { sig: 'spawner.pointOnPerimeter(cx, cy, w, h, out)', desc: 'Returns a random point along the edges of a rectangle.' }
    ],
    examples: [
      {
        title: 'Seeded Ring Wave Spawning',
        tag: 'Example 1',
        desc: 'Uses Random.next() to deterministically spawn enemies in a ring around (0, 0).',
        code: `const rng = new Random('wave-seed-1');
const spawner = new WaveSpawner({ rng: () => rng.next() });

spawner.addWave({
  duration: 10000, interval: 1000, count: 3,
  shape: 'ring', minRadius: 200, maxRadius: 300,
  types: [{ id: 'grunt', weight: 3 }, { id: 'tank', weight: 1 }]
});

const spawned = [];
spawner.update(1000, 0, 0, (s) => spawned.push(s.type + '@(' + s.x.toFixed(0) + ',' + s.y.toFixed(0) + ')'));
console.log('Spawned:', spawned.join(' | '));`
      },
      {
        title: 'Wave Progression Over Time',
        tag: 'Example 2',
        desc: 'Automatically advances from Wave 1 to Wave 2 when wave duration elapses.',
        code: `const spawner = new WaveSpawner();
spawner.addWave({ duration: 5000, interval: 2500, count: 2 });
spawner.addWave({ duration: 5000, interval: 1000, count: 5 });

spawner.update(5000, 0, 0);
console.log('Current Wave Number:', spawner.waveNumber);`
      },
      {
        title: 'Arena Perimeter Spawn Coordinates',
        tag: 'Example 3',
        desc: 'Generates spawn coordinates along the border of an 800x600 screen.',
        code: `const spawner = new WaveSpawner();
const pt = spawner.pointOnPerimeter(0, 0, 800, 600);
console.log('Perimeter point:', pt.x.toFixed(1), pt.y.toFixed(1));`
      }
    ]
  },
  {
    id: 'progression',
    name: 'Progression',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/progression.js',
    demoUrl: '/demo/gameplay/progression-demo.html',
    importCode: "import { Progression } from '@gameplay/progression.js';",
    summary: 'Manages XP leveling curves, pending level-up queues, and weighted upgrade drafting with maxRank caps.',
    api: [
      { sig: 'new Progression({ baseXp, growthFactor, linearStep })', desc: 'Configures the XP curve.' },
      { sig: 'prog.registerUpgrade({ id, title, desc, maxRank, weight, apply })', desc: 'Adds an upgrade to the draft pool.' },
      { sig: 'prog.addXp(amount)', desc: 'Adds XP and returns how many levels were gained.' },
      { sig: 'prog.rollChoices(count = 3, rng)', desc: 'Drafts up to count unique upgrades that have not reached maxRank.' },
      { sig: 'prog.selectUpgrade(id, context)', desc: 'Increments upgrade rank, decrements pendingLevels, and calls apply(rank).' }
    ],
    examples: [
      {
        title: 'XP Curve & Multi-Level Gain',
        tag: 'Example 1',
        desc: 'Adding a large XP drop processes multiple level-ups and queues them in pendingLevels.',
        code: `const prog = new Progression({ baseXp: 10, growthFactor: 1.5, linearStep: 5 });
const gained = prog.addXp(35);

console.log('Levels gained:', gained, '| New Level:', prog.level);
console.log('XP:', prog.xp + '/' + prog.xpToNext, '| Pending drafts:', prog.pendingLevels);`
      },
      {
        title: 'Weighted Upgrade Drafting & Max Rank Exclusion',
        tag: 'Example 2',
        desc: 'Once an upgrade hits maxRank, rollChoices() automatically excludes it from future drafts.',
        code: `const prog = new Progression();
prog.registerUpgrade({ id: 'pierce', title: 'Pierce', maxRank: 1 });
prog.registerUpgrade({ id: 'speed',  title: 'Speed',  maxRank: 3 });

prog.selectUpgrade('pierce');
const choices = prog.rollChoices(3);
console.log('Available after maxing pierce:', choices.map((c) => c.id).join(', '));`
      },
      {
        title: 'Applying Upgrade Callbacks to Stats',
        tag: 'Example 3',
        desc: 'Connects selectUpgrade() directly to a player Stats instance.',
        code: `const stats = new Stats({ damage: 20 });
const prog = new Progression();

prog.registerUpgrade({
  id: 'dmg',
  maxRank: 5,
  apply: (rank) => stats.addModifier('dmg_perk', 'damage', 'percent', rank * 0.25)
});

prog.selectUpgrade('dmg');
prog.selectUpgrade('dmg');
console.log('Rank:', prog.getRank('dmg'), '| Effective Damage:', stats.get('damage'));`
      }
    ]
  },
  {
    id: 'loot',
    name: 'LootTable',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/loot.js',
    demoUrl: '/demo/gameplay/loot-demo.html',
    importCode: "import { LootTable } from '@gameplay/loot.js';",
    summary: 'Weighted drop table supporting overall drop probability, quantity ranges, guaranteed boss drops, and multi-roll aggregation.',
    api: [
      { sig: 'new LootTable({ dropChance = 1.0 })', desc: 'Creates a loot table with an overall drop probability in [0, 1].' },
      { sig: 'table.add(id, { weight, min, max, guaranteed })', desc: 'Adds a drop entry to the table.' },
      { sig: 'table.roll(rng = Math.random)', desc: 'Returns an array of { id, count } drops.' },
      { sig: 'table.rollMultiple(rolls, rng)', desc: 'Rolls multiple times and merges stack counts by item ID.' }
    ],
    examples: [
      {
        title: 'Seeded Mob Drop Roll',
        tag: 'Example 1',
        desc: 'Rolls a weighted drop table using a seeded Random instance.',
        code: `const rng = new Random('loot-seed-7');
const table = new LootTable({ dropChance: 1.0 })
  .add('gold',   { weight: 70, min: 5, max: 15 })
  .add('medkit', { weight: 25, min: 1, max: 1 })
  .add('relic',  { weight: 5,  min: 1, max: 1 });

console.log('Drop:', table.roll(() => rng.next()));`
      },
      {
        title: 'Boss Chest with Guaranteed Item + Bonus Rolls',
        tag: 'Example 2',
        desc: 'Combines a guaranteed boss core with weighted bonus drops.',
        code: `const chest = new LootTable()
  .add('boss_core', { guaranteed: true, min: 1, max: 1 })
  .add('gold',      { weight: 80, min: 10, max: 20 })
  .add('gem',       { weight: 20, min: 2,  max: 5 });

console.log('Chest contents:', chest.rollMultiple(3));`
      },
      {
        title: 'Drop Chance Filtering',
        tag: 'Example 3',
        desc: 'With dropChance: 0, only guaranteed items drop.',
        code: `const strictTable = new LootTable({ dropChance: 0 })
  .add('key',   { guaranteed: true })
  .add('trash', { weight: 100 });

console.log('Result:', strictTable.roll());`
      }
    ]
  },
  {
    id: 'inventory',
    name: 'Inventory',
    tier: 'Tier 2: Gameplay',
    file: 'gameplay/inventory.js',
    demoUrl: '/demo/gameplay/inventory-demo.html',
    importCode: "import { Inventory } from '@gameplay/inventory.js';",
    summary: 'Slot-capped inventory manager with per-item stack limits, overflow reporting, and consumable item callbacks.',
    api: [
      { sig: 'new Inventory({ maxSlots = 12 })', desc: 'Creates an inventory with a fixed slot capacity.' },
      { sig: 'inv.defineItem(id, { name, maxStack, consumable, onUse })', desc: 'Registers stack size and use behavior for an item ID.' },
      { sig: 'inv.add(id, count = 1)', desc: 'Fills existing stacks then new slots; returns { added, overflow }.' },
      { sig: 'inv.remove(id, count = 1) / inv.use(id, context)', desc: 'Removes items or triggers onUse and consumes 1 stack unit.' },
      { sig: 'inv.count(id) / inv.has(id, minCount)', desc: 'Queries total quantity across all slots.' }
    ],
    examples: [
      {
        title: 'Auto-Splitting Stacks Across Slots',
        tag: 'Example 1',
        desc: 'Adding 7 potions when maxStack is 3 splits them into slots of 3, 3, and 1.',
        code: `const inv = new Inventory({ maxSlots: 4 });
inv.defineItem('potion', { name: 'Health Potion', maxStack: 3 });

inv.add('potion', 7);
console.log('Slots used:', inv.usedSlots, '| Slot counts:', inv.slots.map((s) => s.count).join(', '));`
      },
      {
        title: 'Full Inventory Overflow Reporting',
        tag: 'Example 2',
        desc: 'Reports exact overflow count when slots reach capacity.',
        code: `const inv = new Inventory({ maxSlots: 2 });
inv.defineItem('bomb', { maxStack: 2 });

const res = inv.add('bomb', 6);
console.log('Added:', res.added, '| Overflow left on ground:', res.overflow);`
      },
      {
        title: 'Using a Consumable Item with Stats',
        tag: 'Example 3',
        desc: 'Consumes 1 medkit from the inventory to heal a damaged player.',
        code: `const player = new Stats({ maxHealth: 100 });
player.takeDamage(60);

const inv = new Inventory();
inv.defineItem('medkit', { consumable: true, onUse: (p) => p.heal(50) });
inv.add('medkit', 2);

inv.use('medkit', player);
console.log('Player HP:', player.health, '| Medkits left:', inv.count('medkit'));`
      }
    ]
  },
];

export function mountModuleEditors(container, mod) {
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'gk-examples-grid';
  container.appendChild(grid);

  mod.examples.forEach((ex) => {
    new CodeEditor(grid, {
      title: ex.title,
      tag: ex.tag,
      desc: ex.desc,
      code: ex.code,
      autoRun: true
    });
  });
}

function autoEnhanceDemoPage() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  const mod = MODULE_DOCS.find((m) => path.endsWith(`${m.id}-demo.html`));
  if (!mod) return;

  document.body.classList.add('gk-doc-page');

  const oldBack = document.querySelector('body > a[href="/"]');
  if (oldBack) oldBack.remove();
  const oldH3 = document.querySelector('body > h3');
  if (oldH3) oldH3.remove();

  const sandboxNodes = Array.from(document.body.childNodes).filter(
    (n) => n.nodeName !== 'SCRIPT'
  );

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <header class="gk-topbar">
      <div class="gk-topbar-inner">
        <a href="/" class="gk-brand">← GameKit Hub <span>${mod.file}</span></a>
        <nav class="gk-pill-nav">
          ${MODULE_DOCS.map((m) => `
            <a href="${m.demoUrl}" class="${m.id === mod.id ? 'active' : ''}">${m.name}</a>
          `).join('')}
          <a href="/about.html">About Me</a>
        </nav>
      </div>
    </header>

    <div class="gk-container">
      <div class="gk-doc-header">
        <span class="tier-tag">${mod.tier} &bull; ${mod.file}</span>
        <h1>${mod.name} Module — Interactive Demo &amp; Live Code</h1>
        <p>${mod.summary}</p>
      </div>

      <div class="gk-workbench">
        <div class="gk-box">
          <h2>Interactive Demo</h2>
          <div class="gk-sandbox-stage" id="gk-sandbox-mount"></div>
        </div>

        <div class="gk-box">
          <h2>Import &amp; Public API Reference</h2>
          <pre class="gk-code-block" style="margin-bottom:1rem;"><code>${mod.importCode}</code></pre>
          <table class="gk-api-table">
            <thead>
              <tr><th>Method / Property</th><th>Usage &amp; Behavior</th></tr>
            </thead>
            <tbody>
              ${mod.api.map((row) => `
                <tr>
                  <td><code>${row.sig}</code></td>
                  <td>${row.desc}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="gk-doc-header" style="margin-top:2rem;">
        <h2 style="font-size:1.35rem; color:var(--accent); margin:0 0 0.25rem;">3 Editable Code Sandboxes</h2>
        <p>Edit the JavaScript inside any editor below and click <strong>Run Code</strong> (or press <code>Ctrl+Enter</code>) to test your changes live.</p>
      </div>

      <div id="gk-editors-mount"></div>
    </div>
  `;

  document.body.prepend(wrapper);
  const mount = document.getElementById('gk-sandbox-mount');
  sandboxNodes.forEach((node) => mount.appendChild(node));

  mountModuleEditors(document.getElementById('gk-editors-mount'), mod);
}

autoEnhanceDemoPage();