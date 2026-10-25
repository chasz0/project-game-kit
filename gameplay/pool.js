// Recycles objects to avoid allocation and garbage-collection spikes.
// const bullets = new Pool({
//   create:  () => ({ x: 0, y: 0, active: false }),
//   init:    (b, x, y) => { b.x = x; b.y = y; b.active = true; },
//   reset:   (b) => { b.active = false; },
//   size: 100,        // pre-created objects
//   maxSize: 1000,    // optional cap on how many idle objects are kept
// });
// const b = bullets.get(10, 20);   // init runs automatically
// bullets.release(b);              // reset runs automatically

export class Pool {
  constructor({ create, init = null, reset = null, size = 0, maxSize = Infinity } = {}) {
    if (typeof create !== 'function') {
      throw new TypeError('Pool requires a create() function');
    }
    this.create = create;
    this.init = init;
    this.reset = reset;
    this.maxSize = maxSize;

    this.items = [];            // idle objects
    this.inPool = new WeakSet();
    this.inUse = 0;             // handed out and not yet released

    for (let i = 0; i < size; i++) {
      const item = this.create();
      if (this.reset) this.reset(item); // same starting state as a recycled object
      this.inPool.add(item);
      this.items.push(item);
    }
  }

  get available() {
    return this.items.length;
  }

  get(...args) {
    const item = this.items.length > 0 ? this.items.pop() : this.create();
    this.inPool.delete(item);
    this.inUse++;
    if (this.init) this.init(item, ...args);
    return item;
  }

  release(item) {
    if (this.inPool.has(item)) {
      console.warn('Pool: item was released twice (ignored)');
      return;
    }
    this.inUse--;
    if (this.reset) this.reset(item);
    if (this.items.length >= this.maxSize) return; // over the cap: let GC take it
    this.inPool.add(item);
    this.items.push(item);
  }

  clear() {
    this.items.length = 0;
    this.inPool = new WeakSet();
  }
}