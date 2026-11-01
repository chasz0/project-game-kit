import { CodeEditor } from './code-editor.js';

export const CATEGORY_META = {
  core: {
    label: 'Core Systems',
    tagline: 'Math, fixed-timestep loop, events, input, timers, PRNG, storage, and Web Audio.'
  },
  gameplay: {
    label: 'Gameplay & Combat',
    tagline: 'Object pooling, spatial hashing, collision manifolds, stats, FSM, weapons, and status effects.'
  },
  ai: {
    label: 'AI & Navigation',
    tagline: 'Autonomous steering forces, BFS flow fields, raycast sight cones, and adaptive swarm pacing.'
  },
  world: {
    label: 'World & Procgen',
    tagline: 'O(1) tilemap collision, offscreen chunk caching, and seeded cave/dungeon/arena generation.'
  },
  ui: {
    label: 'UI & Telemetry',
    tagline: 'Zero-allocation particles, floating combat text, branching dialogue, and live profiler console.'
  }
};

export const MODULE_CATALOG = [
  // CORE (8)
  {
    id: 'vec2',
    category: 'core',
    title: 'Vec2',
    exportName: 'Vec2',
    file: 'core/vec2.js',
    demoPath: '/demo/core/vec2-demo.html',
    summary: '2D vector math with chainable in-place mutation and zero-allocation static helpers.',
    details: 'Vec2 avoids garbage collection spikes during 60Hz swarm updates by mutating instances in place (`pos.add(vel).limit(max)`) while offering static helpers (`Vec2.add(a, b, out)`, `Vec2.sub(a, b, out)`) that write into reusable scratch vectors.',
    mechanics: [
      'Chainable instance operations (`add`, `sub`, `mult`, `normalize`, `limit`) mutate `this` in place.',
      'Squared magnitude and distance helpers (`magSq`, `distanceSq`) avoid `Math.sqrt` inside inner loops.',
      'Static methods accept an optional `out` vector for zero-allocation math.'
    ],
    api: [
      ['new Vec2(x = 0, y = 0)', 'Creates a 2D vector instance.'],
      ['set(x, y) / copy(v) / clone()', 'Sets coordinates, copies another vector, or allocates a duplicate.'],
      ['add(v) / sub(v) / mult(n)', 'In-place vector addition, subtraction, and scalar multiplication.'],
      ['mag() / magSq() / dot(v)', 'Returns length, squared length, or dot product.'],
      ['normalize() / limit(max)', 'Normalizes to unit length or clamps magnitude to `max`.'],
      ['distance(v) / distanceSq(v)', 'Euclidean or squared distance to vector `v`.'],
      ['Vec2.add(a, b, out) / Vec2.sub(a, b, out)', 'Static non-mutating math writing into `out`.']
    ],
    snippet: `const pos = new Vec2(10, 20);
const target = new Vec2(40, 60);
const scratch = new Vec2();

Vec2.sub(target, pos, scratch).normalize().mult(5);
pos.add(scratch);
console.log('Stepped Pos:', pos.x, pos.y, '| Remaining Dist:', pos.distance(target));`
  },
  {
    id: 'events',
    category: 'core',
    title: 'EventEmitter',
    exportName: 'EventEmitter, events',
    file: 'core/events.js',
    demoPath: '/demo/core/events-demo.html',
    summary: 'Lightweight pub/sub event bus for decoupled communication between game systems.',
    details: 'Decouples combat, audio, UI, and progression logic so systems can react to gameplay events (`enemyKilled`, `playerDamaged`) without importing each other directly.',
    mechanics: [
      '`on()` returns an unsubscribe closure for one-line cleanup.',
      '`emit()` iterates over a shallow snapshot (`list.slice()`) so listeners calling `off()` or `once()` mid-emit never skip subsequent callbacks.',
      'Automatically deletes empty event keys from the internal `Map` when the last listener is removed.'
    ],
    api: [
      ['new EventEmitter()', 'Creates an isolated event bus (or use singleton `events`).'],
      ['on(event, callback)', 'Subscribes `callback` and returns an `off()` function.'],
      ['once(event, callback)', 'Subscribes `callback` for a single emission, then auto-removes it.'],
      ['off(event, callback)', 'Removes a specific callback from `event`.'],
      ['emit(event, data)', 'Invokes all listeners registered for `event` with `data`.'],
      ['clear(event?)', 'Clears one event channel or all channels if omitted.']
    ],
    snippet: `const bus = new EventEmitter();
const off = bus.on('lootDropped', (item) => console.log('Picked up:', item));
bus.once('lootDropped', () => console.log('First drop achievement unlocked!'));

bus.emit('lootDropped', 'Medkit');
bus.emit('lootDropped', 'Breach Bomb');
off();`
  },
  {
    id: 'loop',
    category: 'core',
    title: 'GameLoop',
    exportName: 'GameLoop',
    file: 'core/loop.js',
    demoPath: '/demo/core/loop-demo.html',
    summary: 'Fixed-timestep simulation loop with lag-spike clamping and render interpolation.',
    details: 'Decouples deterministic physics/AI updates from variable monitor refresh rates (60Hz, 120Hz, 144Hz) by accumulating elapsed frame time and stepping `updateFn(step)` in fixed increments.',
    mechanics: [
      'Clamps frame deltas at `250ms` to prevent spiral-of-death freezes when returning from a backgrounded browser tab.',
      'Passes `alpha = accumulator / step` in `[0, 1)` to `renderFn(alpha)` for sub-frame visual interpolation.',
      'Tracks real-time rendered frames per second via `loop.fps`.'
    ],
    api: [
      ['new GameLoop(updateFn, renderFn, targetFps = 60)', 'Configures fixed step (`1000 / targetFps` ms).'],
      ['start() / stop()', 'Starts or cancels the `requestAnimationFrame` loop.'],
      ['frame(currentTime)', 'Internal frame driver; steps fixed updates and invokes render.'],
      ['loop.fps / loop.step / loop.isRunning', 'Read-only runtime state properties.']
    ],
    snippet: `let ticks = 0;
const loop = new GameLoop(
  (dt) => { ticks++; },
  (alpha) => { console.log('Ticks:', ticks, 'Step ms:', loop.step.toFixed(2), 'Alpha:', alpha.toFixed(2)); },
  60
);
loop.isRunning = true;
loop.lastTime = 0;
loop.frame(36);
loop.stop();`
  },
  {
    id: 'input',
    category: 'core',
    title: 'InputManager',
    exportName: 'InputManager, input',
    file: 'core/input.js',
    demoPath: '/demo/core/input-demo.html',
    summary: 'Action-mapped keyboard and mouse input tracker with letterbox-aware canvas coordinates.',
    details: 'Maps multiple physical keys and mouse buttons (`KeyW`, `ArrowUp`, `Mouse0`) to logical action names and distinguishes continuous holds from single-frame press/release edges.',
    mechanics: [
      'Translates `clientX/Y` into logical canvas coordinates even when the canvas uses CSS padding, borders, or `object-fit: contain | cover`.',
      'Clears active key states on window `blur` to prevent stuck movement keys when switching windows.',
      'Call `input.update()` at the end of each fixed step to cycle `prevState`.'
    ],
    api: [
      ['new InputManager(targetElement?)', 'Creates an input manager bound to window events.'],
      ['setTarget(canvasElement)', 'Sets the reference canvas for mouse coordinate projection.'],
      ['bind(action, keys)', 'Binds an action name to a key code or array of key/mouse codes.'],
      ['isDown(action)', 'Returns `true` while any bound key is held down.'],
      ['isPressed(action) / isReleased(action)', 'Returns `true` only on the initial press or release frame.'],
      ['update()', 'Advances edge-detection state at the end of a fixed update tick.']
    ],
    snippet: `const inp = new InputManager();
inp.detach();
inp.bind('dash', ['ShiftLeft', 'KeySpace']);
inp.state.set('ShiftLeft', true);
console.log('Frame 1 — isPressed:', inp.isPressed('dash'), 'isDown:', inp.isDown('dash'));
inp.update();
console.log('Frame 2 — isPressed:', inp.isPressed('dash'), 'isDown:', inp.isDown('dash'));`
  },
  {
    id: 'timer',
    category: 'core',
    title: 'TimerManager',
    exportName: 'TimerManager, timer',
    file: 'core/timer.js',
    demoPath: '/demo/core/timer-demo.html',
    summary: 'Delta-time scheduler for one-shot delays, normalized progress tweens, and repeating intervals.',
    details: 'Replaces `setTimeout` and `setInterval` with deterministic, pause-safe timers stepped directly by your fixed game loop delta time (`dt`).',
    mechanics: [
      'Uses an in-place write pointer during `update(dt)` to remove expired or cancelled timers with zero array allocations.',
      'Passes normalized progress `[0, 1]` to `onUpdate(progress)` for fuse bars, cooldowns, and door tweens.',
      'Preserves remainder overflow (`elapsed %= duration`) on repeating intervals so rhythm never drifts.'
    ],
    api: [
      ['new TimerManager()', 'Creates a timer scheduler (or use singleton `timer`).'],
      ['add(durationMs, onComplete, onUpdate?)', 'Schedules a one-shot delay with optional progress callback.'],
      ['every(intervalMs, onTick)', 'Schedules a repeating interval timer.'],
      ['cancel(handle) / clear()', 'Cancels a single timer handle or clears all active timers.'],
      ['update(dt)', 'Advances all active timers by `dt` milliseconds.']
    ],
    snippet: `const tm = new TimerManager();
tm.add(1000, () => console.log('Boom!'), (p) => console.log('Fuse progress:', (p * 100).toFixed(0) + '%'));
tm.update(500);
tm.update(500);`
  },
  {
    id: 'random',
    category: 'core',
    title: 'Random',
    exportName: 'Random, random',
    file: 'core/random.js',
    demoPath: '/demo/core/random-demo.html',
    summary: 'Seeded Mulberry32 pseudo-random number generator for deterministic runs and procgen.',
    details: 'Hashes string or numeric seeds (via FNV-1a + Mulberry32) so sharing a seed string reproduces the exact same dungeon layout, enemy waves, and loot rolls.',
    mechanics: [
      'Accepts human-readable string seeds (`"sector-39"`) or numeric seeds.',
      '`int(min, max)` is inclusive of both `min` and `max`.',
      'Can be passed as `{ rng: () => rng.next() }` into `WaveSpawner`, `SwarmDirector`, `LootTable`, `procgen`, and `ParticleSystem`.'
    ],
    api: [
      ['new Random(seed = Date.now())', 'Initializes PRNG with a string or finite number seed.'],
      ['setSeed(seed)', 'Resets internal state from a new string or number seed.'],
      ['next()', 'Returns a float in `[0, 1)`.'],
      ['range(min, max)', 'Returns a float in `[min, max)`.'],
      ['int(min, max)', 'Returns an integer in `[min, max]` inclusive.'],
      ['choice(array)', 'Picks a random element from a non-empty array.']
    ],
    snippet: `const rngA = new Random('sector-39');
const rngB = new Random('sector-39');
console.log('Run A:', rngA.int(1, 100), rngA.choice(['Cave', 'Dungeon', 'Arena']));
console.log('Run B:', rngB.int(1, 100), rngB.choice(['Cave', 'Dungeon', 'Arena']));`
  },
  {
    id: 'storage',
    category: 'core',
    title: 'StorageManager',
    exportName: 'StorageManager, storage',
    file: 'core/storage.js',
    demoPath: '/demo/core/storage-demo.html',
    summary: 'Unified save-data manager supporting LocalStorage, Root JSON File, and Supabase backends.',
    details: 'Maintains an in-memory synchronous `Map` cache for instant `get()` reads during gameplay while flushing changes asynchronously to Browser LocalStorage, a local project root `.json` file, or a Supabase Postgres table.',
    mechanics: [
      'Synchronous `get(key, fallback)` never blocks the 60Hz game loop.',
      'Root File mode connects to the custom Vite dev middleware (`/__gamekit_storage`) to read/write `gamekit-save.json` directly on disk.',
      'Includes browser `.json` file export (`downloadFile`) and import (`importJSON`).'
    ],
    api: [
      ['new StorageManager({ namespace = "gamekit" })', 'Creates a storage manager preloaded from LocalStorage.'],
      ['useLocal({ namespace })', 'Switches active backend to browser `localStorage`.'],
      ['useFile({ filename, endpoint })', 'Switches active backend to project root JSON file.'],
      ['useSupabase({ url, anonKey, table, profileId })', 'Switches active backend to Supabase REST/client upsert.'],
      ['get(key, fallback) / set(key, value) / setMany(obj)', 'Reads synchronously or writes and flushes save keys.'],
      ['load() / flush() / downloadFile()', 'Pulls from backend, pushes cache, or downloads a `.json` backup.']
    ],
    snippet: `const save = new StorageManager({ namespace: 'demo_save' });
await save.setMany({ highScore: 18400, bestWave: 9 });
console.log('All Saved Keys:', save.getAll());`
  },
  {
    id: 'audio',
    category: 'core',
    title: 'SoundManager',
    exportName: 'SoundManager, audio',
    file: 'core/audio.js',
    demoPath: '/demo/core/audio-demo.html',
    summary: 'Zero-asset Web Audio synthesizer with per-sound swarm throttling and pitch variance.',
    details: 'Synthesizes procedural retro/sci-fi sound effects (`shoot`, `hit`, `explosion`, `pickup`, `dash`, `levelup`) using Web Audio oscillators and bandpass-filtered noise buffers without external `.mp3` or `.wav` files.',
    mechanics: [
      'Enforces per-preset `throttleMs` cooldowns so 50 simultaneous AoE swarm hits do not clip the audio mixer.',
      'Applies subtle random `pitchVariance` on each play call to prevent ear fatigue.',
      'Lazily initializes and resumes `AudioContext` on first user interaction.'
    ],
    api: [
      ['new SoundManager({ masterVolume = 0.4 })', 'Initializes synthesizer and registers 6 default presets.'],
      ['register(id, { wave, freq, endFreq, duration, throttleMs })', 'Defines a custom procedural sound preset.'],
      ['play(id, { volumeScale = 1, pitchScale = 1 })', 'Plays preset if not muted or throttled; returns boolean.'],
      ['setVolume(level) / setMuted(bool) / toggleMute()', 'Controls master gain and mute state.']
    ],
    snippet: `const sfx = new SoundManager();
console.log('Registered presets:', Array.from(sfx.sounds.keys()).join(', '));
console.log('Can play hit:', sfx.canPlay('hit'));`
  },

  // GAMEPLAY (13)
  {
    id: 'pool',
    category: 'gameplay',
    title: 'Pool',
    exportName: 'Pool',
    file: 'gameplay/pool.js',
    demoPath: '/demo/gameplay/pool-demo.html',
    summary: 'Generic object pool that recycles entities and projectiles to eliminate GC pauses.',
    details: 'Preallocates and reuses objects (`enemies`, `projectiles`, `gems`, `pickups`) via `get(...args)` and `release(obj)` hooks so high-frequency spawning never triggers garbage collection stalls.',
    mechanics: [
      'Tracks active objects in an internal `Set` so accidental duplicate `release(obj)` calls are safely ignored.',
      'Invokes `init(obj, ...args)` when acquiring an item and `reset(obj)` when returning it.',
      'Respects `maxSize` to cap idle memory footprint after massive swarm waves.'
    ],
    api: [
      ['new Pool({ create, init, reset, size = 10, maxSize = Infinity })', 'Preallocates `size` objects using `create()`.'],
      ['get(...args)', 'Pops an idle object (or creates one) and calls `init(obj, ...args)`.'],
      ['release(obj)', 'Calls `reset(obj)` and returns the object to the idle stack.'],
      ['pool.available / pool.inUse', 'Current idle and active object counts.']
    ],
    snippet: `const bulletPool = new Pool({
  create: () => ({ x: 0, y: 0, active: false }),
  init: (b, x, y) => { b.x = x; b.y = y; b.active = true; },
  reset: (b) => { b.active = false; },
  size: 5
});
const b = bulletPool.get(120, 80);
console.log('Acquired:', b, '| InUse:', bulletPool.inUse, '| Available:', bulletPool.available);
bulletPool.release(b);
console.log('After release — InUse:', bulletPool.inUse, '| Available:', bulletPool.available);`
  },
  {
    id: 'spatialHash',
    category: 'gameplay',
    title: 'SpatialHash',
    exportName: 'SpatialHash',
    file: 'gameplay/spatialHash.js',
    demoPath: '/demo/gameplay/spatialHash-demo.html',
    summary: 'Broad-phase 2D spatial grid for O(1) neighbor queries across thousands of moving entities.',
    details: 'Partitions world space into uniform cells hashed by a 32-bit integer coordinate key, turning $O(N^2)$ swarm collision and weapon targeting checks into fast local cell lookups.',
    mechanics: [
      '`update(client)` caches each entity\'s previous cell bounds in a `WeakMap` and early-exits in $O(1)$ if the entity has not crossed a cell border.',
      'Deduplicates multi-cell entities during `query()` and `queryRadius()` using an internal `_seen` set.',
      'Accepts a reusable `out` array to perform zero-allocation broad-phase queries.'
    ],
    api: [
      ['new SpatialHash(cellSize = 64)', 'Creates a spatial hash grid with the given cell size in pixels.'],
      ['insert(client) / remove(client)', 'Inserts or removes `{ x, y, r }` or `{ x, y, w, h }`.'],
      ['update(client)', 'Updates cell registration only if cell bounds changed; returns boolean.'],
      ['query(x, y, w, h, out = [])', 'Fills `out` with unique entities overlapping the AABB.'],
      ['queryRadius(x, y, r, out = [])', 'Fills `out` with unique entities inside the bounding square of radius `r`.'],
      ['clear()', 'Removes all cells and bounds registrations.']
    ],
    snippet: `const grid = new SpatialHash(64);
const e1 = { id: 'grunt_1', x: 100, y: 100, r: 12 };
const e2 = { id: 'grunt_2', x: 400, y: 400, r: 12 };
grid.insert(e1);
grid.insert(e2);
const hits = grid.queryRadius(110, 105, 40);
console.log('Nearby entities:', hits.map(h => h.id));`
  },
  {
    id: 'collision',
    category: 'gameplay',
    title: 'Collision & Manifolds',
    exportName: 'collision',
    file: 'gameplay/collision.js',
    demoPath: '/demo/gameplay/collision-demo.html',
    summary: 'Narrow-phase 2D overlap tests and minimum translation vector (MTV) penetration manifolds.',
    details: 'Provides fast boolean overlap checks for triggers/pickups alongside penetration manifold resolvers (`{ nx, ny, depth }`) to push overlapping circles and AABB boxes apart cleanly.',
    mechanics: [
      'Circles use center coordinates `{ x, y, r }`; boxes use top-left coordinates `{ x, y, w, h }`.',
      '`circleBoxInfo` handles both external corner clamping and deep interior center overlaps without NaN normals.',
      'All `*Info` methods accept a reusable `out` manifold object `{ nx: 0, ny: 0, depth: 0 }`.'
    ],
    api: [
      ['circleCircle(c1, c2) / boxBox(b1, b2) / circleBox(c, b)', 'Fast boolean overlap checks.'],
      ['pointCircle(p, c) / pointBox(p, b)', 'Point containment tests for UI/cursor picking.'],
      ['circleCircleInfo(c1, c2, out?)', 'Returns `{ nx, ny, depth }` to push `c1` out of `c2`, or `null`.'],
      ['circleBoxInfo(c, b, out?)', 'Returns `{ nx, ny, depth }` to push circle `c` out of box `b`, or `null`.'],
      ['boxBoxInfo(b1, b2, out?)', 'Returns `{ nx, ny, depth }` to push box `b1` out of `b2`, or `null`.']
    ],
    snippet: `const a = { x: 100, y: 100, r: 15 };
const b = { x: 120, y: 100, r: 15 };
const hit = collision.circleCircleInfo(a, b);
console.log('Manifold:', hit);`
  },
  {
    id: 'stats',
    category: 'gameplay',
    title: 'Stats',
    exportName: 'Stats',
    file: 'gameplay/stats.js',
    demoPath: '/demo/gameplay/stats-demo.html',
    summary: 'Entity attribute container with flat/percent modifier stacking, health clamping, and death latches.',
    details: 'Manages base stats (`maxHealth`, `speed`, `damage`, `fireDelay`), named buff/debuff modifiers, and health lifecycle so upgrades and status effects never corrupt base values.',
    mechanics: [
      'Computes `(base + sumFlat) * (1 + sumPercent)` dynamically when `get(stat)` is called.',
      'Clamps `health` automatically when `maxHealth` modifiers are added or removed.',
      '`takeDamage(amount)` returns `true` strictly once on the transition from alive to `dead`.'
    ],
    api: [
      ['new Stats(baseStats)', 'Initializes base attributes and sets `health = maxHealth`.'],
      ['get(statName)', 'Returns modified stat value after flat (`"add"`) and `"percent"` modifiers.'],
      ['addModifier(id, stat, type, value)', 'Adds or overwrites a named modifier (`"add"` or `"percent"`).'],
      ['removeModifier(id) / hasModifier(id)', 'Removes or checks a modifier by ID.'],
      ['takeDamage(amount)', 'Reduces health; returns `true` only on the killing blow.'],
      ['heal(amount) / revive(health?)', 'Restores health while alive, or clears `dead` state.']
    ],
    snippet: `const hero = new Stats({ maxHealth: 100, damage: 20, speed: 200 });
hero.addModifier('fury_ring', 'damage', 'add', 10);
hero.addModifier('berserk', 'damage', 'percent', 0.5);
console.log('Effective Damage:', hero.get('damage'));`
  },
  {
    id: 'stateMachine',
    category: 'gameplay',
    title: 'StateMachine',
    exportName: 'StateMachine',
    file: 'gameplay/stateMachine.js',
    demoPath: '/demo/gameplay/stateMachine-demo.html',
    summary: 'Finite State Machine with lifecycle hooks for enemy AI states and high-level game flow.',
    details: 'Organizes entity AI (`search` → `engage` → `track`) and game session flow (`playing` → `levelup` → `dialogue` → `paused` → `gameover`) into self-contained states with `enter`, `update`, and `exit` hooks.',
    mechanics: [
      'Guarantees `current.exit()` runs before switching `currentStateName` and invoking the new state\'s `enter(params)`.',
      'Throws a descriptive error if `change(name)` is called with an unregistered state name.'
    ],
    api: [
      ['new StateMachine()', 'Creates a new finite state machine instance.'],
      ['add(name, { enter, update, exit })', 'Registers a state configuration; returns `this` for chaining.'],
      ['change(name, enterParams?)', 'Transitions to `name`, firing `exit()` then `enter(enterParams)`.'],
      ['update(dt)', 'Calls `update(dt)` on the active state if defined.'],
      ['has(name) / fsm.currentStateName', 'Checks state existence or reads active state name.']
    ],
    snippet: `const fsm = new StateMachine();
fsm.add('patrol', { enter: () => console.log('Start patrol'), exit: () => console.log('Target sighted!') })
   .add('chase', { enter: (target) => console.log('Chasing', target) });
fsm.change('patrol');
fsm.change('chase', 'Player');`
  },
  {
    id: 'camera',
    category: 'gameplay',
    title: 'Camera',
    exportName: 'Camera',
    file: 'gameplay/camera.js',
    demoPath: '/demo/gameplay/camera-demo.html',
    summary: '2D viewport camera with frame-rate independent smooth follow, zoom, screen shake, and coordinate projection.',
    details: 'Centers the canvas viewport around a world target with exponential damping, trauma shake offsets, and bidirectional `screenToWorld` / `worldToScreen` transforms.',
    mechanics: [
      'Uses `1 - Math.pow(1 - lerp, dt / 16.67)` so camera smoothing behaves identically at 60Hz and 144Hz.',
      '`apply(ctx)` resets and applies zoom scaling plus camera translation and shake offsets in one call.'
    ],
    api: [
      ['new Camera(viewportWidth, viewportHeight)', 'Creates a 2D viewport camera.'],
      ['follow(target, lerp = 1, dt = 16.67)', 'Smoothly interpolates camera position to center `target`.'],
      ['shake(durationMs, intensity)', 'Triggers decaying random viewport offset shake.'],
      ['setZoom(level)', 'Sets camera zoom level (clamped to `>= 0.1`).'],
      ['screenToWorld(sx, sy, out?) / worldToScreen(wx, wy, out?)', 'Converts between canvas pixels and world coordinates.'],
      ['update(dt) / apply(ctx)', 'Steps shake timer and applies transform matrix to `CanvasRenderingContext2D`.']
    ],
    snippet: `const cam = new Camera(800, 600);
cam.setZoom(2);
cam.follow({ x: 500, y: 300 }, 1);
console.log('Center Screen in World:', cam.screenToWorld(400, 300));`
  },
  {
    id: 'abilities',
    category: 'gameplay',
    title: 'AbilityManager',
    exportName: 'AbilityManager',
    file: 'gameplay/abilities.js',
    demoPath: '/demo/gameplay/abilities-demo.html',
    summary: 'Cooldown, multi-charge, active duration, and auto-cast controller for skills and weapons.',
    details: 'Manages primary auto-fire weapons, multi-charge dashes, and AoE cooldown skills with dynamic cooldown haste scaling (`cooldownScale`).',
    mechanics: [
      'Supports multi-charge abilities (such as a 2-charge Dash) that recharge sequentially.',
      'Tracks active duration windows (`isActive`, `activeLeft`) and invokes `onEnd` when an ability effect expires.',
      'Automatically fires abilities configured with `auto: true` whenever a charge is ready.'
    ],
    api: [
      ['new AbilityManager()', 'Creates an ability cooldown and charge manager.'],
      ['register(id, { cooldown, charges, duration, auto, onUse, onEnd })', 'Registers a skill or auto-weapon.'],
      ['canUse(id) / use(id, context?, cooldownScale = 1)', 'Checks availability or consumes a charge and triggers `onUse`.'],
      ['update(dt, context?, cooldownScale = 1)', 'Steps active durations, recharges, and auto-cast skills.'],
      ['getState(id)', 'Returns `{ ready, charges, maxCharges, cooldownLeft, cooldownRatio, isActive }`.'],
      ['reset()', 'Restores all abilities to full charges and zero cooldown.']
    ],
    snippet: `const abilities = new AbilityManager();
abilities.register('dash', { cooldown: 1000, charges: 2, duration: 200, onUse: () => console.log('Dashed!') });
abilities.use('dash');
console.log('Dash State:', abilities.getState('dash'));`
  },
  {
    id: 'spawner',
    category: 'gameplay',
    title: 'WaveSpawner',
    exportName: 'WaveSpawner',
    file: 'gameplay/spawner.js',
    demoPath: '/demo/gameplay/spawner-demo.html',
    summary: 'Timed wave progression manager with weighted enemy tables and ring/perimeter spawn geometry.',
    details: 'Steps through sequential wave definitions over time, picking weighted enemy types and calculating spawn coordinates along an annulus ring or rectangular perimeter around the player.',
    mechanics: [
      'Supports `' + 'ring' + '` (`minRadius` to `maxRadius`) and `' + 'perimeter' + '` (`width` x `height` box edge) spawn distributions.',
      'Automatically advances `waveNumber` when `waveElapsed >= duration`, clamping to the final wave definition for endless survival.'
    ],
    api: [
      ['new WaveSpawner({ rng = Math.random })', 'Creates a wave spawner using the provided PRNG function.'],
      ['addWave({ duration, interval, count, shape, minRadius, maxRadius, types })', 'Appends a wave configuration.'],
      ['update(dt, centerX, centerY, onSpawn)', 'Steps timers and invokes `onSpawn({ x, y, type, wave })`.'],
      ['pointOnRing(cx, cy, minR, maxR, out?) / pointOnPerimeter(cx, cy, w, h, out?)', 'Geometric spawn point helpers.'],
      ['reset()', 'Resets wave index, timers, and spawn counters to Wave 1.']
    ],
    snippet: `const spawner = new WaveSpawner();
spawner.addWave({ duration: 10000, interval: 500, count: 3, types: [{ id: 'grunt', weight: 3 }, { id: 'tank', weight: 1 }] });
spawner.update(500, 0, 0, (s) => console.log('Spawned:', s.type, 'at', s.x.toFixed(0), s.y.toFixed(0)));`
  },
  {
    id: 'progression',
    category: 'gameplay',
    title: 'Progression',
    exportName: 'Progression',
    file: 'gameplay/progression.js',
    demoPath: '/demo/gameplay/progression-demo.html',
    summary: 'XP curve calculator, level tracker, and weighted roguelite upgrade drafter with rank caps.',
    details: 'Handles geometric + linear XP thresholds (`xpToNext * growthFactor + linearStep`), multi-level XP overflow, and weighted upgrade card drafting that automatically removes maxed-out upgrades from the pool.',
    mechanics: [
      '`addXp(amount)` loops through overflow XP so a massive boss gem can grant multiple pending level-ups at once.',
      '`rollChoices(count, rng)` samples unique non-maxed upgrades without replacement weighted by `weight`.'
    ],
    api: [
      ['new Progression({ baseXp = 10, growthFactor = 1.35, linearStep = 5 })', 'Configures the XP curve.'],
      ['registerUpgrade({ id, title, desc, tag, maxRank, weight, apply })', 'Registers a draftable upgrade definition.'],
      ['addXp(amount)', 'Adds XP and returns the number of new levels gained.'],
      ['rollChoices(count = 3, rng?)', 'Drafts up to `count` unique upgrade cards below `maxRank`.'],
      ['selectUpgrade(id, context?) / getRank(id)', 'Increments upgrade rank, decrements `pendingLevels`, and runs `apply(newRank)`.'],
      ['reset()', 'Resets level, XP, and all upgrade ranks to initial state.']
    ],
    snippet: `const prog = new Progression({ baseXp: 10 });
prog.registerUpgrade({ id: 'dmg', title: 'Damage Up', maxRank: 3, weight: 2, apply: (r) => console.log('Damage Rank:', r) });
prog.addXp(15);
const cards = prog.rollChoices(3);
console.log('Drafted Card:', cards[0].title);
prog.selectUpgrade(cards[0].id);`
  },
  {
    id: 'loot',
    category: 'gameplay',
    title: 'LootTable',
    exportName: 'LootTable',
    file: 'gameplay/loot.js',
    demoPath: '/demo/gameplay/loot-demo.html',
    summary: 'Weighted probability table for enemy drops, guaranteed boss cores, and multi-roll chests.',
    details: 'Separates drop probability (`dropChance`), guaranteed drops (`guaranteed: true`), and relative item weights with randomized `[min, max]` stack quantities.',
    mechanics: [
      'Evaluates `guaranteed` entries on every roll before checking `dropChance` for the weighted pool.',
      '`rollMultiple(rolls, rng)` executes multiple rolls and merges identical item IDs into combined stacks.'
    ],
    api: [
      ['new LootTable({ dropChance = 1.0 })', 'Creates a loot table with an overall `[0, 1]` drop probability.'],
      ['add(id, { weight = 1, min = 1, max = 1, guaranteed = false })', 'Adds an item entry to the table.'],
      ['roll(rng = Math.random)', 'Performs one roll and returns `[{ id, count }]`.'],
      ['rollMultiple(rolls = 3, rng = Math.random)', 'Performs `rolls` rolls and consolidates matching item counts.']
    ],
    snippet: `const chest = new LootTable({ dropChance: 1.0 })
  .add('boss_core', { guaranteed: true, min: 1, max: 1 })
  .add('scrap', { weight: 70, min: 10, max: 25 })
  .add('medkit', { weight: 30, min: 1, max: 2 });
console.log('Chest Drops:', chest.rollMultiple(3));`
  },
  {
    id: 'inventory',
    category: 'gameplay',
    title: 'Inventory',
    exportName: 'Inventory',
    file: 'gameplay/inventory.js',
    demoPath: '/demo/gameplay/inventory-demo.html',
    summary: 'Slot-limited inventory with automatic stack splitting, overflow reporting, and consumable callbacks.',
    details: 'Manages tactical belt slots and player backpacks by filling partial stacks first, allocating new slots up to `maxSlots`, and returning exact `{ added, overflow }` counts.',
    mechanics: [
      '`add(id, count)` tops up existing stacks below `maxStack` before occupying free slots.',
      '`use(id, context)` triggers the item\'s `onUse(context)` callback and automatically decrements the stack if `consumable: true`.'
    ],
    api: [
      ['new Inventory({ maxSlots = 12 })', 'Creates a slot-bounded inventory container.'],
      ['defineItem(id, { name, maxStack = 99, consumable = true, onUse })', 'Registers item stack rules and use handler.'],
      ['add(id, count = 1)', 'Adds items and returns `{ added, overflow }`.'],
      ['remove(id, count = 1) / use(id, context?)', 'Removes items or triggers consumable effect.'],
      ['count(id) / has(id, minCount = 1) / clear()', 'Queries total count across slots or empties inventory.']
    ],
    snippet: `const inv = new Inventory({ maxSlots: 2 });
inv.defineItem('medkit', { name: 'Medkit', maxStack: 3, consumable: true, onUse: () => console.log('Healed +50 HP!') });
console.log('Add 5 Medkits:', inv.add('medkit', 5));
inv.use('medkit');
console.log('Remaining Medkits:', inv.count('medkit'));`
  },
  {
    id: 'statusEffects',
    category: 'gameplay',
    title: 'StatusEffectManager',
    exportName: 'StatusEffectManager',
    file: 'gameplay/statusEffects.js',
    demoPath: '/demo/gameplay/statusEffects-demo.html',
    summary: 'Elemental buff/debuff, stacking DoT/HoT tick, and crowd-control (`stun`, `root`, `silence`) manager.',
    details: 'Tracks per-entity status effects (`burn`, `chill`, `stun`, `overcharge`), automatically synchronizing stackable stat modifiers with `Stats` and cleaning up expired effects.',
    mechanics: [
      'Supports `stackMode: "refresh"` (resets timer on new stack) and `"extend"` (adds duration) up to `maxStacks`.',
      'Automatically syncs and removes `status_<id>` modifiers on the target entity\'s `Stats` instance.',
      'Provides fast crowd-control queries: `isStunned(entity)`, `isRooted(entity)`, and `isSilenced(entity)`.'
    ],
    api: [
      ['new StatusEffectManager()', 'Creates a centralized status effect manager.'],
      ['define(id, { duration, maxStacks, stackMode, tickInterval, stat, modType, value, control, onTick })', 'Defines a status effect archetype.'],
      ['apply(entity, id, { duration?, stacks = 1, source? })', 'Applies or stacks an effect on `entity`.'],
      ['remove(entity, id) / clearEntity(entity) / clearAll()', 'Cleanses one effect, one entity, or all entities.'],
      ['isStunned(e) / isRooted(e) / isSilenced(e)', 'Queries active crowd-control locks on `e`.'],
      ['getEffects(entity, out = []) / update(dt)', 'Lists active effects for UI rendering and steps timers/ticks.']
    ],
    snippet: `const statuses = new StatusEffectManager();
const mob = { stats: new Stats({ maxHealth: 100, speed: 200 }) };
statuses.define('chill', { duration: 2000, maxStacks: 3, stat: 'speed', modType: 'percent', value: -0.25 });
statuses.apply(mob, 'chill', { stacks: 2 });
console.log('Chilled Speed:', mob.stats.get('speed'), '| Stacks:', statuses.getStacks(mob, 'chill'));`
  },
  {
    id: 'weapons',
    category: 'gameplay',
    title: 'WeaponSystem',
    exportName: 'WeaponSystem',
    file: 'gameplay/weapons.js',
    demoPath: '/demo/gameplay/weapons-demo.html',
    summary: 'Pooled projectile patterns (`linear`, `spread`, `ricochet`, `boomerang`, `homing`), orbiters, and hazard zones.',
    details: 'Unifies swarm combat weapon archetypes with built-in `Pool` recycling and `SpatialHash` broad-phase collision queries.',
    mechanics: [
      'Supports spread cones, 360° novas, chain-ricochet bouncing to the nearest unhit target, returning boomerangs, and turn-rate homing seekers.',
      'Manages rotating guardian orbiter blades with per-target hit cooldowns (`hitCooldown`).',
      'Spawns ticking ground hazard zones (`spawnZone`) that query `SpatialHash` on each tick.'
    ],
    api: [
      ['new WeaponSystem({ maxProjectiles = 800, maxZones = 50 })', 'Creates pooled projectile, orbiter, and zone controllers.'],
      ['fire(x, y, aimAngle, config)', 'Fires `count` projectiles with `spread` and `behavior` (`linear|ricochet|boomerang|homing`).'],
      ['setOrbiters(owner, { count, radius, speed, damage, hitCooldown })', 'Attaches rotating orbiter hitboxes around `owner`.'],
      ['spawnZone(x, y, { r, duration, tickInterval, onTick })', 'Spawns a lingering AoE ground hazard zone.'],
      ['update(dt, { spatialHash, player, tilemap, onHit }) / render(ctx)', 'Steps trajectories/collisions and renders all active weapons.']
    ],
    snippet: `const weapons = new WeaponSystem();
weapons.fire(0, 0, 0, { count: 5, spread: 0.5, behavior: 'ricochet', bounces: 3 });
console.log('Active Projectiles:', weapons.activeProjectileCount);`
  },

  // AI (4)
  {
    id: 'steering',
    category: 'ai',
    title: 'Steering Behaviors',
    exportName: 'steering',
    file: 'ai/steering.js',
    demoPath: '/demo/ai/steering-demo.html',
    summary: 'Craig Reynolds autonomous agent steering forces (`seek`, `flee`, `arrive`, `orbit`, `wander`, `separate`, `flock`).',
    details: 'Computes desired velocity steering forces for smooth, organic agent movement and crowd separation without rigid grid snapping.',
    mechanics: [
      '`flee()` accelerates away inside `panicRadius` and smoothly brakes the agent to a stop once at a safe distance.',
      '`orbit()` maintains a strafing circle at `radius` around the player for ranged enemies.',
      '`separate()` and `flock()` prevent swarm agents from stacking on top of the same pixel.'
    ],
    api: [
      ['seek(agent, target, maxSpeed, out?)', 'Steers directly toward `target` at `maxSpeed`.'],
      ['flee(agent, threat, maxSpeed, panicRadius = 160, out?)', 'Flees inside `panicRadius` and brakes outside it.'],
      ['arrive(agent, target, maxSpeed, slowRadius = 100, out?)', 'Decelerates smoothly inside `slowRadius`.'],
      ['pursue(agent, target, maxSpeed, maxPrediction = 0.5, out?)', 'Intercepts moving `target` based on velocity look-ahead.'],
      ['orbit(agent, target, radius, maxSpeed, clockwise, out?)', 'Strafes tangentially around `target` at `radius`.'],
      ['wander(agent, maxSpeed, { distance, radius, jitter }, out?)', 'Smooth random patrolling force.'],
      ['separate(agent, neighbors, desiredSeparation, maxSpeed, out?)', 'Repels nearby agents within `desiredSeparation`.'],
      ['applyForce(agent, force, maxForce, maxSpeed, dt)', 'Clamps force/speed and integrates velocity and position.']
    ],
    snippet: `const agent = { x: 40, y: 0, vx: 0, vy: 0 };
const threat = { x: 0, y: 0 };
const force = steering.flee(agent, threat, 200, 150);
steering.applyForce(agent, force, 500, 200, 16.67);
console.log('Agent Velocity after Flee step:', agent.vx.toFixed(2), agent.vy.toFixed(2));`
  },
  {
    id: 'flowField',
    category: 'ai',
    title: 'FlowField',
    exportName: 'FlowField',
    file: 'ai/flowField.js',
    demoPath: '/demo/ai/flowField-demo.html',
    summary: 'Dijkstra / BFS vector grid enabling thousands of enemies to pathfind around walls in O(1) per agent.',
    details: 'Instead of running A* for every individual enemy, `FlowField.compute(targetX, targetY)` builds a single wavefront distance grid and normalized direction vectors across the map whenever the player changes cells.',
    mechanics: [
      'Uses preallocated `Uint8Array`, `Int32Array`, and `Float32Array` buffers for zero-allocation BFS integration.',
      'Prevents diagonal corner-cutting past solid wall corners when computing 8-way flow vectors.',
      'Snaps the seed cell to the nearest open tile if the player is hugging an inflated wall.'
    ],
    api: [
      ['new FlowField({ cols, rows, cellSize, originX = 0, originY = 0 })', 'Allocates typed arrays for the flow grid.'],
      ['setWall(col, row, blocked) / setObstacleRect(x, y, w, h, inflate)', 'Marks grid cells as impassable walls.'],
      ['compute(targetX, targetY)', 'Runs BFS integration and computes normalized `(dirX, dirY)` vectors.'],
      ['sample(worldX, worldY, out?)', 'Returns the O(1) normalized steering vector `{ x, y }` at world position.'],
      ['getDistance(worldX, worldY)', 'Returns the BFS step distance to the target cell (`-1` if unreachable).']
    ],
    snippet: `const field = new FlowField({ cols: 10, rows: 10, cellSize: 20 });
field.setObstacleRect(80, 20, 20, 120);
field.compute(160, 80);
console.log('Flow Direction at (40, 80):', field.sample(40, 80));`
  },
  {
    id: 'lineOfSight',
    category: 'ai',
    title: 'Line of Sight & Vision',
    exportName: 'lineOfSight',
    file: 'ai/lineOfSight.js',
    demoPath: '/demo/ai/lineOfSight-demo.html',
    summary: 'Slab/quadratic raycasting, field-of-view cone filtering, and 2D visibility polygon generation.',
    details: 'Powers both AI optical sensors (`hasLineOfSight`, `inVisionCone`) and player fog-of-war rendering (`castVisionPolygon`) against mixed AABB box and circle obstacles.',
    mechanics: [
      'Uses branch-minimal slab intersection (`rayBox`) and quadratic discriminant tests (`rayCircle`).',
      '`filterVisible()` culls targets by distance squared and FOV dot-product before running obstacle raycasts.',
      '`castVisionPolygon()` casts a fan of rays to build a clip path for 2D lighting or fog of war.'
    ],
    api: [
      ['hasLineOfSight(a, b, obstacles)', 'Returns `true` if segment `a -> b` does not intersect any obstacle.'],
      ['raycast(x1, y1, x2, y2, obstacles, out?)', 'Finds the closest obstacle hit `{ t, x, y, nx, ny, obstacle }` or `null`.'],
      ['inVisionCone(observer, facingAngle, target, maxRange, fovAngle, obstacles?)', 'Checks range, FOV cone angle, and wall occlusion.'],
      ['filterVisible(observer, facingAngle, targets, maxRange, fovAngle, obstacles, out?)', 'Filters `targets` array to visible entities.'],
      ['castVisionPolygon(origin, facingAngle, fovAngle, maxRange, rayCount, obstacles, out?)', 'Computes visibility polygon vertices.']
    ],
    snippet: `const walls = [{ x: 100, y: 0, w: 20, h: 200 }];
console.log('Through wall:', lineOfSight.hasLineOfSight({ x: 50, y: 80 }, { x: 150, y: 80 }, walls));
console.log('Clear sight:', lineOfSight.hasLineOfSight({ x: 50, y: 80 }, { x: 80, y: 80 }, walls));`
  },
  {
    id: 'director',
    category: 'ai',
    title: 'SwarmDirector',
    exportName: 'SwarmDirector',
    file: 'ai/director.js',
    demoPath: '/demo/ai/director-demo.html',
    summary: 'Adaptive intensity pacing director (`buildup`, `peak`, `breather`) and 360° surround slot coordinator.',
    details: 'Monitors active crowd density and player damage stress to alternate between high-intensity peak surges and loot-collection breathers while assigning concentric angular slots around the player so melee enemies encircle instead of conga-lining.',
    mechanics: [
      'Cycles through `buildup` → `peak` → `breather` phases, earning and spending spawn credits on weighted enemy rosters.',
      '`assignSlot(agent, targetX, targetY, out)` claims the nearest free angular slot across concentric rings (`46px`, `105px`, `170px`).'
    ],
    api: [
      ['new SwarmDirector({ rng, maxActive, baseCreditRate, rings, ... })', 'Creates an adaptive director and surround slot coordinator.'],
      ['registerEnemy(id, { cost, weight, minWave, elite })', 'Adds an enemy archetype to the director\'s credit roster.'],
      ['update(dt, { playerX, playerY, activeCount, minRadius, maxRadius, onSpawn })', 'Steps phase state machine and spends spawn credits.'],
      ['assignSlot(agent, targetX, targetY, out?)', 'Assigns the closest unoccupied 360° surround ring coordinate.'],
      ['recordPlayerDamage(amount) / recordKill()', 'Adjusts `damageStress` and `intensity` metrics.']
    ],
    snippet: `const director = new SwarmDirector();
director.registerEnemy('grunt', { cost: 1, weight: 4 }).registerEnemy('tank', { cost: 5, weight: 1, elite: true });
const slot = director.assignSlot({ x: 200, y: 100 }, 100, 100);
console.log('Assigned Surround Slot:', slot);`
  },

  // WORLD (3)
  {
    id: 'tilemap',
    category: 'world',
    title: 'Tilemap',
    exportName: 'Tilemap',
    file: 'world/tilemap.js',
    demoPath: '/demo/world/tilemap-demo.html',
    summary: '2D Uint8Array tile grid with O(1) circle-wall collision resolution and greedy wall-rect extraction.',
    details: 'Stores world tile IDs in a flat `Uint8Array`, resolving circle collisions against neighboring solid tiles in $O(1)$ time and merging contiguous wall tiles into minimal AABB rectangles for raycasting.',
    mechanics: [
      '`collideCircle(circle, out)` inspects only the $3 \\times 3$ tile neighborhood overlapping the entity.',
      '`extractWallRects(out)` runs a 2D greedy meshing pass to reduce hundreds of solid tiles into a few dozen AABB boxes for `lineOfSight`.'
    ],
    api: [
      ['new Tilemap({ cols, rows, tileSize, originX = 0, originY = 0, solidIds = [1] })', 'Creates a 2D tilemap grid.'],
      ['get(col, row) / set(col, row, id) / loadGrid(uint8Array)', 'Reads, writes, or bulk-loads tile IDs.'],
      ['isSolid(col, row) / isSolidAtWorld(wx, wy)', 'Checks if a tile or world coordinate is solid.'],
      ['collideCircle(circle, out?)', 'Pushes `circle` out of solid tiles and returns `{ hit, nx, ny, depth }`.'],
      ['forEachVisible(viewX, viewY, viewW, viewH, fn)', 'Iterates only over tiles inside the camera viewport.'],
      ['extractWallRects(out = [])', 'Merges contiguous solid tiles into minimal `{ x, y, w, h }` rectangles.']
    ],
    snippet: `const map = new Tilemap({ cols: 16, rows: 16, tileSize: 32 });
for (let c = 2; c < 10; c++) map.set(c, 5, 1);
const merged = map.extractWallRects();
console.log('8 contiguous wall tiles merged into:', merged);`
  },
  {
    id: 'tilemapRenderer',
    category: 'world',
    title: 'TilemapRenderer',
    exportName: 'TilemapRenderer',
    file: 'world/tilemapRenderer.js',
    demoPath: '/demo/world/tilemapRenderer-demo.html',
    summary: 'Chunked offscreen canvas cache for fast viewport blitting and localized dirty-tile rebuilds.',
    details: 'Splits a `Tilemap` into $16 \\times 16$ tile offscreen canvas chunks so rendering thousands of tiles takes only 4–9 `ctx.drawImage()` calls per frame instead of thousands of `fillRect()` calls.',
    mechanics: [
      '`invalidateTile(col, row)` marks only the affected chunk (plus neighbor chunk if on a seam) dirty when a Breach Bomb destroys a wall.',
      'Automatically draws unified outer wall borders between solid and floor tiles.'
    ],
    api: [
      ['new TilemapRenderer(tilemap, { chunkSize = 16, ... })', 'Partitions `tilemap` into offscreen chunk caches.'],
      ['invalidateAll()', 'Marks all chunks dirty (call after `tilemap.loadGrid()`).'],
      ['invalidateTile(col, row)', 'Marks only the chunk containing `(col, row)` dirty for single-tile edits.'],
      ['render(ctx, viewX, viewY, viewW, viewH)', 'Rebuilds dirty visible chunks and blits them to `ctx`.']
    ],
    snippet: `const map = new Tilemap({ cols: 64, rows: 64, tileSize: 32 });
const renderer = new TilemapRenderer(map, { chunkSize: 16 });
console.log('Total 16x16 Chunks for 4,096 tiles:', renderer.totalChunks);`
  },
  {
    id: 'procgen',
    category: 'world',
    title: 'Procedural Generation',
    exportName: 'procgen',
    file: 'world/procgen.js',
    demoPath: '/demo/world/procgen-demo.html',
    summary: 'Seeded map generators for Cellular Automata caves, room-and-corridor dungeons, and pillar arenas.',
    details: 'Generates playable `Uint8Array` tile grids with guaranteed walkable player spawn coordinates and automatic flood-fill pruning of unreachable cave pockets.',
    mechanics: [
      '`cellularAutomata()` runs smoothing generations and flood-fills (`_keepLargestCavern`) so the player or enemies can never get trapped in isolated pockets.',
      '`dungeonRooms()` carves non-overlapping rooms connected by L-shaped corridors of configurable width.',
      '`arenaPillars()` generates spaced tactical cover pillars with a guaranteed clear center drop zone.'
    ],
    api: [
      ['cellularAutomata({ cols, rows, fillChance, steps, ensureConnected, rng })', 'Generates connected organic cave networks.'],
      ['dungeonRooms({ cols, rows, roomCount, minSize, maxSize, corridorWidth, rng })', 'Generates rooms linked by corridors.'],
      ['arenaPillars({ cols, rows, pillarCount, minSize, maxSize, clearCenterRadius, rng })', 'Generates tactical pillar arenas.'],
      ['findOpenTile(grid, cols, rows)', 'Finds the walkable tile (`0`) closest to the map center.']
    ],
    snippet: `const rng = new Random('sector-39');
const cave = procgen.cellularAutomata({ cols: 30, rows: 30, rng: () => rng.next() });
console.log('Generated 30x30 Cave | Walkable Spawn Tile:', cave.spawn);`
  },

  // UI (4)
  {
    id: 'particles',
    category: 'ui',
    title: 'ParticleSystem',
    exportName: 'ParticleSystem',
    file: 'ui/particles.js',
    demoPath: '/demo/ui/particles-demo.html',
    summary: 'Zero-allocation 2D particle emitter with internal free-list recycling, drag, gravity, and glow.',
    details: 'Renders hit sparks, thruster cones, and death explosions using an internal `freeList` object pool and swap-and-pop removal so particle bursts never allocate heap memory.',
    mechanics: [
      'Uses swap-and-pop (`this.active[i] = this.active.pop()`) when particles expire for $O(1)$ removal.',
      'Supports directional cones (`angle`, `spread`), frame-rate independent velocity drag, gravity, and optional canvas shadow glow.'
    ],
    api: [
      ['new ParticleSystem({ maxParticles = 1200, preallocate = 200, rng })', 'Creates a preallocated particle system.'],
      ['emit(x, y, { count, color, speedMin, speedMax, angle, spread, drag, gravity, glow })', 'Spawns a particle burst at `(x, y)`.'],
      ['update(dt) / render(ctx) / clear()', 'Steps physics, renders particles with alpha fade, or recycles all active particles.'],
      ['fx.activeCount / fx.pooledCount', 'Inspects active and pooled free-list counts.']
    ],
    snippet: `const fx = new ParticleSystem({ maxParticles: 500, preallocate: 50 });
fx.emit(100, 100, { count: 12, color: '#d9b978', speedMin: 50, speedMax: 180 });
console.log('Active Particles:', fx.activeCount, '| Pooled FreeList:', fx.pooledCount);`
  },
  {
    id: 'floatingText',
    category: 'ui',
    title: 'FloatingTextSystem',
    exportName: 'FloatingTextSystem',
    file: 'ui/floatingText.js',
    demoPath: '/demo/ui/floatingText-demo.html',
    summary: 'Pooled world-space floating damage numbers, critical hit callouts, and status text popups.',
    details: 'Displays rising, fading combat telemetry (`-25`, `+50 HP`, `OVERCHARGE!`) in world coordinates using a preallocated `freeList` pool.',
    mechanics: [
      'Applies horizontal `jitterX` so simultaneous shotgun/AoE damage numbers do not overlap illegibly.',
      'Recycles expired popups via $O(1)$ swap-and-pop into `freeList`.'
    ],
    api: [
      ['new FloatingTextSystem({ maxItems = 300, preallocate = 60, rng })', 'Creates a pooled floating text renderer.'],
      ['spawn(x, y, text, { color, strokeColor, vy, vx, duration, fontSize, jitterX })', 'Spawns a world-space text popup.'],
      ['update(dt) / render(ctx) / clear()', 'Steps upward drift, renders outlined text with fade, or clears popups.']
    ],
    snippet: `const fct = new FloatingTextSystem();
fct.spawn(200, 150, '-95 CRIT!', { color: '#d9b978', fontSize: 14 });
console.log('Active Popups:', fct.activeCount);`
  },
  {
    id: 'devConsole',
    category: 'ui',
    title: 'DevConsole & Profiler',
    exportName: 'DevConsole',
    file: 'ui/devConsole.js',
    demoPath: '/demo/ui/devConsole-demo.html',
    summary: 'In-game CLI drawer (`~`), custom command runner, live watcher HUD, and 60Hz frame-time sparkline.',
    details: 'Provides an interactive developer console drawer toggled with Backquote (`~`), command history (`ArrowUp`/`ArrowDown`), a ring-buffer frame-time profiler, and world-space `SpatialHash` / hitbox visualizers.',
    mechanics: [
      'Includes built-in commands: `help`, `clear`, `profiler [on|off]`, `grid [on|off]`, and `hitboxes [on|off]`.',
      '`renderOverlay(ctx)` draws a screen-space FPS & frame-time sparkline with a `16.67ms` (60Hz) budget line.',
      '`renderSpatialDebug(ctx, { spatialHash, entities, obstacles })` overlays active spatial cells and collision circles.'
    ],
    api: [
      ['new DevConsole({ toggleKey = "Backquote", sampleCount = 90, mountElement })', 'Creates console drawer and profiler.'],
      ['registerCommand(name, handler, help)', 'Registers a custom CLI command `(args, context) => output`.'],
      ['watch(label, getterFn)', 'Pins a live telemetry metric to the profiler HUD and console header.'],
      ['execute(rawLine, context) / toggle(forceState?)', 'Executes a command string or toggles the console drawer.'],
      ['beginFrame() / endFrame() / renderOverlay(ctx) / renderSpatialDebug(ctx, opts)', 'Frame timing hooks and canvas debug renderers.']
    ],
    snippet: `const dev = new DevConsole({ mountElement: null });
dev.registerCommand('spawn', ([type, n]) => \`Spawned \${n || 1}x \${type}\`, 'spawn <type> <count>');
console.log(dev.execute('spawn tank 5'));`
  },
  {
    id: 'dialogue',
    category: 'ui',
    title: 'DialogueSystem',
    exportName: 'DialogueSystem',
    file: 'ui/dialogue.js',
    demoPath: '/demo/ui/dialogue-demo.html',
    summary: 'Branching dialogue graph with conditional choices, action callbacks, and non-blocking combat radio barks.',
    details: 'Handles interactive shrine/NPC encounters (`start`, `choose`, `advance`) with typewriter text reveal alongside a non-blocking `bark()` queue for real-time boss and HQ transmissions during combat.',
    mechanics: [
      'Choice nodes filter options dynamically via `condition: (context) => boolean` and mutate state via `action: (context) => void`.',
      '`bark(speaker, text, { duration, color })` queues tactical banners rendered via `renderBarkBanner(ctx)` without pausing gameplay.'
    ],
    api: [
      ['new DialogueSystem({ charsPerSecond = 45, onNodeEnter, onEnd })', 'Creates a dialogue and bark controller.'],
      ['addNode(id, { speaker, text, next, choices, onEnter })', 'Registers a dialogue node and conditional choices.'],
      ['start(nodeId, context) / advance() / choose(index) / close()', 'Controls interactive dialogue flow.'],
      ['bark(speaker, text, { duration, color }) / renderBarkBanner(ctx, width, y)', 'Queues and renders non-blocking combat comms.'],
      ['update(dt) / getState()', 'Advances typewriter reveal and returns current node state.']
    ],
    snippet: `const dlg = new DialogueSystem();
const hero = { hp: 80, dmgBonus: 0 };
dlg.addNode('shrine', {
  speaker: 'OBELISK',
  text: 'Sacrifice 30 HP for +25% Damage?',
  choices: [{ label: 'Accept', condition: (p) => p.hp > 30, action: (p) => { p.hp -= 30; p.dmgBonus += 25; } }]
});
dlg.start('shrine', hero);
dlg.choose(0);
console.log('Hero after Shrine choice:', hero);`
  }
];

