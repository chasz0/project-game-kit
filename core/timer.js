// Handles in-game delays, cooldowns, and simple tweens based on delta time.
// Call timer.update(dt) in your game loop.
// timer.add(1000, () => console.log('Done!'), (progress) => console.log(progress));

class TimerManager {
  constructor() {
    this.timers = [];
  }

  add(durationMs, onComplete, onUpdate = null) {
    const timer = {
      duration: durationMs,
      elapsed: 0,
      onComplete,
      onUpdate,
      markedForDeletion: false
    };
    this.timers.push(timer);
    return timer;
  }

  cancel(timerRef) {
    if (timerRef) {
      timerRef.markedForDeletion = true;
    }
  }

  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      
      if (t.markedForDeletion) {
        this.timers.splice(i, 1);
        continue;
      }

      t.elapsed += dt;
      const progress = Math.min(t.elapsed / t.duration, 1);

      if (t.onUpdate) {
        t.onUpdate(progress);
      }

      if (t.elapsed >= t.duration) {
        if (t.onComplete) t.onComplete();
        this.timers.splice(i, 1);
      }
    }
  }
}

export const timer = new TimerManager();