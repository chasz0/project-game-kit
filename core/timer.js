// Delta-time driven delays, tweens, and repeating intervals.
//
//   timer.add(500, () => explode(), (progress) => setScale(progress));
//   const spawner = timer.every(1000, () => spawnWave());
//   timer.cancel(spawner);
//   timer.update(dt); // call once per fixed update step (dt in ms)

export class TimerManager {
  constructor() {
    this.timers = [];
  }

  add(durationMs, onComplete, onUpdate = null) {
    const entry = {
      duration: Math.max(0, durationMs),
      elapsed: 0,
      onComplete,
      onUpdate,
      repeat: false,
      cancelled: false
    };
    this.timers.push(entry);
    return entry;
  }

  every(intervalMs, onTick) {
    if (!(intervalMs > 0)) {
      throw new RangeError('TimerManager.every: intervalMs must be > 0');
    }
    const entry = {
      duration: intervalMs,
      elapsed: 0,
      onComplete: onTick,
      onUpdate: null,
      repeat: true,
      cancelled: false
    };
    this.timers.push(entry);
    return entry;
  }

  cancel(entry) {
    if (entry) entry.cancelled = true;
  }

  clear() {
    this.timers.length = 0;
  }

  update(dt) {
    const list = this.timers;
    let writeIdx = 0;

    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.cancelled) continue;

      t.elapsed += dt;

      if (t.onUpdate) {
        const progress = t.duration > 0 ? Math.min(t.elapsed / t.duration, 1) : 1;
        t.onUpdate(progress);
      }

      if (t.elapsed >= t.duration) {
        if (t.onComplete) t.onComplete();
        if (t.repeat && !t.cancelled) {
          t.elapsed %= t.duration;
          list[writeIdx++] = t;
        }
      } else {
        list[writeIdx++] = t;
      }
    }

    list.length = writeIdx;
  }
}

export const timer = new TimerManager();