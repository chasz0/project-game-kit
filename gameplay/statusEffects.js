// Status effects, stacking buffs/debuffs, DoT/HoT ticks, and crowd control for player and enemies.
//
//   const statuses = new StatusEffectManager();
//   statuses.define('burn', { duration: 3000, maxStacks: 5, tickInterval: 500, onTick: (e, s) => e.stats.takeDamage(4 * s.stacks) });
//   statuses.define('chill', { duration: 2500, maxStacks: 3, stat: 'speed', modType: 'percent', value: -0.2 });
//   statuses.define('stun', { duration: 1200, control: 'stun' });
//   statuses.apply(enemy, 'burn', { stacks: 2 });
//   statuses.apply(player, 'chill');
//   statuses.update(dt);

const VALID_STACK_MODES = new Set(['refresh', 'extend', 'none']);

export class StatusEffectManager {
  constructor() {
    this.definitions = new Map();
    this.entities = new Map();
  }

  get activeEntityCount() {
    return this.entities.size;
  }

  define(id, {
    duration = 2000,
    maxStacks = 1,
    stackMode = 'refresh',
    tickInterval = 0,
    stat = null,
    modType = 'percent',
    value = 0,
    control = null,
    color = '#f3ead3',
    onApply = null,
    onTick = null,
    onExpire = null
  } = {}) {
    if (!id) throw new Error('StatusEffectManager.define: id is required');
    if (!VALID_STACK_MODES.has(stackMode)) {
      throw new Error(`StatusEffectManager.define: invalid stackMode "${stackMode}" (use 'refresh', 'extend', or 'none')`);
    }
    this.definitions.set(id, {
      id,
      duration: Math.max(1, duration),
      maxStacks: Math.max(1, Math.floor(maxStacks)),
      stackMode,
      tickInterval: Math.max(0, tickInterval),
      stat,
      modType,
      value,
      control,
      color,
      onApply,
      onTick,
      onExpire
    });
    return this;
  }

  apply(entity, id, { duration = null, stacks = 1, source = null } = {}) {
    if (!entity) return null;
    const def = this.definitions.get(id);
    if (!def) throw new Error(`StatusEffectManager: unknown effect "${id}"`);

    let map = this.entities.get(entity);
    if (!map) {
      map = new Map();
      this.entities.set(entity, map);
    }

    const dur = duration ?? def.duration;
    let inst = map.get(id);

    if (!inst) {
      inst = {
        id,
        def,
        stacks: Math.min(def.maxStacks, Math.max(1, Math.floor(stacks))),
        duration: dur,
        remaining: dur,
        tickTimer: 0,
        source
      };
      map.set(id, inst);
    } else {
      inst.stacks = Math.min(def.maxStacks, inst.stacks + Math.max(1, Math.floor(stacks)));
      if (source !== null) inst.source = source;

      if (def.stackMode === 'refresh') {
        inst.duration = dur;
        inst.remaining = dur;
      } else if (def.stackMode === 'extend') {
        inst.duration += dur;
        inst.remaining += dur;
      }
    }

    this._syncStatModifier(entity, inst);
    if (def.onApply) def.onApply(entity, inst);
    return inst;
  }

  remove(entity, id) {
    const map = this.entities.get(entity);
    if (!map) return false;
    const inst = map.get(id);
    if (!inst) return false;

    map.delete(id);
    if (map.size === 0) this.entities.delete(entity);

    this._removeStatModifier(entity, inst.def);
    if (inst.def.onExpire) inst.def.onExpire(entity, inst, 'removed');
    return true;
  }

  clearEntity(entity) {
    const map = this.entities.get(entity);
    if (!map) return;
    this.entities.delete(entity);
    for (const inst of map.values()) {
      this._removeStatModifier(entity, inst.def);
      if (inst.def.onExpire) inst.def.onExpire(entity, inst, 'cleared');
    }
    map.clear();
  }

  clearAll() {
    const entries = Array.from(this.entities.entries());
    this.entities.clear();
    for (let i = 0; i < entries.length; i++) {
      const [entity, map] = entries[i];
      for (const inst of map.values()) {
        this._removeStatModifier(entity, inst.def);
        if (inst.def.onExpire) inst.def.onExpire(entity, inst, 'cleared');
      }
      map.clear();
    }
  }

  has(entity, id) {
    const map = this.entities.get(entity);
    return Boolean(map && map.has(id));
  }

  getStacks(entity, id) {
    const map = this.entities.get(entity);
    if (!map) return 0;
    const inst = map.get(id);
    return inst ? inst.stacks : 0;
  }

  isStunned(entity) {
    return this._hasControl(entity, 'stun');
  }

  isRooted(entity) {
    return this._hasControl(entity, 'root') || this._hasControl(entity, 'stun');
  }

  isSilenced(entity) {
    return this._hasControl(entity, 'silence') || this._hasControl(entity, 'stun');
  }

  getStatMultiplier(entity, statName) {
    const map = this.entities.get(entity);
    if (!map) return 1;
    let percent = 1;
    for (const inst of map.values()) {
      if (inst.def.stat === statName && inst.def.modType === 'percent') {
        percent += inst.def.value * inst.stacks;
      }
    }
    return Math.max(0, percent);
  }

  getEffects(entity, out = []) {
    out.length = 0;
    const map = this.entities.get(entity);
    if (!map) return out;

    for (const inst of map.values()) {
      out.push({
        id: inst.id,
        stacks: inst.stacks,
        remaining: inst.remaining,
        duration: inst.duration,
        ratio: inst.duration > 0 ? inst.remaining / inst.duration : 0,
        control: inst.def.control,
        color: inst.def.color
      });
    }
    return out;
  }

  update(dt) {
    for (const [entity, map] of this.entities.entries()) {
      const stats = this._resolveStats(entity);
      if (stats && stats.dead) {
        this.clearEntity(entity);
        continue;
      }

      for (const [id, inst] of map.entries()) {
        const def = inst.def;

        if (def.tickInterval > 0 && def.onTick) {
          inst.tickTimer += dt;
          while (inst.tickTimer >= def.tickInterval) {
            inst.tickTimer -= def.tickInterval;
            def.onTick(entity, inst);
          }
        }

        inst.remaining -= dt;
        if (inst.remaining <= 0) {
          map.delete(id);
          this._removeStatModifier(entity, def);
          if (def.onExpire) def.onExpire(entity, inst, 'expired');
        }
      }

      if (map.size === 0) {
        this.entities.delete(entity);
      }
    }
  }

  _hasControl(entity, type) {
    const map = this.entities.get(entity);
    if (!map) return false;
    for (const inst of map.values()) {
      if (inst.def.control === type) return true;
    }
    return false;
  }

  _resolveStats(entity) {
    if (!entity) return null;
    if (entity.stats && typeof entity.stats.addModifier === 'function') return entity.stats;
    if (typeof entity.addModifier === 'function') return entity;
    return null;
  }

  _syncStatModifier(entity, inst) {
    const def = inst.def;
    if (!def.stat) return;
    const stats = this._resolveStats(entity);
    if (!stats) return;
    stats.addModifier(`status_${def.id}`, def.stat, def.modType, def.value * inst.stacks);
  }

  _removeStatModifier(entity, def) {
    if (!def.stat) return;
    const stats = this._resolveStats(entity);
    if (!stats) return;
    stats.removeModifier(`status_${def.id}`);
  }
}