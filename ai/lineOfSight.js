// Raycasting, visibility polygons, and field-of-view sensors for player and AI sight.
//
//   const visibleEnemies = lineOfSight.filterVisible(player, aimAngle, enemies, 260, Math.PI * 0.6, walls);
//   const poly = lineOfSight.castVisionPolygon(player, aimAngle, Math.PI * 0.6, 260, 64, walls);

export const lineOfSight = {
  rayBox(x1, y1, x2, y2, box, out = null) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    let tmin = 0;
    let tmax = 1;
    let hitNx = 0;
    let hitNy = 0;

    if (Math.abs(dx) < 1e-8) {
      if (x1 < box.x || x1 > box.x + box.w) return out ? null : false;
    } else {
      const invX = 1 / dx;
      let t1 = (box.x - x1) * invX;
      let t2 = (box.x + box.w - x1) * invX;
      let nx = -1;
      if (t1 > t2) {
        const tmp = t1; t1 = t2; t2 = tmp;
        nx = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        hitNx = nx;
        hitNy = 0;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return out ? null : false;
    }

    if (Math.abs(dy) < 1e-8) {
      if (y1 < box.y || y1 > box.y + box.h) return out ? null : false;
    } else {
      const invY = 1 / dy;
      let t1 = (box.y - y1) * invY;
      let t2 = (box.y + box.h - y1) * invY;
      let ny = -1;
      if (t1 > t2) {
        const tmp = t1; t1 = t2; t2 = tmp;
        ny = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        hitNx = 0;
        hitNy = ny;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return out ? null : false;
    }

    if (!out) return true;

    out.t = tmin;
    out.x = x1 + dx * tmin;
    out.y = y1 + dy * tmin;
    out.nx = hitNx;
    out.ny = hitNy;
    return out;
  },

  rayCircle(x1, y1, x2, y2, circle, out = null) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - circle.x;
    const fy = y1 - circle.y;

    const a = dx * dx + dy * dy;
    if (a === 0) return out ? null : false;

    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circle.r * circle.r;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return out ? null : false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    const t = t1 >= 0 && t1 <= 1 ? t1 : (t2 >= 0 && t2 <= 1 ? 0 : -1);
    if (t < 0) return out ? null : false;

    if (!out) return true;

    out.t = t;
    out.x = x1 + dx * t;
    out.y = y1 + dy * t;
    const nx = out.x - circle.x;
    const ny = out.y - circle.y;
    const len = Math.sqrt(nx * nx + ny * ny) || 1;
    out.nx = nx / len;
    out.ny = ny / len;
    return out;
  },

  hasLineOfSight(a, b, obstacles = []) {
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const blocked = obs.r !== undefined
        ? this.rayCircle(a.x, a.y, b.x, b.y, obs, null)
        : this.rayBox(a.x, a.y, b.x, b.y, obs, null);
      if (blocked) return false;
    }
    return true;
  },

  raycast(x1, y1, x2, y2, obstacles = [], out = { t: 1, x: x2, y: y2, nx: 0, ny: 0, obstacle: null }) {
    let bestT = Infinity;
    let bestObstacle = null;
    let bestX = x2, bestY = y2, bestNx = 0, bestNy = 0;
    const scratch = { t: 0, x: 0, y: 0, nx: 0, ny: 0 };

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const hit = obs.r !== undefined
        ? this.rayCircle(x1, y1, x2, y2, obs, scratch)
        : this.rayBox(x1, y1, x2, y2, obs, scratch);

      if (hit && hit.t < bestT) {
        bestT = hit.t;
        bestX = hit.x;
        bestY = hit.y;
        bestNx = hit.nx;
        bestNy = hit.ny;
        bestObstacle = obs;
      }
    }

    if (!bestObstacle) return null;

    out.t = bestT;
    out.x = bestX;
    out.y = bestY;
    out.nx = bestNx;
    out.ny = bestNy;
    out.obstacle = bestObstacle;
    return out;
  },

  inVisionCone(observer, facingAngle, target, maxRange, fovAngle, obstacles = null) {
    const dx = target.x - observer.x;
    const dy = target.y - observer.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > maxRange * maxRange) return false;
    if (distSq === 0) return true;

    if (fovAngle < Math.PI * 1.999) {
      const dist = Math.sqrt(distSq);
      const dirX = Math.cos(facingAngle);
      const dirY = Math.sin(facingAngle);
      const dot = (dx / dist) * dirX + (dy / dist) * dirY;
      if (dot < Math.cos(fovAngle * 0.5)) return false;
    }

    if (obstacles && !this.hasLineOfSight(observer, target, obstacles)) return false;
    return true;
  },

  // Filters an array of targets and returns only those visible to the observer.
  filterVisible(observer, facingAngle, targets, maxRange, fovAngle, obstacles = [], out = []) {
    out.length = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (this.inVisionCone(observer, facingAngle, t, maxRange, fovAngle, obstacles)) {
        out.push(t);
      }
    }
    return out;
  },

  // Casts a fan of rays to build a player visibility polygon clipped against obstacles.
  castVisionPolygon(origin, facingAngle, fovAngle, maxRange, rayCount = 60, obstacles = [], outPoints = []) {
    outPoints.length = 0;
    const fullCircle = fovAngle >= Math.PI * 1.999;
    const startAngle = fullCircle ? 0 : facingAngle - fovAngle * 0.5;
    const steps = Math.max(2, rayCount);
    const stepAngle = fullCircle ? (Math.PI * 2) / steps : fovAngle / (steps - 1);
    const hitScratch = { t: 1, x: 0, y: 0, nx: 0, ny: 0, obstacle: null };

    for (let i = 0; i < steps; i++) {
      const angle = startAngle + i * stepAngle;
      const endX = origin.x + Math.cos(angle) * maxRange;
      const endY = origin.y + Math.sin(angle) * maxRange;
      const hit = this.raycast(origin.x, origin.y, endX, endY, obstacles, hitScratch);

      if (hit) {
        outPoints.push({ x: hit.x, y: hit.y, hit: true });
      } else {
        outPoints.push({ x: endX, y: endY, hit: false });
      }
    }
    return outPoints;
  }
};