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
} from '../index.js';

export const MODULE_DOCS = [
  {
    id: 'vec2',
    name: 'Vec2',
    tier: 'Tier 1: Core',
    file: 'core/vec2.js',
    demoUrl: '/demo/core/vec2-demo.html',
    importCode: "import { Vec2 } from '@core/vec2.js';",
    summary: '2D vector math for positions, velocities, directions, and zero-sqrt distance checks. Instance methods mutate in place and chain; static methods return a new or target vector without mutating inputs.',
    api: [
      { sig: 'new Vec2(x = 0, y = 0)', desc: 'Creates a 2D vector.' },
      { sig: 'v.set(x, y) / v.copy(other)', desc: 'Updates coordinates in place without allocating a new object.' },
      { sig: 'v.add(other) / v.sub(other)', desc: 'Adds or subtracts another vector in place.' },
      { sig: 'v.mult(scalar) / v.limit(max)', desc: 'Scales the vector or clamps its magnitude to max.' },
      { sig: 'v.normalize()', desc: 'Converts the vector into a unit direction vector of length 1.' },
      { sig: 'v.distanceSq(other) / v.distance(other)', desc: 'Squared distance (fast, no Math.sqrt) or exact Euclidean distance.' },
      { sig: 'Vec2.add(a, b, out) / Vec2.sub(a, b, out)', desc: 'Non-mutating helpers that write into out (or a new Vec2).' }
    ],
    examples: [
      {
        title: 'Diagonal Movement Normalization & Speed Limit',
        tag: 'Example 1',
        desc: 'Prevents diagonal WASD movement from moving 1.414x faster than cardinal movement, then scales by speed and clamps velocity.',
        code: `const inputDir = new Vec2(1, 1); // Holding Right + Down
const speed = 200;
const dt = 0.016; // 16ms frame

// Normalize to length 1, then scale by frame speed
inputDir.normalize().mult(speed * dt);

// Clamp velocity so knockback never exceeds 300
const velocity = new Vec2(260, 260).limit(300);`,
        run: () => {
          const inputDir = new Vec2(1, 1).normalize().mult(200 * 0.016);
          const velocity = new Vec2(260, 260).limit(300);
          return `Normalized step: (${inputDir.x.toFixed(2)}, ${inputDir.y.toFixed(2)}) | len=${inputDir.mag().toFixed(2)}\nClamped vel: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) | mag=${velocity.mag().toFixed(1)}`;
        }
      },
      {
        title: 'Non-Mutating Aim Vector (Player to Mouse)',
        tag: 'Example 2',
        desc: 'Uses Vec2.sub() with a reusable output vector so calculating bullet direction never mutates playerPos or mousePos.',
        code: `const playerPos = new Vec2(100, 100);
const mousePos = new Vec2(400, 500);
const aimDir = new Vec2();

// aimDir = normalize(mousePos - playerPos)
Vec2.sub(mousePos, playerPos, aimDir).normalize();
const bulletVel = aimDir.clone().mult(600);`,
        run: () => {
          const playerPos = new Vec2(100, 100);
          const mousePos = new Vec2(400, 500);
          const aimDir = Vec2.sub(mousePos, playerPos).normalize();
          const bulletVel = aimDir.clone().mult(600);
          return `Aim unit dir: (${aimDir.x.toFixed(2)}, ${aimDir.y.toFixed(2)})\nBullet velocity: (${bulletVel.x.toFixed(0)}, ${bulletVel.y.toFixed(0)}) px/s\nPlayer intact: (${playerPos.x}, ${playerPos.y})`;
        }
      },
      {
        title: 'Fast Squared-Distance Range & Dot Product FOV',
        tag: 'Example 3',
        desc: 'Uses distanceSq() to check pickup range without Math.sqrt(), and dot() to check if an enemy is in front of the player.',
        code: `const player = new Vec2(0, 0);
const facing = new Vec2(1, 0); // Looking right (+X)
const gem = new Vec2(60, 40);
const pickupRadius = 80;

const inRange = player.distanceSq(gem) < pickupRadius * pickupRadius;
const toGem = Vec2.sub(gem, player).normalize();
const inFront = facing.dot(toGem) > 0.5; // Within ~60 deg cone`,
        run: () => {
          const player = new Vec2(0, 0);
          const facing = new Vec2(1, 0);
          const gem = new Vec2(60, 40);
          const distSq = player.distanceSq(gem);
          const toGem = Vec2.sub(gem, player).normalize();
          const dot = facing.dot(toGem);
          return `distSq: ${distSq} vs radiusSq: ${80 * 80} -> inRange: ${distSq < 6400}\nDot product: ${dot.toFixed(2)} -> inFrontCone: ${dot > 0.5}`;
        }
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
    summary: 'Pub/sub event bus that lets combat, UI, audio, and achievement systems communicate without importing each other.',
    api: [
      { sig: 'events.on(event, fn)', desc: 'Registers a listener and returns an unsubscribe() function.' },
      { sig: 'events.once(event, fn)', desc: 'Fires the callback once, then automatically unsubscribes.' },
      { sig: 'events.off(event, fn)', desc: 'Removes a specific callback from an event.' },
      { sig: 'events.emit(event, payload)', desc: 'Calls all listeners registered for event over a safe snapshot copy.' },
      { sig: 'events.clear(event?)', desc: 'Clears one event channel or all channels if omitted.' }
    ],
    examples: [
      {
        title: 'Decoupled Combat Kill Pipeline',
        tag: 'Example 1',
        desc: 'Combat emits a single event while score, loot, and UI systems react independently.',
        code: `const bus = new EventEmitter();
let score = 0, gems = 0;

bus.on('enemyKilled', (e) => { score += e.points; });
bus.on('enemyKilled', (e) => { if (e.dropGem) gems++; });

bus.emit('enemyKilled', { type: 'tank', points: 50, dropGem: true });`,
        run: () => {
          const bus = new EventEmitter();
          let score = 0, gems = 0;
          bus.on('enemyKilled', (e) => { score += e.points; });
          bus.on('enemyKilled', (e) => { if (e.dropGem) gems++; });
          bus.emit('enemyKilled', { type: 'tank', points: 50, dropGem: true });
          return `Emitted 'enemyKilled' -> Score: ${score}, Gems spawned: ${gems}`;
        }
      },
      {
        title: 'Unsubscribe Closure for Cleanup',
        tag: 'Example 2',
        desc: 'Uses the function returned by on() to cleanly detach a temporary UI listener.',
        code: `const bus = new EventEmitter();
const log = [];

const unsubscribe = bus.on('damage', (amt) => log.push(amt));
bus.emit('damage', 15);

unsubscribe(); // Detach listener
bus.emit('damage', 99); // Ignored`,
        run: () => {
          const bus = new EventEmitter();
          const log = [];
          const unsubscribe = bus.on('damage', (amt) => log.push(amt));
          bus.emit('damage', 15);
          unsubscribe();
          bus.emit('damage', 99);
          return `Logged hits before unsubscribe: [${log.join(', ')}] (99 was ignored)`;
        }
      },
      {
        title: 'One-Time Boss Trigger with once()',
        tag: 'Example 3',
        desc: 'Fires an arena hazard exactly once when the boss drops below 50% HP, even if emitted multiple times.',
        code: `const bus = new EventEmitter();
let hazardCount = 0;

bus.once('bossHalfHp', () => { hazardCount++; });
bus.emit('bossHalfHp');
bus.emit('bossHalfHp'); // Won't fire a second time`,
        run: () => {
          const bus = new EventEmitter();
          let hazardCount = 0;
          bus.once('bossHalfHp', () => { hazardCount++; });
          bus.emit('bossHalfHp');
          bus.emit('bossHalfHp');
          return `Emitted 'bossHalfHp' twice -> hazardCount: ${hazardCount}`;
        }
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
      { sig: 'updateFn(dt)', desc: 'Called 0..N times per frame with fixed step in ms (16.67ms at 60Hz).' },
      { sig: 'renderFn(alpha)', desc: 'Called once per screen frame with alpha in [0, 1) for interpolation.' },
      { sig: 'loop.fps', desc: 'Read-only live frames-per-second counter updated every 1000ms.' }
    ],
    examples: [
      {
        title: 'Deterministic Fixed-Step Physics Simulation',
        tag: 'Example 1',
        desc: 'Simulates 100ms of elapsed frame time; the accumulator slices it into exact 16.67ms physics steps.',
        code: `let x = 0, steps = 0;
const loop = new GameLoop(
  (dt) => { x += 100 * (dt / 1000); steps++; },
  (alpha) => {}
);
// Simulate 100ms elapsed time across frame()
loop.isRunning = true;
loop.lastTime = 0;
loop.frame(100);
loop.stop();`,
        run: () => {
          let x = 0, steps = 0;
          const loop = new GameLoop((dt) => { x += 100 * (dt / 1000); steps++; }, () => {}, 60);
          loop.isRunning = true;
          loop.lastTime = 0;
          loop.frame(100);
          loop.stop();
          return `100ms elapsed -> Fixed steps executed: ${steps} | Position X: ${x.toFixed(2)}`;
        }
      },
      {
        title: 'Render Interpolation with Alpha',
        tag: 'Example 2',
        desc: 'Uses the alpha remainder passed to renderFn(alpha) to blend between previous and current positions on 144Hz+ displays.',
        code: `let prevX = 10, currX = 20, drawnX = 0;
const loop = new GameLoop(
  (dt) => { prevX = currX; currX += 10; },
  (alpha) => { drawnX = prevX + (currX - prevX) * alpha; }
);`,
        run: () => {
          let prevX = 10, currX = 20, drawnX = 0, lastAlpha = 0;
          const loop = new GameLoop(
            () => { prevX = currX; currX += 10; },
            (alpha) => { lastAlpha = alpha; drawnX = prevX + (currX - prevX) * alpha; },
            60
          );
          loop.isRunning = true;
          loop.lastTime = 0;
          loop.frame(25); // 1 step (16.67ms) + 8.33ms remainder (alpha ~ 0.5)
          loop.stop();
          return `After 25ms -> prevX: ${prevX}, currX: ${currX}, alpha: ${lastAlpha.toFixed(2)} -> Interpolated X: ${drawnX.toFixed(2)}`;
        }
      },
      {
        title: 'Spiral-of-Death Protection (250ms Clamp)',
        tag: 'Example 3',
        desc: 'When a background browser tab pauses for 5,000ms, GameLoop clamps the delta to 250ms (max 15 steps) so the game does not freeze.',
        code: `let ticks = 0;
const loop = new GameLoop(() => ticks++, () => {}, 60);
loop.isRunning = true;
loop.lastTime = 0;
loop.frame(5000); // Simulate 5-second tab lag spike
loop.stop();`,
        run: () => {
          let ticks = 0;
          const loop = new GameLoop(() => ticks++, () => {}, 60);
          loop.isRunning = true;
          loop.lastTime = 0;
          loop.frame(5000);
          loop.stop();
          return `5000ms lag spike clamped to 250ms -> Executed ${ticks} safe steps instead of 300`;
        }
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
    summary: 'Maps keyboard keys and mouse buttons to logical action names. Tracks continuous hold (isDown), single-frame tap (isPressed), and release (isReleased).',
    api: [
      { sig: 'new InputManager(targetElement?)', desc: 'Creates an input manager and attaches window listeners.' },
      { sig: 'input.setTarget(canvas)', desc: 'Makes input.mouse.x / y relative to the given canvas element.' },
      { sig: 'input.bind(action, keys)', desc: 'Binds an action name to a key code or array of key codes.' },
      { sig: 'input.isDown(action)', desc: 'True every frame while any bound key is held down.' },
      { sig: 'input.isPressed(action)', desc: 'True ONLY on the first frame the action transitions from up to down.' },
      { sig: 'input.isReleased(action)', desc: 'True ONLY on the frame the action transitions from down to up.' },
      { sig: 'input.update()', desc: 'Cycles current state into prevState; call at the end of your fixed update.' }
    ],
    examples: [
      {
        title: 'Edge Detection: Tap vs Hold vs Release',
        tag: 'Example 1',
        desc: 'Distinguishes between pressing Space on frame 1, holding it on frame 2, and releasing it on frame 3.',
        code: `const inp = new InputManager();
inp.bind('dash', ['Space', 'ShiftLeft']);

// Frame 1: keydown Space
inp.state.set('Space', true);
const f1 = { pressed: inp.isPressed('dash'), down: inp.isDown('dash') };
inp.update();

// Frame 2: still holding Space
const f2 = { pressed: inp.isPressed('dash'), down: inp.isDown('dash') };
inp.update();

// Frame 3: keyup Space
inp.state.set('Space', false);
const f3 = { released: inp.isReleased('dash'), down: inp.isDown('dash') };`,
        run: () => {
          const inp = new InputManager();
          inp.detach();
          inp.bind('dash', ['Space', 'ShiftLeft']);
          inp.state.set('Space', true);
          const f1 = `Frame 1 (Down): isPressed=${inp.isPressed('dash')}, isDown=${inp.isDown('dash')}`;
          inp.update();
          const f2 = `Frame 2 (Held): isPressed=${inp.isPressed('dash')}, isDown=${inp.isDown('dash')}`;
          inp.update();
          inp.state.set('Space', false);
          const f3 = `Frame 3 (Up):   isReleased=${inp.isReleased('dash')}, isDown=${inp.isDown('dash')}`;
          return `${f1}\n${f2}\n${f3}`;
        }
      },
      {
        title: 'Runtime Key Rebinding',
        tag: 'Example 2',
        desc: 'Game code checks logical actions like "shoot", so rebinding keys at runtime requires zero changes to gameplay code.',
        code: `const inp = new InputManager();
inp.bind('shoot', 'Mouse0');

// Player rebinds shoot to KeyJ in settings
inp.bind('shoot', ['KeyJ', 'Mouse0']);
inp.state.set('KeyJ', true);`,
        run: () => {
          const inp = new InputManager();
          inp.detach();
          inp.bind('shoot', 'Mouse0');
          inp.bind('shoot', ['KeyJ', 'Mouse0']);
          inp.state.set('KeyJ', true);
          return `Bound 'shoot' to ['KeyJ', 'Mouse0'] -> isDown('shoot') with KeyJ held: ${inp.isDown('shoot')}`;
        }
      },
      {
        title: 'Focus-Loss Stuck Key Prevention',
        tag: 'Example 3',
        desc: 'Automatically clears all held keys when the user Alt-Tabs (window blur), preventing runaway player movement.',
        code: `const inp = new InputManager();
inp.bind('right', 'KeyD');
inp.state.set('KeyD', true);

// Simulate Alt-Tab window blur
inp._onBlur();`,
        run: () => {
          const inp = new InputManager();
          inp.detach();
          inp.bind('right', 'KeyD');
          inp.state.set('KeyD', true);
          const before = inp.isDown('right');
          inp._onBlur();
          const after = inp.isDown('right');
          return `Before blur: isDown('right')=${before} | After blur: isDown('right')=${after}`;
        }
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
    summary: 'Delta-time driven delays, cooldown progress tweens, and repeating intervals. Pauses naturally whenever you stop calling update(dt).',
    api: [
      { sig: 'timer.add(durationMs, onComplete, onUpdate?)', desc: 'Fires onComplete after durationMs; calls onUpdate(progress 0..1) each step.' },
      { sig: 'timer.every(intervalMs, onTick)', desc: 'Calls onTick repeatedly every intervalMs until cancelled.' },
      { sig: 'timer.cancel(handle)', desc: 'Cancels an active delay or repeating timer.' },
      { sig: 'timer.clear()', desc: 'Removes all scheduled timers.' },
      { sig: 'timer.update(dt)', desc: 'Advances all active timers by dt milliseconds.' }
    ],
    examples: [
      {
        title: 'Ability Cooldown with UI Progress Tween',
        tag: 'Example 1',
        desc: 'Tracks a 1000ms cooldown and records the 0..1 progress each step to drive a HUD cooldown bar.',
        code: `const tm = new TimerManager();
const progressLog = [];
let ready = false;

tm.add(
  1000,
  () => { ready = true; },
  (p) => progressLog.push((p * 100).toFixed(0) + '%')
);

tm.update(250);
tm.update(500);
tm.update(250);`,
        run: () => {
          const tm = new TimerManager();
          const progressLog = [];
          let ready = false;
          tm.add(1000, () => { ready = true; }, (p) => progressLog.push(`${(p * 100).toFixed(0)}%`));
          tm.update(250);
          tm.update(500);
          tm.update(250);
          return `Progress steps: ${progressLog.join(' -> ')} | Skill Ready: ${ready}`;
        }
      },
      {
        title: 'Repeating Wave Spawner & Cancellation',
        tag: 'Example 2',
        desc: 'Uses every() to spawn waves every 500ms and cancels the repeating job after 3 waves.',
        code: `const tm = new TimerManager();
let waves = 0;

const spawner = tm.every(500, () => {
  waves++;
  if (waves === 3) tm.cancel(spawner);
});

for (let i = 0; i < 5; i++) tm.update(500);`,
        run: () => {
          const tm = new TimerManager();
          let waves = 0;
          const spawner = tm.every(500, () => {
            waves++;
            if (waves === 3) tm.cancel(spawner);
          });
          for (let i = 0; i < 5; i++) tm.update(500);
          return `Updated 2500ms total -> Waves spawned before cancel: ${waves} (Active timers left: ${tm.timers.length})`;
        }
      },
      {
        title: 'Same-Frame Chronological Firing Order',
        tag: 'Example 3',
        desc: 'Two timers finishing on the same update step fire in the exact order they were registered.',
        code: `const tm = new TimerManager();
const order = [];

tm.add(100, () => order.push('First (buff applied)'));
tm.add(100, () => order.push('Second (attack fired)'));
tm.update(100);`,
        run: () => {
          const tm = new TimerManager();
          const order = [];
          tm.add(100, () => order.push('First (buff applied)'));
          tm.add(100, () => order.push('Second (attack fired)'));
          tm.update(100);
          return `Execution order: ${order.join(' -> ')}`;
        }
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
    summary: 'Seeded Mulberry32 PRNG with FNV-1a string hashing. Guarantees identical number sequences across runs for the same seed.',
    api: [
      { sig: 'new Random(seed = Date.now())', desc: 'Creates a seeded PRNG from any string or finite number.' },
      { sig: 'rng.setSeed(seed)', desc: 'Resets the internal state to replay a seed from the start.' },
      { sig: 'rng.next()', desc: 'Returns a pseudorandom float in [0, 1).' },
      { sig: 'rng.range(min, max)', desc: 'Returns a float in [min, max).' },
      { sig: 'rng.int(min, max)', desc: 'Returns an integer in [min, max] inclusive.' },
      { sig: 'rng.choice(array)', desc: 'Returns a random element from a non-empty array.' }
    ],
    examples: [
      {
        title: 'Reproducible Seed Verification',
        tag: 'Example 1',
        desc: 'Two separate Random instances given the same string seed produce the exact same roll sequence.',
        code: `const runA = new Random('daily-seed-99');
const runB = new Random('daily-seed-99');

const seqA = [runA.int(1, 100), runA.int(1, 100), runA.int(1, 100)];
const seqB = [runB.int(1, 100), runB.int(1, 100), runB.int(1, 100)];`,
        run: () => {
          const runA = new Random('daily-seed-99');
          const runB = new Random('daily-seed-99');
          const seqA = [runA.int(1, 100), runA.int(1, 100), runA.int(1, 100)];
          const seqB = [runB.int(1, 100), runB.int(1, 100), runB.int(1, 100)];
          return `Run A rolls: [${seqA.join(', ')}]\nRun B rolls: [${seqB.join(', ')}] (Identical: ${seqA.join() === seqB.join()})`;
        }
      },
      {
        title: 'Loot Table & Critical Hit Roll',
        tag: 'Example 2',
        desc: 'Combines choice() for item drops with next() for percentage probability checks.',
        code: `const rng = new Random(42);
const loot = ['Medkit', 'Speed Boost', 'Rapid Fire', 'Bomb'];

const drop = rng.choice(loot);
const isCrit = rng.next() < 0.25; // 25% chance
const dmg = rng.int(15, 25) * (isCrit ? 2 : 1);`,
        run: () => {
          const rng = new Random(42);
          const loot = ['Medkit', 'Speed Boost', 'Rapid Fire', 'Bomb'];
          const drop = rng.choice(loot);
          const isCrit = rng.next() < 0.25;
          const dmg = rng.int(15, 25) * (isCrit ? 2 : 1);
          return `Loot drop: ${drop} | Crit roll: ${isCrit} | Final Damage: ${dmg}`;
        }
      },
      {
        title: 'Drafting 3 Unique Level-Up Cards',
        tag: 'Example 3',
        desc: 'Samples 3 non-repeating upgrades from a pool deterministically using rng.int().',
        code: `const rng = new Random('level-2-roll');
const pool = ['Rapid Fire', 'Damage Up', 'Move Speed', 'Max Health', 'Pierce'];
const draft = [];

for (let i = 0; i < 3; i++) {
  const idx = rng.int(0, pool.length - 1);
  draft.push(pool.splice(idx, 1)[0]);
}`,
        run: () => {
          const rng = new Random('level-2-roll');
          const pool = ['Rapid Fire', 'Damage Up', 'Move Speed', 'Max Health', 'Pierce'];
          const draft = [];
          for (let i = 0; i < 3; i++) {
            const idx = rng.int(0, pool.length - 1);
            draft.push(pool.splice(idx, 1)[0]);
          }
          return `Drafted 3 unique cards: ${draft.join(' | ')}`;
        }
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
    summary: 'Recycles objects (bullets, enemies, particles, damage text) to eliminate garbage collection spikes during heavy swarm waves.',
    api: [
      { sig: 'new Pool({ create, init, reset, size, maxSize })', desc: 'Pre-allocates size objects and caps idle storage at maxSize.' },
      { sig: 'pool.get(...args)', desc: 'Pops an idle object (or calls create()) and runs init(item, ...args).' },
      { sig: 'pool.release(item)', desc: 'Runs reset(item) and returns it to the pool. Ignores duplicate releases via WeakSet.' },
      { sig: 'pool.available / pool.inUse', desc: 'Live counts of idle objects in pool vs active objects handed out.' },
      { sig: 'pool.clear()', desc: 'Empties idle storage.' }
    ],
    examples: [
      {
        title: 'Projectile Pool with Parameterized init()',
        tag: 'Example 1',
        desc: 'Passes spawn coordinates and velocity directly through pool.get(x, y, vx, vy) into init().',
        code: `const bulletPool = new Pool({
  create: () => ({ x: 0, y: 0, vx: 0, vy: 0, active: false }),
  init: (b, x, y, vx, vy) => {
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.active = true;
  },
  reset: (b) => { b.active = false; },
  size: 5
});

const b = bulletPool.get(120, 80, 500, 0);`,
        run: () => {
          const bulletPool = new Pool({
            create: () => ({ x: 0, y: 0, vx: 0, vy: 0, active: false }),
            init: (b, x, y, vx, vy) => { b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.active = true; },
            reset: (b) => { b.active = false; },
            size: 5
          });
          const b = bulletPool.get(120, 80, 500, 0);
          return `Spawned bullet: (${b.x}, ${b.y}) vel=(${b.vx}, ${b.vy})\nPool state -> inUse: ${bulletPool.inUse}, available: ${bulletPool.available}`;
        }
      },
      {
        title: 'Double-Release Guard (WeakSet Safety)',
        tag: 'Example 2',
        desc: 'Releasing the same enemy twice on the same frame is safely intercepted so two systems never share one reference.',
        code: `const pool = new Pool({ create: () => ({ id: 1 }), size: 2 });
const enemy = pool.get();

pool.release(enemy);
pool.release(enemy); // Ignored safely`,
        run: () => {
          const pool = new Pool({ create: () => ({ id: 1 }), size: 2 });
          const enemy = pool.get();
          pool.release(enemy);
          pool.release(enemy);
          return `After duplicate release -> available: ${pool.available} (expected 2), inUse: ${pool.inUse} (expected 0)`;
        }
      },
      {
        title: 'Capping Idle Memory with maxSize',
        tag: 'Example 3',
        desc: 'Allows temporary spawning spikes above maxSize, then lets excess objects be garbage-collected on release.',
        code: `const fxPool = new Pool({
  create: () => ({}),
  size: 2,
  maxSize: 3 // Keep at most 3 idle items
});

const burst = [fxPool.get(), fxPool.get(), fxPool.get(), fxPool.get(), fxPool.get()];
burst.forEach((p) => fxPool.release(p));`,
        run: () => {
          const fxPool = new Pool({ create: () => ({}), size: 2, maxSize: 3 });
          const burst = [fxPool.get(), fxPool.get(), fxPool.get(), fxPool.get(), fxPool.get()];
          burst.forEach((p) => fxPool.release(p));
          return `Released 5 items with maxSize: 3 -> Idle kept in pool: ${fxPool.available} (2 excess freed for GC)`;
        }
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
    summary: 'Zero-allocation 2D grid index using 32-bit numeric cell keys and WeakMap bounds tracking. Turns O(N^2) swarm checks into fast local cell lookups.',
    api: [
      { sig: 'new SpatialHash(cellSize = 64)', desc: 'Creates a spatial grid with square cells of cellSize pixels.' },
      { sig: 'grid.insert(client)', desc: 'Indexes a circle {x, y, r}, point {x, y}, or box {x, y, w, h}.' },
      { sig: 'grid.update(client)', desc: 'Re-indexes only if the client crossed a cell boundary (returns boolean).' },
      { sig: 'grid.remove(client)', desc: 'Removes a client from all cells it occupies.' },
      { sig: 'grid.query(x, y, w, h, out = [])', desc: 'Fills out with broad-phase candidates in the AABB box.' },
      { sig: 'grid.queryRadius(x, y, r, out = [])', desc: 'Fills out with candidates overlapping the square around (x, y, r).' }
    ],
    examples: [
      {
        title: 'Zero-Allocation Bullet Neighborhood Query',
        tag: 'Example 1',
        desc: 'Queries only enemies near a bullet using a reusable scratch array instead[ of checking every enemy in the world.',
        code: `const grid = new SpatialHash(64);
grid.insert({ id: 'near', x: 105, y: 100, r: 10 });
grid.insert({ id: 'far',  x: 900, y: 900, r: 10 });

const scratch = [];
grid.queryRadius(100, 100, 20, scratch);`,
        run: () => {
          const grid = new SpatialHash(64);
          grid.insert({ id: 'near', x: 105, y: 100, r: 10 });
          grid.insert({ id: 'far', x: 900, y: 900, r: 10 });
          const scratch = [];
          grid.queryRadius(100, 100, 20, scratch);
          return `Total entities: ${grid.size} | Candidates returned near (100,100): [${scratch.map((e) => e.id).join(', ')}]`;
        }
      },
      {
        title: 'Early-Exit update() Within Same Cell',
        tag: 'Example 2',
        desc: 'Moving an entity a few pixels inside the same 64x64 cell returns false and performs zero Map mutations.',
        code: `const grid = new SpatialHash(64);
const enemy = { x: 10, y: 10, r: 4 };
grid.insert(enemy);

enemy.x = 20; // Still inside cell (0,0)
const crossed1 = grid.update(enemy);

enemy.x = 140; // Crossed into cell (2,0)
const crossed2 = grid.update(enemy);`,
        run: () => {
          const grid = new SpatialHash(64);
          const enemy = { x: 10, y: 10, r: 4 };
          grid.insert(enemy);
          enemy.x = 20;
          const crossed1 = grid.update(enemy);
          enemy.x = 140;
          const crossed2 = grid.update(enemy);
          return `Move to x=20 (same cell): crossed=${crossed1}\nMove to x=140 (new cell): crossed=${crossed2}`;
        }
      },
      {
        title: 'Negative World Coordinates & Mixed Shapes',
        tag: 'Example 3',
        desc: 'Numeric key offset (+32768) supports negative arena coordinates and both circle and box shapes seamlessly.',
        code: `const grid = new SpatialHash(64);
const wall = { type: 'box', x: -200, y: -200, w: 120, h: 120 };
const drone = { type: 'circle', x: -150, y: -150, r: 12 };

grid.insert(wall);
grid.insert(drone);
const hits = grid.query(-180, -180, 50, 50);`,
        run: () => {
          const grid = new SpatialHash(64);
          grid.insert({ type: 'box', x: -200, y: -200, w: 120, h: 120 });
          grid.insert({ type: 'circle', x: -150, y: -150, r: 12 });
          const hits = grid.query(-180, -180, 50, 50);
          return `Queried negative sector (-180, -180) -> Found: [${hits.map((h) => h.type).join(', ')}] across ${grid.cellCount} cells`;
        }
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
    summary: 'Squared-distance boolean overlap checks and zero-allocation penetration manifolds ({ nx, ny, depth }) for physical separation.',
    api: [
      { sig: 'collision.circleCircle(c1, c2)', desc: 'Fast squared-distance overlap check for center circles {x, y, r}.' },
      { sig: 'collision.boxBox(b1, b2)', desc: 'AABB overlap check for top-left boxes {x, y, w, h}.' },
      { sig: 'collision.circleBox(c, b)', desc: 'True if center circle c overlaps top-left box b.' },
      { sig: 'collision.pointCircle(p, c) / pointBox(p, b)', desc: 'True if point {x, y} is inside the shape.' },
      { sig: 'collision.circleCircleInfo(c1, c2, out)', desc: 'Returns {nx, ny, depth} to push c1 out of c2, or null.' },
      { sig: 'collision.circleBoxInfo(c, b, out)', desc: 'Returns {nx, ny, depth} to push circle c out of box b, or null.' },
      { sig: 'collision.boxBoxInfo(b1, b2, out)', desc: 'Returns {nx, ny, depth} minimum translation vector for two boxes.' }
    ],
    examples: [
      {
        title: 'Swarm Crowd Separation (circleCircleInfo)',
        tag: 'Example 1',
        desc: 'Computes the overlap depth and unit normal between two crowding enemies and pushes each halfway apart.',
        code: `const a = { x: 100, y: 100, r: 15 };
const b = { x: 118, y: 100, r: 15 }; // 12px overlap
const manifold = { nx: 0, ny: 0, depth: 0 };

const hit = collision.circleCircleInfo(a, b, manifold);
if (hit) {
  a.x += hit.nx * (hit.depth * 0.5);
  b.x -= hit.nx * (hit.depth * 0.5);
}`,
        run: () => {
          const a = { x: 100, y: 100, r: 15 };
          const b = { x: 118, y: 100, r: 15 };
          const hit = collision.circleCircleInfo(a, b);
          a.x += hit.nx * (hit.depth * 0.5);
          b.x -= hit.nx * (hit.depth * 0.5);
          return `Penetration depth: ${hit.depth}px along normal (${hit.nx}, ${hit.ny})\nResolved -> a.x: ${a.x}, b.x: ${b.x} (Now ${b.x - a.x}px apart)`;
        }
      },
      {
        title: 'Sliding Player Out of Wall (circleBoxInfo)',
        tag: 'Example 2',
        desc: 'Ejects a circular player from a rectangular wall along the shortest axis while preserving tangential movement.',
        code: `const player = { x: 195, y: 150, r: 14 };
const wall = { x: 200, y: 100, w: 80, h: 100 };

const hit = collision.circleBoxInfo(player, wall);
if (hit) {
  player.x += hit.nx * hit.depth;
  player.y += hit.ny * hit.depth;
}`,
        run: () => {
          const player = { x: 195, y: 150, r: 14 };
          const wall = { x: 200, y: 100, w: 80, h: 100 };
          const hit = collision.circleBoxInfo(player, wall);
          player.x += hit.nx * hit.depth;
          player.y += hit.ny * hit.depth;
          return `Wall normal: (${hit.nx}, ${hit.ny}), depth: ${hit.depth}px\nPlayer ejected to x=${player.x} (flush with wall left edge at 200 - 14 = 186)`;
        }
      },
      {
        title: 'Box-vs-Box Minimum Translation Vector (boxBoxInfo)',
        tag: 'Example 3',
        desc: 'Finds the shallowest axis of penetration between two bounding boxes.',
        code: `const crate = { x: 45, y: 20, w: 30, h: 30 };
const wall  = { x: 60, y: 0,  w: 100, h: 100 };

const hit = collision.boxBoxInfo(crate, wall);
if (hit) crate.x += hit.nx * hit.depth;`,
        run: () => {
          const crate = { x: 45, y: 20, w: 30, h: 30 };
          const wall = { x: 60, y: 0, w: 100, h: 100 };
          const hit = collision.boxBoxInfo(crate, wall);
          crate.x += hit.nx * hit.depth;
          return `Box overlap: depth=${hit.depth}px, normal=(${hit.nx}, ${hit.ny}) -> Resolved crate.x: ${crate.x}`;
        }
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
      { sig: 'new Stats(baseStats)', desc: 'Initializes base stats and sets health = maxHealth (defaults to 1).' },
      { sig: "stats.addModifier(id, stat, 'add'|'percent', val)", desc: 'Adds or replaces a named modifier and clamps health.' },
      { sig: 'stats.removeModifier(id) / hasModifier(id)', desc: 'Removes or checks a modifier by ID.' },
      { sig: 'stats.get(stat)', desc: "Computes (base + sum('add')) * (1 + sum('percent'))." },
      { sig: 'stats.takeDamage(amount)', desc: 'Reduces health and returns true ONLY on the killing blow.' },
      { sig: 'stats.heal(amount) / stats.revive(hp)', desc: 'Restores health while alive, or revives a dead entity.' },
      { sig: 'stats.health / maxHealth / healthRatio / dead', desc: 'Live health properties and 0..1 bar ratio.' }
    ],
    examples: [
      {
        title: 'Stacking Flat & Percentage Modifiers',
        tag: 'Example 1',
        desc: 'Combines a flat +10 base damage upgrade with two +25% damage boosts: (20 + 10) * (1 + 0.25 + 0.25) = 45.',
        code: `const hero = new Stats({ maxHealth: 100, damage: 20 });

hero.addModifier('flatRing', 'damage', 'add', 10);
hero.addModifier('perk1', 'damage', 'percent', 0.25);
hero.addModifier('perk2', 'damage', 'percent', 0.25);

const totalDmg = hero.get('damage');`,
        run: () => {
          const hero = new Stats({ maxHealth: 100, damage: 20 });
          hero.addModifier('flatRing', 'damage', 'add', 10);
          hero.addModifier('perk1', 'damage', 'percent', 0.25);
          hero.addModifier('perk2', 'damage', 'percent', 0.25);
          return `Base: 20 | +10 flat | +25% + 25% percent -> Effective Damage: ${hero.get('damage')}`;
        }
      },
      {
        title: 'Single-Trigger Killing Blow & Corpse Guard',
        tag: 'Example 2',
        desc: 'takeDamage() returns true on the exact hit that kills the entity and false on subsequent hits until revive() is called.',
        code: `const enemy = new Stats({ maxHealth: 30 });

const hit1 = enemy.takeDamage(20); // 10 HP left -> false
const hit2 = enemy.takeDamage(20); // 0 HP (Killing blow!) -> true
const hit3 = enemy.takeDamage(20); // Already dead -> false`,
        run: () => {
          const enemy = new Stats({ maxHealth: 30 });
          const hit1 = enemy.takeDamage(20);
          const hit2 = enemy.takeDamage(20);
          const hit3 = enemy.takeDamage(20);
          return `Hit 1 (10 HP): killed=${hit1}\nHit 2 (0 HP):  killed=${hit2} (Drops loot once)\nHit 3 (Corpse): killed=${hit3}`;
        }
      },
      {
        title: 'Max-HP Buff Removal Clamping',
        tag: 'Example 3',
        desc: 'Healing to 150 HP with a +50 maxHealth buff and then removing the buff automatically clamps health back to 100/100.',
        code: `const player = new Stats({ maxHealth: 100 });
player.addModifier('vitality', 'maxHealth', 'add', 50);
player.heal(50); // 150 / 150

player.removeModifier('vitality'); // Clamps to 100 / 100`,
        run: () => {
          const player = new Stats({ maxHealth: 100 });
          player.addModifier('vitality', 'maxHealth', 'add', 50);
          player.heal(50);
          const boosted = `${player.health}/${player.maxHealth}`;
          player.removeModifier('vitality');
          return `With buff: ${boosted} -> After removing buff: ${player.health}/${player.maxHealth} (Ratio: ${player.healthRatio})`;
        }
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
    summary: 'Finite State Machine with enter, update, and exit hooks for enemy AI behaviors and top-level game states.',
    api: [
      { sig: 'new StateMachine()', desc: 'Creates an empty state machine.' },
      { sig: 'fsm.add(name, { enter, update, exit })', desc: 'Registers a named state with lifecycle hooks (chainable).' },
      { sig: 'fsm.change(name, enterParams?)', desc: 'Calls current.exit(), switches state, and calls next.enter(enterParams).' },
      { sig: 'fsm.update(dt)', desc: 'Calls update(dt) on the currently active state.' },
      { sig: 'fsm.currentStateName / fsm.has(name)', desc: 'Inspects the current state or checks if a state is registered.' }
    ],
    examples: [
      {
        title: 'Enemy AI State Transitions with enterParams',
        tag: 'Example 1',
        desc: 'Passes target data into change("chase", target) and automatically triggers exit() on the previous state.',
        code: `const fsm = new StateMachine();
const trace = [];

fsm.add('idle', {
  enter: () => trace.push('enter:idle'),
  exit:  () => trace.push('exit:idle')
}).add('chase', {
  enter: (target) => trace.push('chase:' + target),
  update: (dt) => trace.push('step:' + dt)
});

fsm.change('idle');
fsm.change('chase', 'Player1');
fsm.update(16);`,
        run: () => {
          const fsm = new StateMachine();
          const trace = [];
          fsm.add('idle', { enter: () => trace.push('enter:idle'), exit: () => trace.push('exit:idle') })
             .add('chase', { enter: (target) => trace.push('chase:' + target), update: (dt) => trace.push('step:' + dt) });
          fsm.change('idle');
          fsm.change('chase', 'Player1');
          fsm.update(16);
          return `Lifecycle trace: ${trace.join(' -> ')}`;
        }
      },
      {
        title: 'Automatic Buff Cleanup in exit() Hook',
        tag: 'Example 2',
        desc: 'Guarantees a temporary shield modifier is removed whenever the boss leaves the "shielded" state.',
        code: `const fsm = new StateMachine();
let shieldActive = false;

fsm.add('shielded', {
  enter: () => { shieldActive = true; },
  exit:  () => { shieldActive = false; }
}).add('stunned', {});

fsm.change('shielded');
fsm.change('stunned'); // exit() cleans up shieldActive`,
        run: () => {
          const fsm = new StateMachine();
          let shieldActive = false;
          fsm.add('shielded', { enter: () => { shieldActive = true; }, exit: () => { shieldActive = false; } })
             .add('stunned', {});
          fsm.change('shielded');
          const during = shieldActive;
          fsm.change('stunned');
          return `In 'shielded': shieldActive=${during} -> After transition to 'stunned': shieldActive=${shieldActive}`;
        }
      },
      {
        title: 'Strict Guard Against Typo State Names',
        tag: 'Example 3',
        desc: 'Throws an explicit error if change() is called with an unregistered state name instead of failing silently.',
        code: `const fsm = new StateMachine();
fsm.add('playing', {});

try {
  fsm.change('playnig'); // Typo caught immediately
} catch (err) {
  console.error(err.message);
}`,
        run: () => {
          const fsm = new StateMachine();
          fsm.add('playing', {});
          try {
            fsm.change('playnig');
            return 'No error';
          } catch (err) {
            return `Caught typo error: "${err.message}"`;
          }
        }
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
    summary: '2D viewport camera with dt-independent smooth follow, screen shake, zoom scaling, and screen/world coordinate conversion.',
    api: [
      { sig: 'new Camera(viewportWidth, viewportHeight)', desc: 'Creates a camera for the given canvas dimensions.' },
      { sig: 'cam.follow(target, lerp = 1, dt = 16.67)', desc: 'Centers camera on target {x, y} with frame-rate independent damping.' },
      { sig: 'cam.shake(durationMs, intensity)', desc: 'Applies random trauma offset for durationMs.' },
      { sig: 'cam.setZoom(level)', desc: 'Sets zoom scale (clamped to >= 0.1).' },
      { sig: 'cam.screenToWorld(sx, sy, out)', desc: 'Converts canvas mouse coordinates to world coordinates.' },
      { sig: 'cam.worldToScreen(wx, wy, out)', desc: 'Converts world coordinates to canvas pixel coordinates.' },
      { sig: 'cam.update(dt) / cam.apply(ctx)', desc: 'Advances shake timer and applies scale/translate transform to Canvas2D.' }
    ],
    examples: [
      {
        title: 'Snap vs Smooth Lerp Follow',
        tag: 'Example 1',
        desc: 'Centers an 800x600 viewport on a player at (500, 400) so the camera top-left rests at (100, 100).',
        code: `const cam = new Camera(800, 600);
const player = { x: 500, y: 400 };

cam.follow(player, 1); // lerp=1 snaps immediately`,
        run: () => {
          const cam = new Camera(800, 600);
          cam.follow({ x: 500, y: 400 }, 1);
          return `Viewport 800x600 centered on (500, 400) -> Camera top-left: (${cam.x}, ${cam.y})`;
        }
      },
      {
        title: 'Screen-to-World Mouse Conversion Under Zoom',
        tag: 'Example 2',
        desc: 'Accurately converts a mouse click at canvas center (400, 300) into world coordinates even at 2x zoom.',
        code: `const cam = new Camera(800, 600);
cam.setZoom(2);
cam.follow({ x: 1000, y: 1000 }, 1);

const worldClick = cam.screenToWorld(400, 300);`,
        run: () => {
          const cam = new Camera(800, 600);
          cam.setZoom(2);
          cam.follow({ x: 1000, y: 1000 }, 1);
          const worldClick = cam.screenToWorld(400, 300);
          return `Zoom: 2x | Screen center (400, 300) -> World coords: (${worldClick.x}, ${worldClick.y})`;
        }
      },
      {
        title: 'Timed Trauma Shake Decay',
        tag: 'Example 3',
        desc: 'Offsets the camera during an explosion and automatically resets offsets to (0, 0) once durationMs elapses.',
        code: `const cam = new Camera(800, 600);
cam.shake(200, 12);

cam.update(100); // Mid-shake
const midOffset = { x: cam.offsetX, y: cam.offsetY };

cam.update(150); // Expired (250ms > 200ms)`,
        run: () => {
          const cam = new Camera(800, 600);
          cam.shake(200, 12);
          cam.update(100);
          const mid = `t=100ms: offset=(${cam.offsetX.toFixed(1)}, ${cam.offsetY.toFixed(1)})`;
          cam.update(150);
          const end = `t=250ms: offset=(${cam.offsetX}, ${cam.offsetY}), shakeTimer=${cam.shakeTimer}`;
          return `${mid}\n${end}`;
        }
      }
    ]
  }
];

export function renderExamplesHTML(mod) {
  return `
    <div class="gk-examples-grid">
      ${mod.examples.map((ex, idx) => `
        <div class="gk-example-card">
          <div>
            <div class="gk-example-head">
              <h3>${ex.title}</h3>
              <span>${ex.tag}</span>
            </div>
            <p>${ex.desc}</p>
            <pre class="gk-code-block"><code>${ex.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
          </div>
          <div>
            <div class="gk-run-bar">
              <button class="gk-btn-run" data-mod="${mod.id}" data-idx="${idx}">▶ Run Test</button>
              <small style="color:var(--muted); font-family:monospace;">Live Output</small>
            </div>
            <pre class="gk-test-out" id="out-${mod.id}-${idx}">Click "▶ Run Test" to execute this snippet...</pre>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

export function bindExampleRunners(root = document) {
  root.querySelectorAll('.gk-btn-run').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mod = MODULE_DOCS.find((m) => m.id === btn.dataset.mod);
      if (!mod) return;
      const ex = mod.examples[Number(btn.dataset.idx)];
      const outEl = root.querySelector(`#out-${mod.id}-${btn.dataset.idx}`);
      if (ex && outEl) {
        outEl.textContent = ex.run();
      }
    });
  });
}

// Auto-enhances any individual /demo/core/*-demo.html or /demo/gameplay/*-demo.html page
function autoEnhanceDemoPage() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  const mod = MODULE_DOCS.find((m) => path.endsWith(`${m.id}-demo.html`));
  if (!mod) return;

  document.body.classList.add('gk-doc-page');

  // Remove old raw back link and h3 title so we can place them in the structured header
  const oldBack = document.querySelector('body > a[href="/"]');
  if (oldBack) oldBack.remove();
  const oldH3 = document.querySelector('body > h3');
  if (oldH3) oldH3.remove();

  // Collect remaining original sandbox DOM elements
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
        </nav>
      </div>
    </header>

    <div class="gk-container">
      <div class="gk-doc-header">
        <span class="tier-tag">${mod.tier} &bull; ${mod.file}</span>
        <h1>${mod.name} Module — Live Test &amp; Usage</h1>
        <p>${mod.summary}</p>
      </div>

      <div class="gk-workbench">
        <div class="gk-box">
          <h2>Interactive Module Sandbox</h2>
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
        <h2 style="font-size:1.4rem; margin:0 0 0.25rem;">3 Concrete Code Examples &amp; Live Runners</h2>
        <p>Study the pattern below and click <strong>▶ Run Test</strong> on any card to execute the real <code>${mod.name}</code> module right on this page.</p>
      </div>

      ${renderExamplesHTML(mod)}
    </div>
  `;

  document.body.prepend(wrapper);
  const mount = document.getElementById('gk-sandbox-mount');
  sandboxNodes.forEach((node) => mount.appendChild(node));

  bindExampleRunners(wrapper);
  // Pre-run all 3 examples on load so the user immediately sees real outputs
  wrapper.querySelectorAll('.gk-btn-run').forEach((btn) => btn.click());
}

autoEnhanceDemoPage();