// Manages entity health, base attributes, and temporary modifiers.
// type: 'add' (flat value) or 'percent' (additive percentage, e.g., 0.5 for +50%)

export class Stats {
  constructor(baseStats = {}) {
    this.base = { ...baseStats };
    this.modifiers = new Map();
    this.health = this.base.maxHealth || 1;
    this.dead = false;
  }

  addModifier(id, stat, type, value) {
    this.modifiers.set(id, { stat, type, value });
  }

  removeModifier(id) {
    this.modifiers.delete(id);
    this.health = Math.min(this.health, this.get('maxHealth'));
  }

  get(stat) {
    let val = this.base[stat] || 0;
    let percent = 1;

    for (const mod of this.modifiers.values()) {
      if (mod.stat === stat) {
        if (mod.type === 'add') val += mod.value;
        if (mod.type === 'percent') percent += mod.value;
      }
    }

    return val * percent;
  }

  takeDamage(amount) {
    if (this.dead) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) { 
      this.dead = true; 
      return true; 
    }
    return false;
  }

  heal(amount) {
    if (this.dead) return;
    this.health = Math.min(this.get('maxHealth'), this.health + amount);
  }
}