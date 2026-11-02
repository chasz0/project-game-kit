import { describe, it, expect, vi } from 'vitest';
import { TimerManager } from '@core/timer.js';
import { EventEmitter } from '@core/events.js';
import { Random } from '@core/random.js';
import { StorageManager } from '@core/storage.js';
import { InputManager } from '@core/input.js';
import { Pool } from '@gameplay/pool.js';
import { SpatialHash } from '@gameplay/spatialHash.js';
import { Stats } from '@gameplay/stats.js';
import { WeaponSystem } from '@gameplay/weapons.js';
import { WaveSpawner } from '@gameplay/spawner.js';
import { Progression } from '@gameplay/progression.js';
import { Inventory } from '@gameplay/inventory.js';
import { LootTable } from '@gameplay/loot.js';
import { StatusEffectManager } from '@gameplay/statusEffects.js';
import { Camera } from '@gameplay/camera.js';
import { SwarmDirector } from '@ai/director.js';
import { lineOfSight } from '@ai/lineOfSight.js';
import { steering } from '@ai/steering.js';
import { Tilemap } from '@world/tilemap.js';
import { TilemapRenderer } from '@world/tilemapRenderer.js';
import { procgen } from '@world/procgen.js';
import { DialogueSystem } from '@ui/dialogue.js';
import { DevConsole } from '@ui/devConsole.js';

describe('F-01 TimerManager', () => {
  it('survives clear() called from inside a callback', () => {
    const t = new TimerManager();
    t.every(1000, () => {});
    t.add(10, () => t.clear());
    t.update(10);
    expect(t.timers.length).toBe(0);
    expect(() => t.update(10)).not.toThrow();
  });

  it('timers added inside a callback run on a later update', () => {
    const t = new TimerManager();
    const log = [];
    t.add(10, () => {
      log.push('a');
      t.add(10, () => log.push('b'));
    });
    t.update(10);
    expect(log).toEqual(['a']);
    t.update(10);
    expect(log).toEqual(['a', 'b']);
  });
});

describe('F-02 SpatialHash', () => {
  it('rejects non-finite and gigantic clients without hanging or losing entities', () => {
    const g = new SpatialHash(64);
    expect(() => g.insert({ x: Infinity, y: 0, r: 5 })).toThrow(RangeError);
    expect(() => g.insert({ x: NaN, y: 0, r: 5 })).toThrow(RangeError);
    expect(() => g.insert({ x: 0, y: 0, w: 64 * 3000, h: 64 * 3000 })).toThrow(RangeError);
    expect(g.size).toBe(0);
    expect(g.query(Infinity, 0, 10, 10)).toEqual([]);
  });
});

describe('F-03 Pool', () => {
  it('inUse never goes negative on double release at the idle cap', () => {
    const p = new Pool({ create: () => ({}), maxSize: 1 });
    const a = p.get();
    const b = p.get();
    p.release(a);
    p.release(b);
    p.release(b);
    expect(p.inUse).toBe(0);
  });
});

describe('F-04 Stats', () => {
  it('percent multiplier never drops below zero', () => {
    const s = new Stats({ maxHealth: 10, speed: 100 });
    s.addModifier('a', 'speed', 'percent', -0.6);
    s.addModifier('b', 'speed', 'percent', -0.6);
    expect(s.get('speed')).toBeGreaterThanOrEqual(0);
  });
});

describe('F-05 Dialogue', () => {
  it('choose(i) runs the choice that was displayed at index i', () => {
    const d = new DialogueSystem();
    let hp = 100;
    let ran = null;
    d.addNode('n', {
      text: 'x',
      choices: [
        { label: 'A', condition: () => hp > 50, action: () => { ran = 'A'; } },
        { label: 'B', action: () => { ran = 'B'; } }
      ]
    });
    d.start('n');
    expect(d.getState().choices[0].label).toBe('A');
    hp = 10;
    d.choose(0);
    expect(ran).toBe('A');
  });
});

describe('F-06 WeaponSystem caps', () => {
  it('never exceeds maxProjectiles or maxZones', () => {
    const w = new WeaponSystem({ maxProjectiles: 50, maxZones: 5 });
    for (let i = 0; i < 500; i++) w.fire(0, 0, 0, {});
    for (let i = 0; i < 40; i++) w.spawnZone(0, 0, {});
    expect(w.activeProjectileCount).toBeLessThanOrEqual(50);
    expect(w.activeZoneCount).toBeLessThanOrEqual(5);
  });
});

describe('F-07 Progression', () => {
  it.each([Infinity, -Infinity, NaN])('addXp(%s) is a no-op', (v) => {
    const p = new Progression();
    expect(p.addXp(v)).toBe(0);
    expect(Number.isFinite(p.xp)).toBe(true);
    expect(p.level).toBe(1);
  });
});

