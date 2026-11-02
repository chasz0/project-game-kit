export class Pool {
  constructor({ create, init = null, reset = null, size = 0, maxSize = Infinity } = {}) {
    if (typeof create !== 'function') {
      throw new TypeError('Pool requires a create() function');
    }
    this.create = create;
    this.init = init;
    this.reset = reset;
    this.maxSize = maxSize;

    this.items = [];
    this.active = new WeakSet();
    this.inUse = 0;

    for (let i = 0; i < size; i++) {
      const item = this.create();
      if (this.reset) this.reset(item);
      this.items.push(item);
    }
  }

  get available() {
    return this.items.length;
  }

  get(...args) {
    const item = this.items.length > 0 ? this.items.pop() : this.create();
    this.active.add(item);
    this.inUse++;
    if (this.init) this.init(item, ...args);
    return item;
  }

  release(item) {
    if (!this.active.delete(item)) {
      console.warn('Pool: item was released twice or not acquired from this pool (ignored)');
      return;
    }
    this.inUse--;
    if (this.reset) this.reset(item);
    if (this.items.length >= this.maxSize) return;
    this.items.push(item);
  }

  clear() {
    this.items.length = 0;
  }
}