function enhanceModuleDemoPage() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const path = window.location.pathname;
  const currentIdx = MODULE_CATALOG.findIndex((m) => path.endsWith(m.demoPath));
  if (currentIdx === -1) return;

  const mod = MODULE_CATALOG[currentIdx];
  const prevMod = MODULE_CATALOG[(currentIdx - 1 + MODULE_CATALOG.length) % MODULE_CATALOG.length];
  const nextMod = MODULE_CATALOG[(currentIdx + 1) % MODULE_CATALOG.length];
  const catMeta = CATEGORY_META[mod.category];

  document.body.classList.add('gk-doc-page');

  const backLink = document.querySelector('body > a[href="/"]');
  if (backLink) backLink.remove();

  const existingNodes = Array.from(document.body.childNodes).filter(
    (n) => !(n.nodeType === 1 && n.tagName === 'SCRIPT')
  );

  const topbar = document.createElement('header');
  topbar.className = 'gk-topbar';
  topbar.innerHTML = `
    <div class="gk-topbar-inner">
      <a href="/" class="gk-brand">GameKit <span>v0.2.0</span></a>
      <nav class="gk-pill-nav">
        <a href="/" class="active">← All Modules</a>
        <a href="/demo/showcase/swarm-demo.html">32-Module Swarm Showcase</a>
        <a href="/about.html">About Me</a>
      </nav>
    </div>
  `;

  const main = document.createElement('main');
  main.className = 'gk-container gk-fade-in';

  const header = document.createElement('section');
  header.className = 'gk-module-header';
  const filename = mod.file.split('/').pop();
  header.innerHTML = `
    <div class="gk-module-title-block">
      <div class="gk-module-badges">
        <span class="gk-badge-cat">${catMeta.label}</span>
        <code class="gk-badge-file">${mod.file}</code>
        <code class="gk-badge-file">import { ${mod.exportName} }</code>
      </div>
      <h1>${mod.title}</h1>
      <p>${mod.summary}</p>
    </div>
    <div class="gk-pager">
      <button type="button" class="gk-download-btn" id="gkDownloadModuleBtn" title="Download standalone ${mod.file}">
        ↓ Download ${filename}
      </button>
      <a href="${prevMod.demoPath}" title="Previous: ${prevMod.title}">← ${prevMod.title}</a>
      <a href="${nextMod.demoPath}" title="Next: ${nextMod.title}">${nextMod.title} →</a>
    </div>
  `;

  header.querySelector('#gkDownloadModuleBtn').addEventListener('click', () => {
    downloadModuleFile(mod.file);
  });

  const sandboxBox = document.createElement('section');
  sandboxBox.className = 'gk-box gk-sandbox-stage';
  existingNodes.forEach((node) => sandboxBox.appendChild(node));

  const detailsGrid = document.createElement('div');
  detailsGrid.className = 'gk-detail-grid';
  detailsGrid.innerHTML = `
    <section class="gk-box" style="margin-bottom:0;">
      <h2>Architecture &amp; Why It Exists</h2>
      <p style="color:var(--muted); font-size:0.9rem; margin:0;">${mod.details}</p>
    </section>
    <section class="gk-box" style="margin-bottom:0;">
      <h2>Key Mechanics &amp; Guarantees</h2>
      <ul class="gk-detail-list">
        ${mod.mechanics.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </section>
  `;

  const apiBox = document.createElement('section');
  apiBox.className = 'gk-box';
  apiBox.innerHTML = `
    <h2>Verified API Reference (<code>${mod.file}</code>)</h2>
    <table class="gk-api-table">
      <thead>
        <tr>
          <th style="width:44%;">Method / Signature</th>
          <th>Behavior</th>
        </tr>
      </thead>
      <tbody>
        ${mod.api.map(([sig, desc]) => `
          <tr>
            <td><code>${sig}</code></td>
            <td>${desc}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const editorBox = document.createElement('section');
  editorBox.className = 'gk-box';
  editorBox.innerHTML = `
    <h2>Interactive Code Sandbox</h2>
    <p style="color:var(--muted); font-size:0.86rem; margin:0 0 0.75rem;">
      Edit and run live JavaScript against <code>${mod.title}</code> and all other GameKit exports.
    </p>
    <div id="gk-module-editor-mount"></div>
  `;

  main.appendChild(header);
  main.appendChild(sandboxBox);
  main.appendChild(detailsGrid);
  main.appendChild(apiBox);
  main.appendChild(editorBox);

  document.body.prepend(main);
  document.body.prepend(topbar);

  new CodeEditor(editorBox.querySelector('#gk-module-editor-mount'), {
    title: `${mod.title} Live Runner`,
    tag: mod.file,
    code: mod.snippet,
    autoRun: true
  });
}

export async function downloadModuleFile(filePath) {
  const filename = filePath.split('/').pop();
  try {
    // Load raw untransformed file source in Vite
    const rawMod = await import(/* @vite-ignore */ `/${filePath}?raw`);
    const blob = new Blob([rawMod.default], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // Fallback direct link download
    const a = document.createElement('a');
    a.href = `/${filePath}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

enhanceModuleDemoPage();