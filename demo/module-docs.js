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
    summary: 'Delta-time driven delays, progress tweens, and repeating intervals that pause automatically when update(dt) is not called.',
    api: [
      { sig: 'timer.add(durationMs, onComplete, onUpdate?)', desc: 'Fires onComplete after durationMs; calls onUpdate(0..1).' },
      { sig: 'timer.every(intervalMs, onTick)', desc: 'Calls onTick repeatedly every intervalMs.' },
      { sig: 'timer.cancel(handle)', desc: 'Cancels an active timer handle.' },
      { sig: 'timer.clear()', desc: 'Removes all scheduled timers.' },
      { sig: 'timer.update(dt)', desc: 'Advances all active timers by dt milliseconds.' }
    ],
    examples: [
      {
        title: 'Cooldown Progress Tween',
        tag: 'Example 1',
        desc: 'Steps through a 1000ms cooldown and logs the tween progress each tick.',
        code: `const tm = new TimerManager();

tm.add(
  1000,
  () => console.log('Cooldown ready!'),
  (p) => console.log('Progress:', (p * 100).toFixed(0) + '%')
);

tm.update(250);
tm.update(500);
tm.update(250);`
      },
      {
        title: 'Repeating Spawner & Cancellation',
        tag: 'Example 2',
        desc: 'Runs a repeating interval every 400ms and cancels it after 3 waves.',
        code: `const tm = new TimerManager();
let wave = 0;

const job = tm.every(400, () => {
  wave++;
  console.log('Spawned wave', wave);
  if (wave === 3) tm.cancel(job);
});

for (let i = 0; i < 5; i++) tm.update(400);`
      },
      {
        title: 'Chronological Execution Order',
        tag: 'Example 3',
        desc: 'Timers finishing on the same frame fire in registration order.',
        code: `const tm = new TimerManager();

tm.add(200, () => console.log('First: Apply buff'));
tm.add(200, () => console.log('Second: Fire projectile'));

tm.update(200);`
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
  }
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