describe('F-08 WaveSpawner', () => {
  it('rejects duration <= 0 and empty type lists', () => {
    const s = new WaveSpawner();
    expect(() => s.addWave({ duration: 0 })).toThrow(RangeError);
    expect(() => s.addWave({ types: [] })).toThrow(RangeError);
  });

  it('a huge dt cannot burst-spawn thousands of enemies', () => {
    const s = new WaveSpawner({ rng: () => 0.5 });
    s.addWave({ interval: 100, count: 5 });
    let n = 0;
    s.update(60000, 0, 0, () => n++);
    expect(n).toBeLessThanOrEqual(5 * 3);
  });

  it('announces wave changes', () => {
    const seen = [];
    const s = new WaveSpawner({ onWaveChange: (n) => seen.push(n) });
    s.addWave({ duration: 100 });
    s.update(100);
    expect(seen).toEqual([2]);
  });
});

describe('F-09 SwarmDirector', () => {
  it('keeps an enemy in its slot when iteration order changes', () => {
    const d = new SwarmDirector({ rng: () => 0.5 });
    const a = { x: 300, y: 0 };
    const b = { x: 300, y: 5 };
    d.update(16, {});
    const a1 = d.assignSlot(a, 0, 0).slotIndex;
    const b1 = d.assignSlot(b, 0, 0).slotIndex;
    d.update(16, {});
    const b2 = d.assignSlot(b, 0, 0).slotIndex;
    const a2 = d.assignSlot(a, 0, 0).slotIndex;
    expect([a2, b2]).toEqual([a1, b1]);
  });

  it('update() return value counts peak-entry spawns', () => {
    const d = new SwarmDirector({ rng: () => 0.5 });
    d.registerEnemy('a', { cost: 1 });
    d.credits = 50;
    d.phaseTimer = d.buildupDuration - 1;
    let fired = 0;
    const ret = d.update(2, { onSpawn: () => fired++ });
    expect(ret).toBe(fired);
  });
});

describe('F-10 procgen', () => {
  it('dungeonRooms never writes outside the grid for small sizes', () => {
    for (const [cols, rows] of [[8, 8], [10, 10], [12, 9], [20, 20]]) {
      const r = procgen.dungeonRooms({ cols, rows, minSize: 8, maxSize: 10, roomCount: 3, rng: () => 0.99 });
      for (let y = 0; y < rows; y++) {
        expect(r.grid[y * cols]).toBe(1);
        expect(r.grid[y * cols + cols - 1]).toBe(1);
      }
    }
  });

  it('cellularAutomata returns null spawn when no open tile exists', () => {
    const r = procgen.cellularAutomata({ cols: 12, rows: 12, fillChance: 1 });
    expect(r.spawn).toBeNull();
  });
});

describe('F-11 Tilemap', () => {
  it('rejects ids outside 0..255 and returns solid id for out-of-bounds get()', () => {
    const m = new Tilemap({ cols: 4, rows: 4, solidIds: [2] });
    expect(() => m.set(1, 1, 256)).toThrow(RangeError);
    expect(m.get(-1, 0)).toBe(2);
  });
});

describe('F-12 Camera', () => {
  it('a weaker shake does not cancel a stronger one in progress', () => {
    const c = new Camera(800, 600);
    c.shake(500, 20);
    c.shake(500, 2);
    expect(c.shakeIntensity).toBe(20);
  });
});

describe('F-13 EventEmitter', () => {
  it('runs every listener even if an earlier listener throws', () => {
    const e = new EventEmitter();
    let ran = false;
    e.on('x', () => { throw new Error('boom'); });
    e.on('x', () => { ran = true; });
    expect(() => e.emit('x')).toThrow('boom');
    expect(ran).toBe(true);
  });
});

describe('F-14 & R-17 Inventory', () => {
  it('floors fractional counts and allows onUse to veto consumption by returning false', () => {
    let allowUse = false;
    const inv = new Inventory({ maxSlots: 2 });
    inv.defineItem('med', { consumable: true, onUse: () => allowUse });

    const res = inv.add('med', 2.7);
    expect(res).toEqual({ added: 2, overflow: 0 });
    expect(inv.count('med')).toBe(2);

    expect(inv.use('med')).toBe(false);
    expect(inv.count('med')).toBe(2);

    allowUse = true;
    expect(inv.use('med')).toBe(true);
    expect(inv.count('med')).toBe(1);
  });
});

describe('F-15 LootTable', () => {
  it('normalizes fractional min and max to integers', () => {
    const t = new LootTable({ dropChance: 1 }).add('g', { min: 2.7, max: 2.9 });
    expect(t.entries[0].min).toBe(2);
    expect(t.entries[0].max).toBe(2);
    expect(t.roll(() => 0.99)[0].count).toBe(2);
  });
});

describe('F-16 Random', () => {
  it('distinct numeric seeds give distinct sequences and state round-trips', () => {
    expect(new Random(0).next()).not.toBe(new Random(1).next());
    expect(new Random(5).next()).not.toBe(new Random(-5).next());
    expect(new Random(1).next()).not.toBe(new Random(1.9).next());

    const r = new Random('s');
    r.next();
    r.next();
    const state = r.getState();
    const x = r.next();
    r.setState(state);
    expect(r.next()).toBe(x);
  });
});

