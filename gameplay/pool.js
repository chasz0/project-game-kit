// Recycles objects to prevent memory allocation overhead.

export class Pool {
  constructor(factoryFn, initFn = null, resetFn = null, initialSize = 0) {
    this.factoryFn = factoryFn;
    this.initFn = initFn;
    this.resetFn = resetFn;
    this.items = [];
    this.inPool = new WeakSet();
    
    for (let i = 0; i < initialSize; i++) {
      const item = this.factoryFn();
      this.inPool.add(item);
      this.items.push(item);
    }
  }

  get(...args) {
    const item = this.items.length > 0 ? this.items.pop() : this.factoryFn();
    this.inPool.delete(item);
    if (this.initFn) this.initFn(item, ...args);
    return item;
  }

  release(item) {
    if (this.inPool.has(item)) return;
    if (this.resetFn) this.resetFn(item);
    this.inPool.add(item);
    this.items.push(item);
  }

  clear() {
    this.items.length = 0;
    this.inPool = new WeakSet();
  }
}