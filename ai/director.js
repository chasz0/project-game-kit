export class SwarmDirector {
  constructor({
    rng = Math.random,
    maxActive = 120,
    baseCreditRate = 3.5,
    spawnInterval = 1400,
    buildupDuration = 14000,
    peakDuration = 4500,
    breatherDuration = 4000,
    peakThreshold = 0.82,
    rings = [
      { radius: 46, slots: 8 },
      { radius: 105, slots: 16 },
      { radius: 170, slots: 24 }
    ]
  } = {}) {
    this.rng = rng;
    this.maxActive = Math.max(1, maxActive);
    this.baseCreditRate = Math.max(0.1, baseCreditRate);
    this.spawnInterval = Math.max(100, spawnInterval);
    this.buildupDuration = buildupDuration;
    this.peakDuration = peakDuration;
    this.breatherDuration = breatherDuration;
    this.peakThreshold = peakThreshold;

    this.roster = [];
    this.phase = 'buildup';
    this.phaseTimer = 0;
    this.waveNumber = 1;
    this.credits = 6;
    this.spawnTimer = 0;
    this.intensity = 0;
    this.damageStress = 0;
    this.totalSpawned = 0;
    this._tickId = 1;
    this._agentSlots = new WeakMap();

    this.rings = rings.map((r) => {
      const count = Math.max(4, Math.floor(r.slots));
      return {
        radius: r.radius,
        slots: count,
        occupied: new Uint8Array(count),
        owners: new Array(count).fill(null)
      };
    });
  }

  registerEnemy(id, { cost = 1, weight = 1, minWave = 1, elite = false } = {}) {
    if (!id) throw new Error('SwarmDirector.registerEnemy: id is required');
    this.roster.push({
      id,
      cost: Math.max(1, cost),
      weight: Math.max(0, weight),
      minWave: Math.max(1, minWave),
      elite: Boolean(elite)
    });
    return this;
  }

  recordPlayerDamage(amount = 10) {
    this.damageStress = Math.min(0.45, this.damageStress + Math.max(0, amount) * 0.008);
  }

  recordKill() {
    this.damageStress = Math.max(0, this.damageStress - 0.012);
  }

  releaseSlot(agent) {
    const prev = this._agentSlots.get(agent);
    if (!prev) return;
    const ring = this.rings[prev.ringIndex];
    if (ring && ring.owners[prev.slotIndex] === agent) {
      ring.owners[prev.slotIndex] = null;
      ring.occupied[prev.slotIndex] = 0;
    }
    this._agentSlots.delete(agent);
  }

  clearSlots() {
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].occupied.fill(0);
      this.rings[i].owners.fill(null);
    }
    this._agentSlots = new WeakMap();
  }

  _pruneStaleSlots() {
    const minTick = this._tickId - 1;
    for (let rIdx = 0; rIdx < this.rings.length; rIdx++) {
      const ring = this.rings[rIdx];
      for (let s = 0; s < ring.slots; s++) {
        const owner = ring.owners[s];
        if (!owner) {
          ring.occupied[s] = 0;
          continue;
        }
        const meta = this._agentSlots.get(owner);
        if (!meta || meta.lastTick < minTick) {
          ring.owners[s] = null;
          ring.occupied[s] = 0;
        } else {
          ring.occupied[s] = 1;
        }
      }
    }
  }

  assignSlot(agent, targetX, targetY, out = { x: 0, y: 0, ringIndex: 0, slotIndex: 0 }) {
    const dx = agent.x - targetX;
    const dy = agent.y - targetY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.rings.length === 0 || dist < this.rings[0].radius * 0.75) {
      this.releaseSlot(agent);
      out.x = targetX;
      out.y = targetY;
      out.ringIndex = 0;
      out.slotIndex = 0;
      return out;
    }

    const angle = Math.atan2(dy, dx);
    const normAngle = angle < 0 ? angle + Math.PI * 2 : angle;

    const prev = this._agentSlots.get(agent);
    if (prev) {
      const ring = this.rings[prev.ringIndex];
      if (ring && ring.owners[prev.slotIndex] === agent) {
        const count = ring.slots;
        const step = (Math.PI * 2) / count;
        const baseIdx = Math.round(normAngle / step) % count;
        const diff = Math.abs(baseIdx - prev.slotIndex);
        const angularDiff = Math.min(diff, count - diff);
        if (angularDiff <= 1) {
          prev.lastTick = this._tickId;
          ring.occupied[prev.slotIndex] = 1;
          const slotAngle = prev.slotIndex * step;
          out.x = targetX + Math.cos(slotAngle) * ring.radius;
          out.y = targetY + Math.sin(slotAngle) * ring.radius;
          out.ringIndex = prev.ringIndex;
          out.slotIndex = prev.slotIndex;
          return out;
        }
      }
      this.releaseSlot(agent);
    }

    for (let rIdx = 0; rIdx < this.rings.length; rIdx++) {
      const ring = this.rings[rIdx];
      const count = ring.slots;
      const step = (Math.PI * 2) / count;
      const baseIdx = Math.round(normAngle / step) % count;
      const maxOffset = Math.floor(count / 2);

      for (let offset = 0; offset <= maxOffset; offset++) {
        const passes = offset === 0 ? 1 : 2;
        for (let p = 0; p < passes; p++) {
          const delta = p === 0 ? offset : -offset;
          const slotIdx = (baseIdx + delta + count) % count;
          if (ring.occupied[slotIdx] === 0) {
            ring.occupied[slotIdx] = 1;
            ring.owners[slotIdx] = agent;
            this._agentSlots.set(agent, {
              ringIndex: rIdx,
              slotIndex: slotIdx,
              lastTick: this._tickId
            });
            const slotAngle = slotIdx * step;
            out.x = targetX + Math.cos(slotAngle) * ring.radius;
            out.y = targetY + Math.sin(slotAngle) * ring.radius;
            out.ringIndex = rIdx;
            out.slotIndex = slotIdx;
            return out;
          }
        }
      }
    }

    out.x = targetX + (dx / (dist || 1)) * this.rings[0].radius;
    out.y = targetY + (dy / (dist || 1)) * this.rings[0].radius;
    out.ringIndex = this.rings.length - 1;
    out.slotIndex = 0;
    return out;
  }

  update(dt, {
    playerX = 0,
    playerY = 0,
    activeCount = 0,
    minRadius = 400,
    maxRadius = 560,
    onSpawn = null
  } = {}) {
    this._tickId++;
    this._pruneStaleSlots();

    const dtSec = dt / 1000;
    this.phaseTimer += dt;
    this.damageStress = Math.max(0, this.damageStress - dtSec * 0.03);

    const crowdRatio = Math.min(1, activeCount / this.maxActive);
    const timeFactor = this.phase === 'buildup'
      ? Math.min(0.45, (this.phaseTimer / this.buildupDuration) * 0.45)
      : (this.phase === 'peak' ? 0.35 : 0);

    this.intensity = Math.max(0, Math.min(1, crowdRatio * 0.55 + this.damageStress + timeFactor));

    const waveScale = 1 + (this.waveNumber - 1) * 0.18;
    let spawnedNow = 0;

    if (this.phase === 'buildup') {
      this.credits += this.baseCreditRate * waveScale * dtSec;
      if (this.intensity >= this.peakThreshold || this.phaseTimer >= this.buildupDuration) {
        spawnedNow += this._enterPeak(playerX, playerY, activeCount, minRadius, maxRadius, onSpawn);
      }
    } else if (this.phase === 'peak') {
      this.credits += this.baseCreditRate * waveScale * 1.6 * dtSec;
      if (this.phaseTimer >= this.peakDuration) {
        this.phase = 'breather';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'breather') {
      if (this.phaseTimer >= this.breatherDuration || (activeCount === 0 && this.phaseTimer >= 1200)) {
        this.phase = 'buildup';
        this.phaseTimer = 0;
        this.waveNumber++;
        this.credits += 4 * waveScale;
      }
    }

    if (this.phase !== 'breather') {
      this.spawnTimer += dt;
      const interval = this.phase === 'peak' ? this.spawnInterval * 0.55 : this.spawnInterval;

      while (this.spawnTimer >= interval) {
        this.spawnTimer -= interval;
        spawnedNow += this._spendCredits(playerX, playerY, activeCount + spawnedNow, minRadius, maxRadius, onSpawn, false);
      }
    }

    return spawnedNow;
  }

  reset() {
    this.phase = 'buildup';
    this.phaseTimer = 0;
    this.waveNumber = 1;
    this.credits = 6;
    this.spawnTimer = 0;
    this.intensity = 0;
    this.damageStress = 0;
    this.totalSpawned = 0;
    this._tickId = 1;
    this.clearSlots();
  }

  _enterPeak(playerX, playerY, activeCount, minRadius, maxRadius, onSpawn) {
    this.phase = 'peak';
    this.phaseTimer = 0;
    this.credits += 6 + this.waveNumber * 2;
    return this._spendCredits(playerX, playerY, activeCount, minRadius, maxRadius, onSpawn, true);
  }

  _spendCredits(cx, cy, currentActive, minR, maxR, onSpawn, allowElite) {
    if (this.roster.length === 0 || currentActive >= this.maxActive) return 0;

    const available = this.roster.filter((r) =>
      r.minWave <= this.waveNumber &&
      r.cost <= this.credits &&
      r.weight > 0 &&
      (allowElite || !r.elite || this.phase === 'peak')
    );

    if (available.length === 0) return 0;

    let spawned = 0;
    const maxBatch = this.phase === 'peak' ? 7 : 4;

    while (spawned < maxBatch && currentActive + spawned < this.maxActive) {
      const affordable = available.filter((r) => r.cost <= this.credits);
      if (affordable.length === 0) break;

      const pick = this._pickWeighted(affordable);
      this.credits -= pick.cost;
      this.totalSpawned++;
      spawned++;

      if (onSpawn) {
        const angle = this.rng() * Math.PI * 2;
        const r = minR + this.rng() * (maxR - minR);
        onSpawn({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          type: pick.id,
          elite: pick.elite,
          wave: this.waveNumber,
          phase: this.phase
        });
      }
    }

    return spawned;
  }

  _pickWeighted(list) {
    let total = 0;
    for (let i = 0; i < list.length; i++) total += list[i].weight;
    let roll = this.rng() * total;
    for (let i = 0; i < list.length; i++) {
      roll -= list[i].weight;
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }
}