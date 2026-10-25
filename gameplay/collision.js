// 2D overlap checks and penetration manifolds.
//
// Coordinate conventions:
//   Circle: { x, y, r }       center-based
//   Box:    { x, y, w, h }    top-left-based
//   Point:  { x, y }
//
// Usage:
//   if (collision.circleCircle(a, b)) { ... }
//   const hit = collision.circleCircleInfo(a, b, manifold);
//   if (hit) { a.x += hit.nx * hit.depth; a.y += hit.ny * hit.depth; }

export const collision = {
  circleCircle(c1, c2) {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const r = c1.r + c2.r;
    return dx * dx + dy * dy < r * r;
  },

  boxBox(b1, b2) {
    return (
      b1.x < b2.x + b2.w &&
      b1.x + b1.w > b2.x &&
      b1.y < b2.y + b2.h &&
      b1.y + b1.h > b2.y
    );
  },

  circleBox(c, b) {
    const closestX = c.x < b.x ? b.x : (c.x > b.x + b.w ? b.x + b.w : c.x);
    const closestY = c.y < b.y ? b.y : (c.y > b.y + b.h ? b.y + b.h : c.y);
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    return dx * dx + dy * dy < c.r * c.r;
  },

  pointCircle(p, c) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return dx * dx + dy * dy <= c.r * c.r;
  },

  pointBox(p, b) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  },

  // Returns { nx, ny, depth } to push c1 out of c2, or null if not overlapping.
  circleCircleInfo(c1, c2, out = { nx: 0, ny: 0, depth: 0 }) {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const r = c1.r + c2.r;
    const distSq = dx * dx + dy * dy;

    if (distSq >= r * r) return null;

    if (distSq === 0) {
      out.nx = 1;
      out.ny = 0;
      out.depth = r;
      return out;
    }

    const dist = Math.sqrt(distSq);
    out.nx = dx / dist;
    out.ny = dy / dist;
    out.depth = r - dist;
    return out;
  },

  // Returns { nx, ny, depth } to push circle c out of box b, or null if not overlapping.
  circleBoxInfo(c, b, out = { nx: 0, ny: 0, depth: 0 }) {
    const closestX = c.x < b.x ? b.x : (c.x > b.x + b.w ? b.x + b.w : c.x);
    const closestY = c.y < b.y ? b.y : (c.y > b.y + b.h ? b.y + b.h : c.y);
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq >= c.r * c.r) return null;

    if (distSq > 0) {
      const dist = Math.sqrt(distSq);
      out.nx = dx / dist;
      out.ny = dy / dist;
      out.depth = c.r - dist;
      return out;
    }

    const left = c.x - b.x;
    const right = b.x + b.w - c.x;
    const top = c.y - b.y;
    const bottom = b.y + b.h - c.y;
    const min = Math.min(left, right, top, bottom);

    if (min === left) {
      out.nx = -1; out.ny = 0; out.depth = left + c.r;
    } else if (min === right) {
      out.nx = 1; out.ny = 0; out.depth = right + c.r;
    } else if (min === top) {
      out.nx = 0; out.ny = -1; out.depth = top + c.r;
    } else {
      out.nx = 0; out.ny = 1; out.depth = bottom + c.r;
    }
    return out;
  },

  // Returns { nx, ny, depth } to push box b1 out of box b2, or null if not overlapping.
  boxBoxInfo(b1, b2, out = { nx: 0, ny: 0, depth: 0 }) {
    const overlapRight = b2.x + b2.w - b1.x;
    const overlapLeft = b1.x + b1.w - b2.x;
    if (overlapRight <= 0 || overlapLeft <= 0) return null;

    const overlapBottom = b2.y + b2.h - b1.y;
    const overlapTop = b1.y + b1.h - b2.y;
    if (overlapBottom <= 0 || overlapTop <= 0) return null;

    const dx = overlapRight < overlapLeft ? overlapRight : -overlapLeft;
    const dy = overlapBottom < overlapTop ? overlapBottom : -overlapTop;

    if (Math.abs(dx) < Math.abs(dy)) {
      out.nx = dx > 0 ? 1 : -1;
      out.ny = 0;
      out.depth = Math.abs(dx);
    } else {
      out.nx = 0;
      out.ny = dy > 0 ? 1 : -1;
      out.depth = Math.abs(dy);
    }
    return out;
  }
};