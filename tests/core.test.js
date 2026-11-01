import { describe, it, expect, vi } from 'vitest';
import { Vec2 } from '@core/vec2.js';
import { EventEmitter } from '@core/events.js';
import { GameLoop } from '@core/loop.js';
import { InputManager } from '@core/input.js';
import { TimerManager } from '@core/timer.js';
import { Random } from '@core/random.js';
import { StorageManager } from '@core/storage.js';
import { SoundManager } from '@core/audio.js';

describe('Core Modules', () => {
  it('Vec2 performs in-place mutation and static non-mutating math', () => {
    const a = new Vec2(3, 4);
    expect(a.mag()).toBe(5);
    expect(a.magSq()).toBe(25);

    a.normalize().mult(10);
    expect(a.x).toBeCloseTo(6);
    expect(a.y).toBeCloseTo(8);

    a.limit(5);
    expect(a.mag()).toBeCloseTo(5);

    const p1 = new Vec2(10, 20);
    const p2 = new Vec2(13, 24);
    const out = new Vec2();
    Vec2.sub(p2, p1, out);
    expect(out.x).toBe(3);
    expect(out.y).toBe(4);
    expect(p1.distance(p2)).toBe(5);
  });

  it('EventEmitter handles on, once, off, and mid-emit unsubscription', () => {
    const bus = new EventEmitter();
    let count = 0;
    let onceCount = 0;

    const unsub = bus.on('hit', (val) => { count += val; });
    bus.once('hit', () => { onceCount++; });

    bus.emit('hit', 5);
    bus.emit('hit', 5);
    unsub();
    bus.emit('hit', 10);

    expect(count).toBe(10);
    expect(onceCount).toBe(1);
  });

  it('GameLoop steps fixed ticks and clamps lag spikes at 250ms', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});

    let ticks = 0;
    let lastAlpha = 0;
    const loop = new GameLoop(
      () => { ticks++; },
      (alpha) => { lastAlpha = alpha; },
      60
    );

    loop.isRunning = true;
    loop.lastTime = 0;
    loop.frame(50);
    expect(ticks).toBe(2);
    expect(lastAlpha).toBeGreaterThan(0);

    ticks = 0;
    loop.accumulator = 0;
    loop.lastTime = 0;
    loop.frame(5000);
    expect(ticks).toBe(15);
    loop.stop();

    vi.unstubAllGlobals();
  });

  it('InputManager tracks edge states and letterboxed canvas mouse coordinates', () => {
    const inp = new InputManager();
    inp.detach();
    inp.bind('jump', ['Space', 'KeyW']);

    inp.state.set('Space', true);
    expect(inp.isPressed('jump')).toBe(true);
    expect(inp.isDown('jump')).toBe(true);

    inp.update();
    expect(inp.isPressed('jump')).toBe(false);
    expect(inp.isDown('jump')).toBe(true);

    inp.state.set('Space', false);
    expect(inp.isReleased('jump')).toBe(true);
    expect(inp.isDown('jump')).toBe(false);

    const mockCanvas = {
      width: 400,
      height: 300,
      clientLeft: 0,
      clientTop: 0,
      clientWidth: 800,
      clientHeight: 300,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 300 })
    };
    globalThis.window = {
      getComputedStyle: () => ({
        objectFit: 'contain',
        paddingLeft: '0',
        paddingRight: '0',
        paddingTop: '0',
        paddingBottom: '0'
      })
    };

    inp.setTarget(mockCanvas);
    inp._updateMouse({ clientX: 400, clientY: 150 });
    expect(inp.mouse.x).toBeCloseTo(200);
    expect(inp.mouse.y).toBeCloseTo(150);
    delete globalThis.window;
  });

  it('TimerManager schedules delays, progress tweens, intervals, and cancellations', () => {
    const tm = new TimerManager();
    let completed = false;
    let lastProgress = 0;
    let ticks = 0;

    tm.add(1000, () => { completed = true; }, (p) => { lastProgress = p; });
    const rep = tm.every(300, () => { ticks++; });

    tm.update(250);
    tm.update(250);
    expect(completed).toBe(false);
    expect(lastProgress).toBeCloseTo(0.5);
    expect(ticks).toBe(1);

    tm.update(250);
    tm.update(250);
    expect(completed).toBe(true);
    expect(ticks).toBe(3);

    tm.cancel(rep);
    tm.update(600);
    expect(ticks).toBe(3);
  });

  it('Random produces identical sequences for identical seeds', () => {
    const r1 = new Random('seed-alpha');
    const r2 = new Random('seed-alpha');

    for (let i = 0; i < 20; i++) {
      expect(r1.int(1, 1000)).toBe(r2.int(1, 1000));
    }
  });

  it('StorageManager caches and retrieves keys synchronously', async () => {
    const store = new StorageManager({ namespace: 'test_ns' });
    await store.set('highScore', 4500);
    await store.setMany({ wave: 7, gold: 120 });

    expect(store.get('highScore')).toBe(4500);
    expect(store.get('wave')).toBe(7);
    expect(store.get('missing', 99)).toBe(99);

    store.remove('gold');
    expect(store.has('gold')).toBe(false);
  });

  it('SoundManager throttles same-frame swarm sound calls and respects mute', () => {
    const sfx = new SoundManager();
    const now = vi.spyOn(performance, 'now');

    now.mockReturnValue(1000);
    expect(sfx.play('hit')).toBe(true);
    expect(sfx.play('hit')).toBe(false);

    now.mockReturnValue(1050);
    expect(sfx.play('hit')).toBe(true);

    sfx.setMuted(true);
    now.mockReturnValue(2000);
    expect(sfx.play('hit')).toBe(false);
    now.mockRestore();
  });
});