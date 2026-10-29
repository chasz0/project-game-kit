// Raycasting, visibility checks, and field-of-view sensors for AI perception.
//
//   const canSee = lineOfSight.hasLineOfSight(enemy, player, obstacles);
//   const hit = lineOfSight.raycast(x1, y1, x2, y2, obstacles, hitInfo);

export const lineOfSight = {
  // Segment (x1,y1)->(x2,y2) vs top-left box {x, y, w, h}.
  // Returns boolean if `out` is omitted, or fills `out = { t, x, y, nx, ny }` on hit.
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

  // Segment (x1,y1)->(x2,y2) vs center circle {x, y, r}.
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

  // Returns true if no obstacle in `obstacles` blocks the segment between a and b.
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

  // Finds the closest intersection along segment (x1,y1)->(x2,y2) across all obstacles.
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

  // Checks if target is within maxRange, inside fovAngle (radians), and unoccluded.
  inVisionCone(observer, facingAngle, target, maxRange, fovAngle, obstacles = null) {
    const dx = target.x - observer.x;
    const dy = target.y - observer.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > maxRange * maxRange) return false;
    if (distSq === 0) return true;

    const dist = Math.sqrt(distSq);
    const dirX = Math.cos(facingAngle);
    const dirY = Math.sin(facingAngle);
    const dot = (dx / dist) * dirX + (dy / dist) * dirY;
    const minDot = Math.cos(fovAngle * 0.5);

    if (dot < minDot) return false;
    if (obstacles && !this.hasLineOfSight(observer, target, obstacles)) return false;

    return true;
  }
};