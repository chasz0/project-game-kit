export class TimerManager {
  constructor() {
    this.timers = [];
    this._due = [];
    this._clearGen = 0;
  }

  add(durationMs, onComplete, onUpdate = null) {
    if (!(durationMs >= 0) || !Number.isFinite(durationMs)) {
      throw new RangeError('TimerManager.add: durationMs must be a finite number >= 0');
    }
    const entry = {
      duration: durationMs,
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
    if (!(intervalMs > 0) || !Number.isFinite(intervalMs)) {
      throw new RangeError('TimerManager.every: intervalMs must be a finite number > 0');
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
    if (!entry) return;
    entry.cancelled = true;
    const idx = this.timers.indexOf(entry);
    if (idx !== -1) {
      this.timers.splice(idx, 1);
    }
  }

  clear() {
    this.timers.length = 0;
    this._due.length = 0;
    this._clearGen++;
  }

  update(dt) {
    const list = this.timers;
    const due = this._due;
    due.length = 0;

    const initialLen = list.length;
    const startGen = this._clearGen;
    let writeIdx = 0;

    for (let i = 0; i < initialLen; i++) {
      const t = list[i];
      if (!t || t.cancelled) continue;

      t.elapsed += dt;

      if (t.onUpdate) {
        const progress = t.duration > 0 ? Math.min(t.elapsed / t.duration, 1) : 1;
        t.onUpdate(progress);
        if (this._clearGen !== startGen) return;
        if (t.cancelled) continue;
      }

      if (t.elapsed >= t.duration) {
        if (t.onComplete) due.push(t);
        if (t.repeat && !t.cancelled) {
          t.elapsed %= t.duration;
          list[writeIdx++] = t;
        }
      } else {
        list[writeIdx++] = t;
      }
    }

    for (let i = initialLen; i < list.length; i++) {
      if (!list[i].cancelled) {
        list[writeIdx++] = list[i];
      }
    }

    list.length = writeIdx;

    for (let i = 0; i < due.length; i++) {
      const t = due[i];
      if (!t.cancelled) {
        t.onComplete();
        if (this._clearGen !== startGen) break;
      }
    }
    due.length = 0;
  }
}

export const timer = new TimerManager();