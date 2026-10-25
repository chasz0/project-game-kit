// Global event bus.
// const unsubscribe = events.on('death', () => {});

class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    const callbacks = [...this.listeners.get(event)];
    for (const callback of callbacks) {
      callback(data);
    }
  }
}

export const events = new EventEmitter();