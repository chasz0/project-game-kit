// Seeded random number generator for reproducible outcomes.
// const rng = new Random('level-1');
// rng.int(1, 10);

export class Random {
  constructor(seed = Date.now()) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }
      this.seed = Math.abs(hash) || 1;
    } else {
      this.seed = Math.abs(seed) || 1;
    }
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  choice(array) {
    return array[this.int(0, array.length - 1)];
  }
}

export const random = new Random();