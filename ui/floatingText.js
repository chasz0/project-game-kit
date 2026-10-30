// Pooled world-space floating combat text and status popup renderer.
//
//   const combatText = new FloatingTextSystem();
//   combatText.spawn(enemy.x, enemy.y, '-45', { color: '#f3ead3' });
//   combatText.update(dt);
//   combatText.render(ctx);

export class FloatingTextSystem {
  constructor({ maxItems = 300, preallocate = 60, rng = Math.random } = {}) {
    this.maxItems = Math.max(1, maxItems);
    this.rng = rng;
    this.active = [];
    this.freeList = [];

    for (let i = 0; i < preallocate; i++) {
      this.freeList.push(this._createItem());
    }
  }

  get activeCount() {
    return this.active.length;
  }

  get pooledCount() {
    return this.freeList.length;
  }

  spawn(x, y, text, {
    color = '#f3ead3',
    strokeColor = '#080b12',
    vy = -44,
    vx = 0,
    duration = 580,
    fontSize = 11,
    jitterX = 8
  } = {}) {
    if (this.active.length >= this.maxItems) {
      this.freeList.push(this.active.shift());
    }

    const item = this.freeList.length > 0 ? this.freeList.pop() : this._createItem();
    const offsetX = jitterX > 0 ? (this.rng() * 2 - 1) * jitterX : 0;

    item.x = x + offsetX;
    item.y = y;
    item.vx = vx;
    item.vy = vy;
    item.text = String(text);
    item.color = color;
    item.strokeColor = strokeColor;
    item.fontSize = fontSize;
    item.life = 0;
    item.maxLife = Math.max(50, duration);

    this.active.push(item);
    return item;
  }

  update(dt) {
    const dtSec = dt / 1000;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      t.life += dt;

      if (t.life >= t.maxLife) {
        const last = this.active.pop();
        if (i < this.active.length) {
          this.active[i] = last;
        }
        this.freeList.push(t);
        continue;
      }

      t.x += t.vx * dtSec;
      t.y += t.vy * dtSec;
    }
  }

  render(ctx) {
    if (this.active.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;

    for (let i = 0; i < this.active.length; i++) {
      const t = this.active[i];
      ctx.globalAlpha = Math.max(0, 1 - t.life / t.maxLife);
      ctx.font = `bold ${t.fontSize}px monospace`;
      ctx.strokeStyle = t.strokeColor;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }

    ctx.restore();
  }

  clear() {
    while (this.active.length > 0) {
      this.freeList.push(this.active.pop());
    }
  }

  _createItem() {
    return {
      x: 0, y: 0, vx: 0, vy: -44,
      text: '', color: '#f3ead3', strokeColor: '#080b12',
      fontSize: 11, life: 0, maxLife: 580
    };
  }
}