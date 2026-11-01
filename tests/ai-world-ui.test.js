import { describe, it, expect } from 'vitest';
import { steering } from '@ai/steering.js';
import { FlowField } from '@ai/flowField.js';
import { lineOfSight } from '@ai/lineOfSight.js';
import { SwarmDirector } from '@ai/director.js';
import { Tilemap } from '@world/tilemap.js';
import { TilemapRenderer } from '@world/tilemapRenderer.js';
import { procgen } from '@world/procgen.js';
import { ParticleSystem } from '@ui/particles.js';
import { FloatingTextSystem } from '@ui/floatingText.js';
import { DevConsole } from '@ui/devConsole.js';
import { DialogueSystem } from '@ui/dialogue.js';

describe('AI, World & UI Modules', () => {
  it('steering flee accelerates inside panicRadius and brakes outside panicRadius', () => {
    const threat = { x: 0, y: 0 };
    const inside = { x: 50, y: 0, vx: 10, vy: 0 };
    const outside = { x: 250, y: 0, vx: 20, vy: 0 };

    const fIn = steering.flee(inside, threat, 200, 150);
    const fOut = steering.flee(outside, threat, 200, 150);

    expect(fIn.x).toBeGreaterThan(0);
    expect(fOut.x).toBeLessThan(0);
  });

  it('FlowField routes around solid obstacles without corner-cutting', () => {
    const ff = new FlowField({ cols: 10, rows: 10, cellSize: 20 });
    ff.setObstacleRect(80, 20, 20, 140);
    ff.compute(140, 80);

    const sample = ff.sample(50, 80);
    expect(Math.hypot(sample.x, sample.y)).toBeCloseTo(1);
    expect(ff.getDistance(50, 80)).toBeGreaterThan(4);
  });

  it('lineOfSight detects wall occlusion and filters visible targets', () => {
    const walls = [{ x: 100, y: 0, w: 30, h: 200 }];
    const origin = { x: 40, y: 80 };
    const blockedTarget = { x: 180, y: 80 };
    const clearTarget = { x: 70, y: 80 };

    expect(lineOfSight.hasLineOfSight(origin, blockedTarget, walls)).toBe(false);
    expect(lineOfSight.hasLineOfSight(origin, clearTarget, walls)).toBe(true);

    const visible = lineOfSight.filterVisible(origin, 0, [blockedTarget, clearTarget], 300, Math.PI, walls);
    expect(visible).toEqual([clearTarget]);
  });

  it('SwarmDirector assigns distinct 360-degree surround slots and cycles phases', () => {
    const dir = new SwarmDirector({ rings: [{ radius: 50, slots: 8 }] });
    const s1 = dir.assignSlot({ x: 200, y: 100 }, 100, 100, {});
    const s2 = dir.assignSlot({ x: 205, y: 100 }, 100, 100, {});

    expect(s1.slotIndex).not.toBe(s2.slotIndex);

    dir.registerEnemy('dart', { cost: 1, weight: 1 });
    dir.recordPlayerDamage(100);
    dir.update(16, { activeCount: 100 });
    expect(dir.phase).toBe('peak');
  });

  it('Tilemap merges contiguous wall tiles and resolves circle collisions in O(1)', () => {
    const map = new Tilemap({ cols: 16, rows: 16, tileSize: 32 });
    for (let c = 2; c < 8; c++) map.set(c, 4, 1);

    const rects = map.extractWallRects();
    expect(rects.length).toBe(1);
    expect(rects[0].w).toBe(6 * 32);

    const player = { x: 3 * 32, y: 4 * 32 - 8, r: 14 };
    const res = map.collideCircle(player);
    expect(res.hit).toBe(true);
    expect(player.y).toBeCloseTo(4 * 32 - 14);
  });

  it('TilemapRenderer invalidates only affected chunks on single-tile edits', () => {
    const map = new Tilemap({ cols: 64, rows: 64, tileSize: 32 });
    const renderer = new TilemapRenderer(map, { chunkSize: 16 });
    renderer.chunks.forEach((c) => { c.dirty = false; });

    map.set(5, 5, 1);
    renderer.invalidateTile(5, 5);

    const dirtyChunks = renderer.chunks.filter((c) => c.dirty);
    expect(dirtyChunks.length).toBe(1);
    expect(dirtyChunks[0].col).toBe(0);
    expect(dirtyChunks[0].row).toBe(0);
  });

  it('procgen algorithms produce valid walkable spawn tiles', () => {
    const cave = procgen.cellularAutomata({ cols: 30, rows: 30 });
    expect(cave.grid[cave.spawn.row * 30 + cave.spawn.col]).toBe(0);

    const dungeon = procgen.dungeonRooms({ cols: 30, rows: 30, roomCount: 6 });
    expect(dungeon.grid[dungeon.spawn.row * 30 + dungeon.spawn.col]).toBe(0);

    const arena = procgen.arenaPillars({ cols: 30, rows: 30 });
    expect(arena.grid[arena.spawn.row * 30 + arena.spawn.col]).toBe(0);
  });

  it('ParticleSystem and FloatingTextSystem recycle expired items into their freeList', () => {
    const fx = new ParticleSystem({ maxParticles: 50, preallocate: 10 });
    fx.emit(0, 0, { count: 5, lifeMin: 100, lifeMax: 100 });
    expect(fx.activeCount).toBe(5);
    fx.update(150);
    expect(fx.activeCount).toBe(0);
    expect(fx.pooledCount).toBe(10);

    const fct = new FloatingTextSystem({ maxItems: 50, preallocate: 10 });
    fct.spawn(0, 0, '-25', { duration: 100 });
    expect(fct.activeCount).toBe(1);
    fct.update(150);
    expect(fct.activeCount).toBe(0);
    expect(fct.pooledCount).toBe(10);
  });

  it('DevConsole executes registered commands and DialogueSystem filters conditional choices', () => {
    const dev = new DevConsole({ mountElement: null });
    dev.registerCommand('add', ([a, b]) => Number(a) + Number(b));
    expect(dev.execute('add 7 8')).toBe(15);

    const dlg = new DialogueSystem({ charsPerSecond: 100 });
    const ctx = { gold: 30 };
    dlg.addNode('shop', {
      speaker: 'NPC',
      text: 'Hello',
      choices: [
        { label: 'Cheap', condition: (c) => c.gold >= 20, action: (c) => { c.gold -= 20; } },
        { label: 'Expensive', condition: (c) => c.gold >= 100 }
      ]
    });

    dlg.start('shop', ctx);
    expect(dlg.getAvailableChoices().length).toBe(1);
    dlg.choose(0);
    expect(ctx.gold).toBe(10);
  });
});