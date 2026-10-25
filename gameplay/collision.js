// Checks overlaps between geometric shapes like circles and bounding boxes.
// import { collision } from '@gameplay/collision.js';
// collision.boxBox({x: 0, y: 0, w: 10, h: 10}, {x: 5, y: 5, w: 10, h: 10});

export const collision = {
  circleCircle(c1, c2) {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const distance = Math.hypot(dx, dy);
    return distance < (c1.r + c2.r);
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
    const testX = c.x < b.x ? b.x : (c.x > b.x + b.w ? b.x + b.w : c.x);
    const testY = c.y < b.y ? b.y : (c.y > b.y + b.h ? b.y + b.h : c.y);
    const dx = c.x - testX;
    const dy = c.y - testY;
    return Math.hypot(dx, dy) < c.r;
  }
};