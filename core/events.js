// Pub/sub event bus for decoupled communication between game systems.
//
//   const off = events.on('enemyKilled', (e) => addScore(e.points));
//   events.emit('enemyKilled', { points: 10 });
//   off(); // unsubscribe

export class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('EventEmitter.on: callback must be a function');
    }
    let list = this.listeners.get(event);
    if (!list) {
      list = [];
      this.listeners.set(event, list);
    }
    list.push(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const off = this.on(event, (data) => {
      off();
      callback(data);
    });
    return off;
  }

  off(event, callback) {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this.listeners.delete(event);
  }

  emit(event, data) {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return;
    const snapshot = list.slice();
    for (let i = 0; i < snapshot.length; i++) {
      snapshot[i](data);
    }
  }

  clear(event) {
    if (event !== undefined) this.listeners.delete(event);
    else this.listeners.clear();
  }
}

export const events = new EventEmitter();