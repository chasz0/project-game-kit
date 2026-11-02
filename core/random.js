// Seeded PRNG (Mulberry32) for reproducible procedural generation and runs.
//
//   const rng = new Random('run-seed-42');
//   rng.next();          // [0, 1)
//   rng.range(5, 10);    // float in [5, 10)
//   rng.int(1, 6);       // integer in [1, 6]
//   rng.choice(items);   // random element

export class Random {
  constructor(seed = Date.now()) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    if (typeof seed !== 'string' && !(typeof seed === 'number' && Number.isFinite(seed))) {
      throw new TypeError(`Random: seed must be a finite number or string, got ${seed}`);
    }
    const str = typeof seed === 'number' && Object.is(seed, -0) ? '-0' : String(seed);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    this.state = (h >>> 0) || 1;
    return this;
  }

  getState() {
    return this.state >>> 0;
  }

  setState(state) {
    if (typeof state !== 'number' || !Number.isFinite(state)) {
      throw new TypeError(`Random.setState: state must be a finite number, got ${state}`);
    }
    this.state = state >>> 0;
    return this;
  }

  // Returns a float in [0, 1).
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  choice(array) {
    if (!Array.isArray(array) || array.length === 0) return undefined;
    return array[this.int(0, array.length - 1)];
  }
}

export const random = new Random();