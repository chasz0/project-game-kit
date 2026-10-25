// 2D vector math. Instance methods mutate `this` in place and return `this` for chaining.
// Use clone() or the static helpers (Vec2.add, Vec2.sub) when you need a new vector.
//
//   const pos = new Vec2(10, 20);
//   pos.add(vel).limit(100);
//   const delta = Vec2.sub(target, pos);

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone() {
    return new Vec2(this.x, this.y);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  mult(n) {
    this.x *= n;
    this.y *= n;
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  magSq() {
    return this.x * this.x + this.y * this.y;
  }

  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const mSq = this.x * this.x + this.y * this.y;
    if (mSq > 0) {
      const inv = 1 / Math.sqrt(mSq);
      this.x *= inv;
      this.y *= inv;
    }
    return this;
  }

  limit(max) {
    const mSq = this.x * this.x + this.y * this.y;
    if (mSq > max * max && mSq > 0) {
      const scale = max / Math.sqrt(mSq);
      this.x *= scale;
      this.y *= scale;
    }
    return this;
  }

  distanceSq(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  distance(v) {
    return Math.sqrt(this.distanceSq(v));
  }

  static add(a, b, out = new Vec2()) {
    return out.set(a.x + b.x, a.y + b.y);
  }

  static sub(a, b, out = new Vec2()) {
    return out.set(a.x - b.x, a.y - b.y);
  }

  static distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
}