// Swarm weapon patterns, projectile behaviors (linear, boomerang, homing, ricochet),
// rotating orbiters, and ticking ground hazard zones.
//
//   const weapons = new WeaponSystem();
//   weapons.fire(x, y, aimAngle, { count: 5, spread: 0.45, behavior: 'ricochet', bounces: 3 });
//   weapons.setOrbiters(player, { count: 3, radius: 64, damage: 15 });
//   weapons.spawnZone(x, y, { r: 80, duration: 4000, tickInterval: 400, onTick: (target) => {} });
//   weapons.update(dt, { spatialHash, player, tilemap, onHit });

import { Pool } from './pool.js';
import { collision } from './collision.js';

export class WeaponSystem {
  constructor({ maxProjectiles = 800, maxZones = 50 } = {}) {
    this.projectiles = [];
    this.zones = [];
    this.orbitGroups = new Map();
    this._queryScratch = [];

    this.projectilePool = new Pool({
      create: () => ({
        x: 0, y: 0, vx: 0, vy: 0,
        speed: 500, angle: 0, r: 4,
        damage: 10, life: 0, maxLife: 1000,
        pierce: 0, bounces: 0, bounceRange: 180,
        turnRate: 6, homingRange: 260,
        behavior: 'linear', team: 'player',
        owner: null, color: '#f3ead3', shape: 'bolt',
        onHit: null, hitSet: new Set()
      }),
      init: (p, x, y, angle, cfg) => {
        p.x = x;
        p.y = y;
        p.speed = cfg.speed ?? 520;
        p.angle = angle;
        p.vx = Math.cos(angle) * p.speed;
        p.vy = Math.sin(angle) * p.speed;
        p.r = cfg.r ?? 4;
        p.damage = cfg.damage ?? 15;
        p.maxLife = cfg.life ?? 1200;
        p.life = p.maxLife;
        p.pierce = cfg.pierce ?? 0;
        p.bounces = cfg.bounces ?? 0;
        p.bounceRange = cfg.bounceRange ?? 190;
        p.turnRate = cfg.turnRate ?? 7;
        p.homingRange = cfg.homingRange ?? 280;
        p.behavior = cfg.behavior ?? 'linear';
        p.team = cfg.team ?? 'player';
        p.owner = cfg.owner ?? null;
        p.color = cfg.color ?? '#f3ead3';
        p.shape = cfg.shape ?? 'bolt';
        p.onHit = cfg.onHit ?? null;
        p.hitSet.clear();
      },
      reset: (p) => {
        p.hitSet.clear();
        p.owner = null;
        p.onHit = null;
      },
      size: 120,
      maxSize: maxProjectiles
    });

    this.zonePool = new Pool({
      create: () => ({
        x: 0, y: 0, r: 70,
        life: 0, maxLife: 3000,
        tickInterval: 400, tickTimer: 0,
        team: 'player', color: '#78b0d9',
        onTick: null
      }),
      init: (z, x, y, cfg) => {
        z.x = x;
        z.y = y;
        z.r = cfg.r ?? 75;
        z.maxLife = cfg.duration ?? 3500;
        z.life = z.maxLife;
        z.tickInterval = Math.max(50, cfg.tickInterval ?? 400);
        z.tickTimer = z.tickInterval;
        z.team = cfg.team ?? 'player';
        z.color = cfg.color ?? '#78b0d9';
        z.onTick = cfg.onTick ?? null;
      },
      reset: (z) => {
        z.onTick = null;
      },
      size: 12,
      maxSize: maxZones
    });
  }

  get activeProjectileCount() {
    return this.projectiles.length;
  }

  get activeZoneCount() {
    return this.zones.length;
  }

  fire(x, y, aimAngle, config = {}) {
    const count = Math.max(1, Math.floor(config.count ?? 1));
    const spread = config.spread ?? 0;
    const fullCircle = spread >= Math.PI * 1.999;
    const startAngle = fullCircle ? aimAngle : aimAngle - spread * 0.5;
    const step = count > 1
      ? (fullCircle ? (Math.PI * 2) / count : spread / (count - 1))
      : 0;

    for (let i = 0; i < count; i++) {
      const a = count === 1 ? aimAngle : startAngle + i * step;
      this.projectiles.push(this.projectilePool.get(x, y, a, config));
    }
    return count;
  }

  setOrbiters(owner, {
    count = 3,
    radius = 60,
    speed = 3.2,
    r = 7,
    damage = 14,
    hitCooldown = 350,
    team = 'player',
    color = '#d9b978',
    onHit = null
  } = {}) {
    if (count <= 0) {
      this.orbitGroups.delete(owner);
      return;
    }
    this.orbitGroups.set(owner, {
      owner,
      count: Math.floor(count),
      radius,
      speed,
      r,
      damage,
      hitCooldown,
      team,
      color,
      onHit,
      angle: 0,
      cooldowns: new Map()
    });
  }

