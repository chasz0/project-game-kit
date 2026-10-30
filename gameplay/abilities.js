// Cooldown, charge, active duration, and auto-cast manager for weapons and skills.
//
//   const abilities = new AbilityManager();
//   abilities.register('dash', { cooldown: 1800, charges: 2, duration: 200, onUse: () => {} });
//   abilities.use('dash', player, 0.8); // 0.8 = 20% cooldown reduction
//   abilities.update(dt, player);

export class AbilityManager {
  constructor() {
    this.abilities = new Map();
  }

  register(id, {
    cooldown = 1000,
    charges = 1,
    duration = 0,
    auto = false,
    onUse = null,
    onEnd = null
  } = {}) {
    if (!(cooldown >= 0) || !(charges >= 1)) {
      throw new RangeError(`AbilityManager: invalid cooldown or charges for "${id}"`);
    }

    this.abilities.set(id, {
      id,
      cooldown,
      maxCharges: Math.floor(charges),
      charges: Math.floor(charges),
      timer: 0,
      currentCooldown: cooldown,
      duration,
      activeTimer: 0,
      isActive: false,
      auto: Boolean(auto),
      onUse,
      onEnd
    });
    return this;
  }

  canUse(id) {
    const a = this.abilities.get(id);
    return Boolean(a && a.charges > 0);
  }

  // Triggers the ability if a charge is available. cooldownScale < 1 speeds up recharge.
  use(id, context = null, cooldownScale = 1) {
    const a = this.abilities.get(id);
    if (!a || a.charges <= 0) return false;

    const scaledCd = Math.max(0, a.cooldown * Math.max(0.05, cooldownScale));

    if (a.charges === a.maxCharges) {
      a.currentCooldown = scaledCd;
      a.timer = scaledCd;
    } else {
      a.currentCooldown = scaledCd;
    }

    a.charges--;

    if (a.duration > 0) {
      a.isActive = true;
      a.activeTimer = a.duration;
    }

    if (a.onUse) a.onUse(context, a);
    return true;
  }

  update(dt, context = null, cooldownScale = 1) {
    for (const a of this.abilities.values()) {
      if (a.isActive) {
        a.activeTimer -= dt;
        if (a.activeTimer <= 0) {
          a.activeTimer = 0;
          a.isActive = false;
          if (a.onEnd) a.onEnd(context, a);
        }
      }

      if (a.charges < a.maxCharges) {
        a.timer -= dt;
        while (a.timer <= 0 && a.charges < a.maxCharges) {
          a.charges++;
          if (a.charges < a.maxCharges) {
            a.currentCooldown = Math.max(1, a.cooldown * Math.max(0.05, cooldownScale));
            a.timer += a.currentCooldown;
          } else {
            a.timer = 0;
          }
        }
      }

      if (a.auto && a.charges > 0) {
        this.use(a.id, context, cooldownScale);
      }
    }
  }

  getState(id) {
    const a = this.abilities.get(id);
    if (!a) return null;
    return {
      id: a.id,
      ready: a.charges > 0,
      charges: a.charges,
      maxCharges: a.maxCharges,
      cooldownLeft: Math.max(0, a.timer),
      cooldownRatio: a.charges < a.maxCharges && a.currentCooldown > 0
        ? Math.max(0, Math.min(1, a.timer / a.currentCooldown))
        : 0,
      isActive: a.isActive,
      activeLeft: a.activeTimer
    };
  }

  reset() {
    for (const a of this.abilities.values()) {
      a.charges = a.maxCharges;
      a.timer = 0;
      a.activeTimer = 0;
      a.isActive = false;
    }
  }
}