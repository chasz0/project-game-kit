// Manages entity health, base attributes, and temporary modifiers.
// const hero = new Stats({ maxHealth: 100, speed: 50 });
// hero.addModifier('dash', 'speed', 'mult', 0.5); // +50% speed

export class Stats {
  constructor(baseStats = {}) {
    this.base = { ...baseStats };
    this.modifiers = new Map();
    this.health = this.base.maxHealth || 1;
  }

  addModifier(id, stat, type, value) {
    this.modifiers.set(id, { stat, type, value });
  }

  removeModifier(id) {
    this.modifiers.delete(id);
  }

  get(stat) {
    let val = this.base[stat] || 0;
    let mult = 1;

    for (const mod of this.modifiers.values()) {
      if (mod.stat === stat) {
        if (mod.type === 'add') val += mod.value;
        if (mod.type === 'mult') mult += mod.value;
      }
    }

    return val * mult;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health === 0;
  }

  heal(amount) {
    const max = this.get('maxHealth');
    this.health = Math.min(max, this.health + amount);
  }
}