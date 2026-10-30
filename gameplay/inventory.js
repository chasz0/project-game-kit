// Slot-based inventory with stack limits and consumable item handlers.
//
//   const inv = new Inventory({ maxSlots: 8 });
//   inv.defineItem('medkit', { name: 'Medkit', maxStack: 5, onUse: (player) => player.heal(50) });
//   inv.add('medkit', 3);
//   inv.use('medkit', player);

export class Inventory {
  constructor({ maxSlots = 12 } = {}) {
    if (!(maxSlots >= 1)) throw new RangeError('Inventory: maxSlots must be >= 1');
    this.maxSlots = Math.floor(maxSlots);
    this.definitions = new Map();
    this.slots = [];
  }

  get usedSlots() {
    return this.slots.length;
  }

  get freeSlots() {
    return Math.max(0, this.maxSlots - this.slots.length);
  }

  defineItem(id, { name = id, maxStack = 99, consumable = true, onUse = null } = {}) {
    this.definitions.set(id, {
      id,
      name,
      maxStack: Math.max(1, Math.floor(maxStack)),
      consumable: Boolean(consumable),
      onUse
    });
    return this;
  }

  // Adds up to `count` items into existing or free slots. Returns { added, overflow }.
  add(id, count = 1) {
    if (!(count > 0)) return { added: 0, overflow: 0 };
    const def = this.definitions.get(id) || { id, name: id, maxStack: 99, consumable: false };
    let remaining = Math.floor(count);

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot.id === id && slot.count < def.maxStack) {
        const space = def.maxStack - slot.count;
        const transfer = Math.min(space, remaining);
        slot.count += transfer;
        remaining -= transfer;
      }
    }

    while (remaining > 0 && this.slots.length < this.maxSlots) {
      const transfer = Math.min(def.maxStack, remaining);
      this.slots.push({ id, name: def.name, count: transfer, maxStack: def.maxStack });
      remaining -= transfer;
    }

    return { added: count - remaining, overflow: remaining };
  }

  remove(id, count = 1) {
    if (!this.has(id, count)) return false;
    let remaining = Math.floor(count);

    for (let i = this.slots.length - 1; i >= 0 && remaining > 0; i--) {
      const slot = this.slots[i];
      if (slot.id === id) {
        const take = Math.min(slot.count, remaining);
        slot.count -= take;
        remaining -= take;
        if (slot.count === 0) this.slots.splice(i, 1);
      }
    }
    return true;
  }

  count(id) {
    let total = 0;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].id === id) total += this.slots[i].count;
    }
    return total;
  }

  has(id, minCount = 1) {
    return this.count(id) >= minCount;
  }

  use(id, context = null) {
    if (!this.has(id, 1)) return false;
    const def = this.definitions.get(id);
    if (def && def.onUse) {
      def.onUse(context);
    }
    if (!def || def.consumable) {
      this.remove(id, 1);
    }
    return true;
  }

  clear() {
    this.slots.length = 0;
  }
}