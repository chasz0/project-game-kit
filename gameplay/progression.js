// Experience curve, level tracking, and weighted upgrade drafting with max ranks.
//
//   const prog = new Progression({ baseXp: 10, growthFactor: 1.35, linearStep: 5 });
//   prog.registerUpgrade({ id: 'dmg', title: 'Damage Up', maxRank: 5, weight: 2, apply: (rank) => {} });
//   if (prog.addXp(15)) { const cards = prog.rollChoices(3); }

export class Progression {
  constructor({ baseXp = 10, growthFactor = 1.35, linearStep = 5 } = {}) {
    this.baseXp = Math.max(1, baseXp);
    this.growthFactor = Math.max(1, growthFactor);
    this.linearStep = Math.max(0, linearStep);

    this.level = 1;
    this.xp = 0;
    this.xpToNext = this.baseXp;
    this.pendingLevels = 0;

    this.upgrades = new Map();
    this.ranks = new Map();
  }

  get xpRatio() {
    return Math.min(1, this.xp / this.xpToNext);
  }

  registerUpgrade({
    id,
    title = id,
    desc = '',
    tag = 'Upgrade',
    maxRank = Infinity,
    weight = 1,
    apply = null
  } = {}) {
    if (!id) throw new Error('Progression.registerUpgrade: id is required');
    this.upgrades.set(id, { id, title, desc, tag, maxRank, weight, apply });
    if (!this.ranks.has(id)) this.ranks.set(id, 0);
    return this;
  }

  // Adds XP and returns the number of new levels gained on this call.
  addXp(amount) {
    if (!(amount > 0)) return 0;
    this.xp += amount;
    let gained = 0;

    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.pendingLevels++;
      gained++;
      this.xpToNext = Math.floor(this.xpToNext * this.growthFactor + this.linearStep);
    }

    return gained;
  }

  getRank(id) {
    return this.ranks.get(id) || 0;
  }

  // Drafts up to `count` unique, non-maxed upgrades weighted by their weight property.
  rollChoices(count = 3, rng = Math.random) {
    const pool = [];
    for (const u of this.upgrades.values()) {
      const currentRank = this.getRank(u.id);
      if (currentRank < u.maxRank && u.weight > 0) {
        pool.push({
          ...u,
          currentRank,
          nextRank: currentRank + 1
        });
      }
    }

    const choices = [];
    const limit = Math.min(count, pool.length);

    for (let i = 0; i < limit; i++) {
      let totalWeight = 0;
      for (let j = 0; j < pool.length; j++) totalWeight += pool[j].weight;

      let roll = rng() * totalWeight;
      let pickedIdx = pool.length - 1;

      for (let j = 0; j < pool.length; j++) {
        roll -= pool[j].weight;
        if (roll <= 0) {
          pickedIdx = j;
          break;
        }
      }

      choices.push(pool.splice(pickedIdx, 1)[0]);
    }

    return choices;
  }

  selectUpgrade(id, context = null) {
    const u = this.upgrades.get(id);
    if (!u) throw new Error(`Progression: unknown upgrade "${id}"`);

    const rank = this.getRank(id);
    if (rank >= u.maxRank) return false;

    const newRank = rank + 1;
    this.ranks.set(id, newRank);
    if (this.pendingLevels > 0) this.pendingLevels--;
    if (u.apply) u.apply(newRank, context);
    return true;
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.xpToNext = this.baseXp;
    this.pendingLevels = 0;
    for (const key of this.ranks.keys()) {
      this.ranks.set(key, 0);
    }
  }
}