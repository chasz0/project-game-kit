// Weighted loot table for enemy drops, chests, and reward rolls.
//
//   const table = new LootTable({ dropChance: 0.5 });
//   table.add('gold', { weight: 70, min: 5, max: 15 });
//   table.add('medkit', { weight: 20, min: 1, max: 1 });
//   const drops = table.roll(() => rng.next());

export class LootTable {
  constructor({ dropChance = 1.0 } = {}) {
    this.dropChance = Math.max(0, Math.min(1, dropChance));
    this.entries = [];
  }

  add(id, { weight = 1, min = 1, max = 1, guaranteed = false } = {}) {
    if (!id) throw new Error('LootTable.add: item id is required');
    this.entries.push({
      id,
      weight: Math.max(0, weight),
      min: Math.max(1, Math.floor(min)),
      max: Math.max(min, Math.floor(max)),
      guaranteed: Boolean(guaranteed)
    });
    return this;
  }

  // Returns an array of { id, count } drops from a single roll.
  roll(rng = Math.random) {
    const results = [];

    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (e.guaranteed) {
        results.push({ id: e.id, count: this._rollQty(e, rng) });
      }
    }

    if (rng() > this.dropChance) return results;

    const weighted = this.entries.filter((e) => !e.guaranteed && e.weight > 0);
    if (weighted.length === 0) return results;

    let totalWeight = 0;
    for (let i = 0; i < weighted.length; i++) totalWeight += weighted[i].weight;

    let pick = rng() * totalWeight;
    for (let i = 0; i < weighted.length; i++) {
      const e = weighted[i];
      pick -= e.weight;
      if (pick <= 0) {
        results.push({ id: e.id, count: this._rollQty(e, rng) });
        break;
      }
    }

    return results;
  }

  // Rolls multiple times and merges identical item IDs into combined stacks.
  rollMultiple(rolls = 3, rng = Math.random) {
    const totals = new Map();
    for (let i = 0; i < rolls; i++) {
      const drops = this.roll(rng);
      for (let j = 0; j < drops.length; j++) {
        const d = drops[j];
        totals.set(d.id, (totals.get(d.id) || 0) + d.count);
      }
    }
    return Array.from(totals.entries(), ([id, count]) => ({ id, count }));
  }

  _rollQty(entry, rng) {
    if (entry.min === entry.max) return entry.min;
    return entry.min + Math.floor(rng() * (entry.max - entry.min + 1));
  }
}