  removeOrbiters(owner) {
    this.orbitGroups.delete(owner);
  }

  spawnZone(x, y, config = {}) {
    const z = this.zonePool.get(x, y, config);
    this.zones.push(z);
    return z;
  }

  clear() {
    while (this.projectiles.length > 0) {
      this.projectilePool.release(this.projectiles.pop());
    }
    while (this.zones.length > 0) {
      this.zonePool.release(this.zones.pop());
    }
    this.orbitGroups.clear();
  }

  update(dt, {
    spatialHash = null,
    player = null,
    obstacles = null,
    tilemap = null,
    boundsHalf = Infinity,
    onHit = null
  } = {}) {
    const dtSec = dt / 1000;
    const playerCircle = player
      ? { x: player.pos ? player.pos.x : player.x, y: player.pos ? player.pos.y : player.y, r: player.r ?? 14, ref: player }
      : null;

    // Update active hazard zones
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.life <= 0) {
        this.zonePool.release(z);
        this.zones.splice(i, 1);
        continue;
      }

      z.tickTimer += dt;
      while (z.tickTimer >= z.tickInterval) {
        z.tickTimer -= z.tickInterval;
        if (!z.onTick) continue;

        if (z.team === 'player' && spatialHash) {
          spatialHash.queryRadius(z.x, z.y, z.r + 24, this._queryScratch);
          for (let j = 0; j < this._queryScratch.length; j++) {
            const e = this._queryScratch[j];
            if ((!e.stats || !e.stats.dead) && collision.circleCircle(z, e)) {
              z.onTick(e, z);
            }
          }
        } else if (z.team === 'enemy' && playerCircle) {
          if (collision.circleCircle(z, playerCircle)) {
            z.onTick(playerCircle.ref, z);
          }
        }
      }
    }

    // Update orbiting blades
    for (const group of this.orbitGroups.values()) {
      group.angle += group.speed * dtSec;

      for (const [target, cd] of group.cooldowns.entries()) {
        if (cd - dt <= 0) group.cooldowns.delete(target);
        else group.cooldowns.set(target, cd - dt);
      }

      const ox = group.owner.pos ? group.owner.pos.x : group.owner.x;
      const oy = group.owner.pos ? group.owner.pos.y : group.owner.y;
      const stepAngle = (Math.PI * 2) / group.count;

      for (let i = 0; i < group.count; i++) {
        const a = group.angle + i * stepAngle;
        const blade = {
          x: ox + Math.cos(a) * group.radius,
          y: oy + Math.sin(a) * group.radius,
          r: group.r,
          damage: group.damage,
          team: group.team
        };

        if (group.team === 'player' && spatialHash) {
          spatialHash.queryRadius(blade.x, blade.y, blade.r + 24, this._queryScratch);
          for (let j = 0; j < this._queryScratch.length; j++) {
            const e = this._queryScratch[j];
            if ((e.stats && e.stats.dead) || group.cooldowns.has(e)) continue;
            if (collision.circleCircle(blade, e)) {
              group.cooldowns.set(e, group.hitCooldown);
              if (group.onHit) group.onHit(e, blade);
              if (onHit) onHit(e, blade);
            }
          }
        } else if (group.team === 'enemy' && playerCircle && !group.cooldowns.has(playerCircle.ref)) {
          if (collision.circleCircle(blade, playerCircle)) {
            group.cooldowns.set(playerCircle.ref, group.hitCooldown);
            if (group.onHit) group.onHit(playerCircle.ref, blade);
            if (onHit) onHit(playerCircle.ref, blade);
          }
        }
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      if (p.life <= 0 || Math.abs(p.x) > boundsHalf || Math.abs(p.y) > boundsHalf) {
        this.projectilePool.release(p);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.behavior === 'boomerang' && p.owner) {
        const progress = 1 - p.life / p.maxLife;
        if (progress > 0.45) {
          const ox = p.owner.pos ? p.owner.pos.x : p.owner.x;
          const oy = p.owner.pos ? p.owner.pos.y : p.owner.y;
          const dx = ox - p.x;
          const dy = oy - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 18 && progress > 0.6) {
            this.projectilePool.release(p);
            this.projectiles.splice(i, 1);
            continue;
          }
          p.vx = (dx / d) * p.speed * 1.15;
          p.vy = (dy / d) * p.speed * 1.15;
          p.angle += dtSec * 14;
        } else {
          const slow = 1 - (progress / 0.45) * 0.85;
          p.vx = Math.cos(p.angle) * p.speed * slow;
          p.vy = Math.sin(p.angle) * p.speed * slow;
        }
      } else if (p.behavior === 'homing') {
        const target = this._findClosestTarget(p, spatialHash, playerCircle, p.homingRange);
        if (target) {
          const desired = Math.atan2(target.y - p.y, target.x - p.x);
          let diff = desired - p.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = p.turnRate * dtSec;
          p.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
          p.vx = Math.cos(p.angle) * p.speed;
          p.vy = Math.sin(p.angle) * p.speed;
        }
      }

      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;

      let hitWall = false;
      if (tilemap && tilemap.isSolidAtWorld(p.x, p.y)) {
        hitWall = true;
      } else if (obstacles) {
        for (let j = 0; j < obstacles.length; j++) {
          if (collision.circleBox(p, obstacles[j])) {
            hitWall = true;
            break;
          }
        }
      }

      if (hitWall && p.behavior !== 'boomerang') {
        this.projectilePool.release(p);
        this.projectiles.splice(i, 1);
        continue;
      }

      let destroyProjectile = false;

      if (p.team === 'player' && spatialHash) {
        spatialHash.queryRadius(p.x, p.y, p.r + 24, this._queryScratch);
        for (let j = 0; j < this._queryScratch.length; j++) {
          const e = this._queryScratch[j];
          if ((e.stats && e.stats.dead) || p.hitSet.has(e)) continue;

          if (collision.circleCircle(p, e)) {
            p.hitSet.add(e);
            if (p.onHit) p.onHit(e, p);
            if (onHit) onHit(e, p);

            if (p.behavior === 'ricochet' && p.bounces > 0) {
              p.bounces--;
              const nextTarget = this._findClosestTarget(p, spatialHash, null, p.bounceRange);
              if (nextTarget) {
                p.angle = Math.atan2(nextTarget.y - p.y, nextTarget.x - p.x);
                p.vx = Math.cos(p.angle) * p.speed;
                p.vy = Math.sin(p.angle) * p.speed;
              } else {
                destroyProjectile = true;
              }
              break;
            } else if (p.behavior === 'boomerang') {
              continue;
            } else if (p.pierce > 0) {
              p.pierce--;
            } else {
              destroyProjectile = true;
              break;
            }
          }
        }
      } else if (p.team === 'enemy' && playerCircle) {
        if (!p.hitSet.has(playerCircle.ref) && collision.circleCircle(p, playerCircle)) {
          p.hitSet.add(playerCircle.ref);
          if (p.onHit) p.onHit(playerCircle.ref, p);
          if (onHit) onHit(playerCircle.ref, p);
          destroyProjectile = true;
        }
      }

      if (destroyProjectile) {
        this.projectilePool.release(p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    // Draw hazard zones
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      const alpha = Math.min(1, z.life / 400);
      ctx.save();
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw orbiters
    for (const group of this.orbitGroups.values()) {
      const ox = group.owner.pos ? group.owner.pos.x : group.owner.x;
      const oy = group.owner.pos ? group.owner.pos.y : group.owner.y;
      const stepAngle = (Math.PI * 2) / group.count;

      ctx.save();
      ctx.strokeStyle = 'rgba(243, 234, 211, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ox, oy, group.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = group.color;
      for (let i = 0; i < group.count; i++) {
        const a = group.angle + i * stepAngle;
        const bx = ox + Math.cos(a) * group.radius;
        const by = oy + Math.sin(a) * group.radius;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + Math.PI * 0.5);
        ctx.beginPath();
        ctx.moveTo(group.r + 3, 0);
        ctx.lineTo(0, -group.r * 0.7);
        ctx.lineTo(-group.r - 3, 0);
        ctx.lineTo(0, group.r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Draw projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;

      if (p.behavior === 'boomerang') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-p.r, -p.r);
        ctx.lineTo(p.r, 0);
        ctx.lineTo(-p.r, p.r);
        ctx.stroke();
      } else if (p.behavior === 'ricochet') {
        ctx.beginPath();
        ctx.moveTo(p.r + 2, 0);
        ctx.lineTo(0, -p.r);
        ctx.lineTo(-p.r - 2, 0);
        ctx.lineTo(0, p.r);
        ctx.closePath();
        ctx.fill();
      } else if (p.team === 'enemy') {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.r * 1.4, -p.r * 0.5, p.r * 2.8, p.r);
      }

      ctx.restore();
    }
  }

  _findClosestTarget(proj, spatialHash, playerCircle, maxRange) {
    if (proj.team === 'enemy' && playerCircle) {
      const dSq = (playerCircle.x - proj.x) ** 2 + (playerCircle.y - proj.y) ** 2;
      return dSq <= maxRange * maxRange ? playerCircle : null;
    }
    if (!spatialHash) return null;

    spatialHash.queryRadius(proj.x, proj.y, maxRange, this._queryScratch);
    let best = null;
    let bestDistSq = maxRange * maxRange;

    for (let i = 0; i < this._queryScratch.length; i++) {
      const e = this._queryScratch[i];
      if ((e.stats && e.stats.dead) || proj.hitSet.has(e)) continue;
      const dSq = (e.x - proj.x) ** 2 + (e.y - proj.y) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = e;
      }
    }
    return best;
  }
}