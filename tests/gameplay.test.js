import { describe, it, expect } from 'vitest';
import { Pool } from '@gameplay/pool.js';
import { SpatialHash } from '@gameplay/spatialHash.js';
import { collision } from '@gameplay/collision.js';
import { Stats } from '@gameplay/stats.js';
import { StateMachine } from '@gameplay/stateMachine.js';
import { Camera } from '@gameplay/camera.js';
import { AbilityManager } from '@gameplay/abilities.js';
import { WaveSpawner } from '@gameplay/spawner.js';
import { Progression } from '@gameplay/progression.js';
import { LootTable } from '@gameplay/loot.js';
import { Inventory } from '@gameplay/inventory.js';
import { StatusEffectManager } from '@gameplay/statusEffects.js';
import { WeaponSystem } from '@gameplay/weapons.js';

describe('Gameplay Modules', () => {
  it('Pool recycles objects and ignores duplicate release calls', () => {
    const pool = new Pool({
      create: () => ({ x: 0, active: false }),
      init: (o, x) => { o.x = x; o.active = true; },
      reset: (o) => { o.active = false; },
      size: 2,
      maxSize: 3
    });

    const a = pool.get(42);
    expect(a.x).toBe(42);
    expect(a.active).toBe(true);
    expect(pool.inUse).toBe(1);

    pool.release(a);
    pool.release(a);
    expect(pool.inUse).toBe(0);
    expect(pool.available).toBe(2);
  });

  it('SpatialHash skips same-cell updates and deduplicates multi-cell entities', () => {
    const grid = new SpatialHash(64);
    const mob = { id: 1, x: 20, y: 20, r: 10 };
    grid.insert(mob);

    mob.x = 30;
    expect(grid.update(mob)).toBe(false);

    mob.x = 140;
    expect(grid.update(mob)).toBe(true);

    const hits = grid.queryRadius(140, 20, 30);
    expect(hits.length).toBe(1);
    expect(hits[0]).toBe(mob);
  });

  it('collision computes accurate circle-circle and circle-box penetration manifolds', () => {
    const c1 = { x: 100, y: 100, r: 15 };
    const c2 = { x: 120, y: 100, r: 15 };
    const hit = collision.circleCircleInfo(c1, c2);
    expect(hit).not.toBeNull();
    expect(hit.depth).toBeCloseTo(10);
    expect(hit.nx).toBeCloseTo(-1);

    const box = { x: 100, y: 100, w: 50, h: 50 };
    const circle = { x: 92, y: 125, r: 12 };
    const bHit = collision.circleBoxInfo(circle, box);
    expect(bHit).not.toBeNull();
    expect(bHit.depth).toBeCloseTo(4);
    expect(bHit.nx).toBeCloseTo(-1);
  });

  it('Stats applies flat/percent modifiers and fires death strictly once', () => {
    const hero = new Stats({ maxHealth: 100, damage: 20 });
    hero.addModifier('ring', 'damage', 'add', 10);
    hero.addModifier('fury', 'damage', 'percent', 0.5);
    expect(hero.get('damage')).toBeCloseTo(45);

    expect(hero.takeDamage(60)).toBe(false);
    expect(hero.takeDamage(50)).toBe(true);
    expect(hero.takeDamage(50)).toBe(false);
    expect(hero.dead).toBe(true);

    hero.revive(40);
    expect(hero.dead).toBe(false);
    expect(hero.health).toBe(40);
  });

  it('StateMachine transitions cleanly through exit and enter hooks', () => {
    const fsm = new StateMachine();
    const order = [];
    fsm.add('a', { enter: () => order.push('enterA'), exit: () => order.push('exitA') });
    fsm.add('b', { enter: (p) => order.push(`enterB:${p}`) });

    fsm.change('a');
    fsm.change('b', 99);
    expect(order).toEqual(['enterA', 'exitA', 'enterB:99']);
  });

  it('Camera projects screenToWorld and worldToScreen accurately under zoom', () => {
    const cam = new Camera(800, 600);
    cam.setZoom(2);
    cam.follow({ x: 500, y: 400 }, 1);

    const world = cam.screenToWorld(400, 300);
    expect(world.x).toBeCloseTo(500);
    expect(world.y).toBeCloseTo(400);

    const screen = cam.worldToScreen(500, 400);
    expect(screen.x).toBeCloseTo(400);
    expect(screen.y).toBeCloseTo(300);
  });

  it('AbilityManager handles multi-charge cooldowns and haste scaling', () => {
    const ab = new AbilityManager();
    ab.register('dash', { cooldown: 1000, charges: 2, duration: 200 });

    expect(ab.use('dash', null, 0.5)).toBe(true);
    expect(ab.getState('dash').charges).toBe(1);
    expect(ab.getState('dash').isActive).toBe(true);

    ab.update(250, null, 0.5);
    expect(ab.getState('dash').isActive).toBe(false);

    ab.update(250, null, 0.5);
    expect(ab.getState('dash').charges).toBe(2);
  });

  it('Progression handles multi-level XP overflow and excludes maxed upgrades', () => {
    const prog = new Progression({ baseXp: 10, growthFactor: 1.5, linearStep: 0 });
    prog.registerUpgrade({ id: 'u1', maxRank: 1 });
    prog.registerUpgrade({ id: 'u2', maxRank: 3 });

    const gained = prog.addXp(30);
    expect(gained).toBe(2);
    expect(prog.pendingLevels).toBe(2);

    prog.selectUpgrade('u1');
    const choices = prog.rollChoices(2);
    expect(choices.length).toBe(1);
    expect(choices[0].id).toBe('u2');
  });

  it('LootTable and Inventory manage drops, stack splitting, and consumables', () => {
    const table = new LootTable({ dropChance: 0 })
      .add('core', { guaranteed: true, min: 2, max: 2 });
    const drops = table.roll();
    expect(drops).toEqual([{ id: 'core', count: 2 }]);

    let healed = 0;
    const inv = new Inventory({ maxSlots: 2 });
    inv.defineItem('medkit', { maxStack: 3, consumable: true, onUse: () => { healed += 50; } });

    const res = inv.add('medkit', 8);
    expect(res.added).toBe(6);
    expect(res.overflow).toBe(2);

    inv.use('medkit');
    expect(healed).toBe(50);
    expect(inv.count('medkit')).toBe(5);
  });

  it('StatusEffectManager syncs Stats modifiers, ticks DoT, and tracks CC locks', () => {
    const statuses = new StatusEffectManager();
    const entity = { stats: new Stats({ maxHealth: 100, speed: 200 }) };

    statuses.define('chill', { duration: 1000, maxStacks: 3, stat: 'speed', modType: 'percent', value: -0.25 });
    statuses.define('burn', { duration: 1000, maxStacks: 3, tickInterval: 500, onTick: (e, s) => e.stats.takeDamage(5 * s.stacks) });
    statuses.define('stun', { duration: 500, control: 'stun' });

    statuses.apply(entity, 'chill', { stacks: 2 });
    statuses.apply(entity, 'burn', { stacks: 2 });
    statuses.apply(entity, 'stun');

    expect(entity.stats.get('speed')).toBeCloseTo(100);
    expect(statuses.isStunned(entity)).toBe(true);

    statuses.update(500);
    expect(entity.stats.health).toBe(90);
    expect(statuses.isStunned(entity)).toBe(false);

    statuses.update(500);
    expect(entity.stats.get('speed')).toBeCloseTo(200);
  });

  it('WeaponSystem fires spread cones and chains ricochet projectiles across SpatialHash targets', () => {
    const grid = new SpatialHash(64);
    const mobA = { id: 'A', x: 50, y: 0, r: 12, stats: new Stats({ maxHealth: 100 }) };
    const mobB = { id: 'B', x: 50, y: 60, r: 12, stats: new Stats({ maxHealth: 100 }) };
    grid.insert(mobA);
    grid.insert(mobB);

    const weapons = new WeaponSystem();
    const hitIds = [];
    weapons.fire(0, 0, 0, { speed: 500, behavior: 'ricochet', bounces: 2 });

    weapons.update(100, { spatialHash: grid, onHit: (e) => hitIds.push(e.id) });
    weapons.update(120, { spatialHash: grid, onHit: (e) => hitIds.push(e.id) });

    expect(hitIds).toEqual(['A', 'B']);
  });
});