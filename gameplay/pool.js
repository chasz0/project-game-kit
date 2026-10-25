// Recycles objects to prevent memory allocation overhead and garbage collection spikes.
// const bulletPool = new Pool(() => new Vec2());
// const b = bulletPool.get();
// bulletPool.release(b);

export class Pool {
  constructor(factoryFn, initialSize = 0) {
    this.factoryFn = factoryFn;
    this.items = [];
    
    for (let i = 0; i < initialSize; i++) {
      this.items.push(this.factoryFn());
    }
  }

  get() {
    return this.items.length > 0 ? this.items.pop() : this.factoryFn();
  }

  release(item) {
    this.items.push(item);
  }

  clear() {
    this.items.length = 0;
  }
}