describe('F-17 destructured helpers', () => {
  it('procgen, lineOfSight, and steering work when destructured', () => {
    const { cellularAutomata } = procgen;
    const { hasLineOfSight } = lineOfSight;
    const { pursue } = steering;
    expect(() => cellularAutomata({ cols: 8, rows: 8 })).not.toThrow();
    expect(() => hasLineOfSight({ x: 0, y: 0 }, { x: 50, y: 0 }, [{ x: 20, y: -5, w: 5, h: 10 }])).not.toThrow();
    expect(() => pursue({ x: 0, y: 0, vx: 1, vy: 0 }, { x: 10, y: 10 }, 100)).not.toThrow();
  });
});

describe('F-18 lineOfSight', () => {
  it('start point inside a circle is blocked, matching a box', () => {
    const box = lineOfSight.hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, [{ x: -50, y: -50, w: 100, h: 100 }]);
    const circ = lineOfSight.hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, [{ x: 0, y: 0, r: 50 }]);
    expect(circ).toBe(box);
  });
});

describe('F-19 StatusEffectManager', () => {
  it('notifies onExpire with reason cleared when an entity is cleared and rejects unknown stackMode', () => {
    const sm = new StatusEffectManager();
    const fn = vi.fn();
    expect(() => sm.define('bad', { stackMode: 'invalid' })).toThrow();

    sm.define('b', { duration: 100, onExpire: fn });
    const e = {};
    sm.apply(e, 'b');
    sm.clearEntity(e);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][2]).toBe('cleared');
  });
});

describe('R-01 StorageManager', () => {
  it('rolls mode back if remote load fails and strips prototype pollution keys', async () => {
    const store = new StorageManager({ namespace: 'r01_test' });
    const failingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'Network down' } })
          })
        })
      })
    };

    await expect(store.useSupabase({ client: failingClient })).rejects.toThrow('Network down');
    expect(store.mode).toBe('local');

    await store.importJSON('{"score":100,"__proto__":{"polluted":true}}');
    expect(store.get('score')).toBe(100);
    expect(store.has('__proto__')).toBe(false);
  });
});

describe('R-02 InputManager', () => {
  it('ignores key events originating from INPUT or TEXTAREA elements', () => {
    const inp = new InputManager();
    inp.detach();
    inp.bind('pause', ['KeyP']);

    inp._onKeyDown({ code: 'KeyP', target: { tagName: 'INPUT' } });
    expect(inp.isDown('pause')).toBe(false);

    inp._onKeyDown({ code: 'KeyP', target: { tagName: 'CANVAS' } });
    expect(inp.isDown('pause')).toBe(true);
  });
});

describe('R-03 & R-04 WeaponSystem boomerang & sub-stepping', () => {
  it('boomerang hits target on outbound and return paths, and fast projectiles do not tunnel', () => {
    const grid = new SpatialHash(64);
    const owner = { x: 0, y: 0 };
    const mob = { id: 'm1', x: 60, y: 0, r: 14, stats: new Stats({ maxHealth: 500 }) };
    grid.insert(mob);

    const w = new WeaponSystem();
    let hits = 0;
    w.fire(0, 0, 0, {
      speed: 300,
      life: 1000,
      r: 8,
      behavior: 'boomerang',
      owner,
      onHit: () => { hits++; }
    });

    for (let i = 0; i < 20; i++) {
      w.update(50, { spatialHash: grid });
    }
    expect(hits).toBe(2);

    // High-speed projectile (2400 px/s over 50ms = 120px in one step) hitting a thin target at x=60
    let fastHit = false;
    w.fire(0, 0, 0, {
      speed: 2400,
      life: 500,
      r: 4,
      behavior: 'linear',
      onHit: () => { fastHit = true; }
    });
    w.update(50, { spatialHash: grid });
    expect(fastHit).toBe(true);
  });
});

describe('R-07 & R-12 TilemapRenderer auto-invalidation & DevConsole quoted args', () => {
  it('TilemapRenderer marks chunks dirty when tilemap.loadGrid updates tilemap.version', () => {
    const tm = new Tilemap({ cols: 16, rows: 16, tileSize: 16 });
    const renderer = new TilemapRenderer(tm, { chunkSize: 8 });
    renderer.chunks.forEach((c) => { c.dirty = false; });

    tm.loadGrid(new Uint8Array(16 * 16).fill(1));
    const mockCtx = { drawImage: () => {} };
    renderer.render(mockCtx, 0, 0, 256, 256);
    expect(renderer.chunksRebuiltThisFrame).toBe(4);
  });

  it('DevConsole parses quoted arguments cleanly', () => {
    const dev = new DevConsole({ mountElement: null });
    dev.registerCommand('seed', ([val]) => val);
    expect(dev.execute('seed "sector 39 alpha"')).toBe('sector 39 alpha');
  });
});