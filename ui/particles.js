// Zero-allocation 2D particle emitter with internal object recycling.
//
//   const fx = new ParticleSystem({ maxParticles: 1000 });
//   fx.emit(x, y, { count: 12, color: '#f3ead3', speedMax: 200, glow: true });
//   fx.update(dt);
//   fx.render(ctx);

export class ParticleSystem {
  constructor({ maxParticles = 1200, preallocate = 200, rng = Math.random } = {}) {
    this.maxParticles = Math.max(1, maxParticles);
    this.rng = rng;
    this.active = [];
    this.freeList = [];

    for (let i = 0; i < preallocate; i++) {
      this.freeList.push(this._createParticle());
    }
  }

  get activeCount() {
    return this.active.length;
  }

  get pooledCount() {
    return this.freeList.length;
  }

  emit(x, y, {
    count = 8,
    color = '#f3ead3',
    speedMin = 40,
    speedMax = 180,
    sizeMin = 2.5,
    sizeMax = 4.5,
    lifeMin = 180,
    lifeMax = 420,
    angle = 0,
    spread = Math.PI * 2,
    drag = 0.98,
    gravity = 0,
    glow = true
  } = {}) {
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      if (this.active.length >= this.maxParticles) break;

      const p = this.freeList.length > 0 ? this.freeList.pop() : this._createParticle();
      const dir = angle - spread * 0.5 + this.rng() * spread;
      const spd = speedMin + this.rng() * (speedMax - speedMin);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(dir) * spd;
      p.vy = Math.sin(dir) * spd;
      p.color = color;
      p.size = sizeMin + this.rng() * (sizeMax - sizeMin);
      p.life = 0;
      p.maxLife = Math.max(16, lifeMin + this.rng() * (lifeMax - lifeMin));
      p.drag = drag;
      p.gravity = gravity;
      p.glow = glow;

      this.active.push(p);
      spawned++;
    }

    return spawned;
  }

  update(dt) {
    const dtSec = dt / 1000;
    const dampFactor = Math.pow(0.98, dt / 16.67);

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        const last = this.active.pop();
        if (i < this.active.length) {
          this.active[i] = last;
        }
        this.freeList.push(p);
        continue;
      }

      if (p.drag < 1) {
        const d = p.drag === 0.98 ? dampFactor : Math.pow(p.drag, dt / 16.67);
        p.vx *= d;
        p.vy *= d;
      }

      p.vy += p.gravity * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
    }
  }

  render(ctx) {
    if (this.active.length === 0) return;

    ctx.save();
    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i];
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      if (p.glow) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
    ctx.restore();
  }

  clear() {
    while (this.active.length > 0) {
      this.freeList.push(this.active.pop());
    }
  }

  _createParticle() {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      color: '#f3ead3', size: 3,
      life: 0, maxLife: 300,
      drag: 0.98, gravity: 0, glow: true
    };
  }
}