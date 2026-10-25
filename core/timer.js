// Handles in-game delays, cooldowns, and repeating intervals based on delta time.

class TimerManager {
  constructor() {
    this.timers = [];
  }

  add(durationMs, onComplete, onUpdate = null) {
    const timer = { duration: durationMs, elapsed: 0, onComplete, onUpdate, isEvery: false, marked: false };
    this.timers.push(timer);
    return timer;
  }

  every(durationMs, onTick) {
    const timer = { duration: durationMs, elapsed: 0, onComplete: onTick, isEvery: true, marked: false };
    this.timers.push(timer);
    return timer;
  }

  cancel(timerRef) {
    if (timerRef) timerRef.marked = true;
  }

  update(dt) {
    const active = [];

    for (const t of this.timers) {
      if (t.marked) continue;

      t.elapsed += dt;
      
      if (t.onUpdate) {
        t.onUpdate(Math.min(t.elapsed / t.duration, 1));
      }

      if (t.elapsed >= t.duration) {
        if (t.onComplete) t.onComplete();
        
        if (t.isEvery && !t.marked) {
          t.elapsed -= t.duration;
          active.push(t);
        }
      } else {
        active.push(t);
      }
    }

    this.timers = active;
  }
}

export const timer = new TimerManager();