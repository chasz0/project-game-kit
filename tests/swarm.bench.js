import { bench, describe } from 'vitest';
import { SpatialHash } from '@gameplay/spatialHash.js';
import { FlowField } from '@ai/flowField.js';
import { Tilemap } from '@world/tilemap.js';
import { procgen } from '@world/procgen.js';
import { ParticleSystem } from '@ui/particles.js';

describe('GameKit Swarm Hot-Path Benchmarks', () => {
  const grid = new SpatialHash(64);
  const entities = Array.from({ length: 5000 }, (_, i) => ({
    x: (i * 17) % 1600,
    y: (i * 31) % 1600,
    r: 10
  }));
  entities.forEach((e) => grid.insert(e));
  const scratch = [];

  bench('SpatialHash: update 5,000 moving entities + 20 radius queries', () => {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      e.x = (e.x + 1.5) % 1600;
      grid.update(e);
    }
    for (let q = 0; q < 20; q++) {
      grid.queryRadius(400 + q * 25, 400, 80, scratch);
    }
  });

  const flow = new FlowField({ cols: 50, rows: 50, cellSize: 32 });
  flow.setObstacleRect(320, 320, 256, 64);

  bench('FlowField: 50x50 BFS integration + vector field compute', () => {
    flow.compute(800, 800);
  });

  const cave = procgen.cellularAutomata({ cols: 50, rows: 50 });
  const tilemap = new Tilemap({ cols: 50, rows: 50, tileSize: 32 }).loadGrid(cave.grid);
  const wallRects = [];

  bench('Tilemap: greedy wall-rect extraction on 50x50 cave', () => {
    tilemap.extractWallRects(wallRects);
  });

  const fx = new ParticleSystem({ maxParticles: 1200, preallocate: 1200 });

  bench('ParticleSystem: emit & step 1,000 pooled particles', () => {
    if (fx.activeCount < 200) {
      fx.emit(400, 300, { count: 800, glow: false });
    }
    fx.update(16.67);
  });
});