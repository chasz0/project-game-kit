// Handles 2D vector math for positions, velocities, and directions.
// const v1 = new Vec2(10, 5);
// v1.add(new Vec2(2, 3)).normalize();

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
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

  mag() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const m = this.mag();
    if (m > 0) {
      this.x /= m;
      this.y /= m;
    }
    return this;
  }

  distance(v) {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  clone() {
    return new Vec2(this.x, this.y);
  }
}