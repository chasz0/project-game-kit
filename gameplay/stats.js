// Entity health, base attributes, and temporary modifiers.
//
//   const hero = new Stats({ maxHealth: 100, speed: 50 });
//   hero.addModifier('sprint', 'speed', 'percent', 0.5);   // +50% speed
//   hero.addModifier('ring', 'maxHealth', 'add', 20);      // +20 max HP
//   hero.get('speed');                                      // 75
//   if (hero.takeDamage(30)) { /* true only on the killing blow */ }
//
// Modifier types (formula: (base + sum of 'add') * (1 + sum of 'percent')):
//   'add'      flat bonus
//   'percent'  additive percentage, 0.5 = +50%. Two +50% give +100%, not x2.25.
//
// Notes:
//   - maxHealth defaults to 1 if you don't give one, and never drops below 1.
//   - Reusing a modifier id replaces the old modifier (no stacking).
//   - Removing a max-HP modifier lowers HP to the new max. It is not restored later.

const MODIFIER_TYPES = new Set(['add', 'percent']);

export class Stats {
  constructor(baseStats = {}) {
    this.base = { ...baseStats };
    this.base.maxHealth ??= 1;
    this.modifiers = new Map();
    this.dead = false;
    this.health = this.maxHealth;
  }

  // Effective max HP. Never below 1, so a curse can't leave you at negative HP.
  get maxHealth() {
    return Math.max(1, this.get('maxHealth'));
  }

  // 0 to 1, handy for health bars.
  get healthRatio() {
    return this.health / this.maxHealth;
  }

  addModifier(id, stat, type, value) {
    if (!MODIFIER_TYPES.has(type)) {
      throw new Error(`Stats: unknown modifier type "${type}" (use 'add' or 'percent')`);
    }
    if (!Number.isFinite(value)) {
      throw new TypeError(`Stats: modifier "${id}" needs a finite number, got ${value}`);
    }
    this.modifiers.set(id, { stat, type, value });
    this._clampHealth();
  }

  removeModifier(id) {
    const removed = this.modifiers.delete(id);
    this._clampHealth();
    return removed;
  }

  hasModifier(id) {
    return this.modifiers.has(id);
  }

  get(stat) {
    let val = this.base[stat] || 0;
    let percent = 1;

    for (const mod of this.modifiers.values()) {
      if (mod.stat === stat) {
        if (mod.type === 'add') val += mod.value;
        else percent += mod.value;
      }
    }

    return val * percent;
  }

  // Returns true only on the hit that kills. Negative damage counts as 0.
  takeDamage(amount) {
    this._checkAmount(amount);
    if (this.dead) return false;

    this.health = Math.max(0, this.health - Math.max(0, amount));
    if (this.health > 0) return false;

    this.dead = true;
    return true;
  }

  // Does nothing while dead (use revive). Negative healing counts as 0.
  heal(amount) {
    this._checkAmount(amount);
    if (this.dead) return;

    this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount));
  }

  // Brings a dead entity back. Returns false (and does nothing) if it is alive.
  revive(health = this.maxHealth) {
    if (!(health > 0)) {
      throw new RangeError('Stats: revive() needs health above 0');
    }
    if (!this.dead) return false;

    this.dead = false;
    this.health = Math.min(health, this.maxHealth);
    return true;
  }

  _clampHealth() {
    this.health = Math.min(this.health, this.maxHealth);
  }

  _checkAmount(amount) {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new TypeError(`Stats: amount must be a number, got ${amount}`);
    }
  }
}