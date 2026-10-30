// 2D tile grid with O(1) tile collision, viewport culling, and greedy wall-rect extraction.
//
//   const map = new Tilemap({ cols: 50, rows: 50, tileSize: 32, originX: -800, originY: -800 });
//   map.set(10, 10, 1);
//   map.collideCircle(player);
//   const wallBoxes = map.extractWallRects();

export class Tilemap {
  constructor({ cols = 32, rows = 32, tileSize = 32, originX = 0, originY = 0, solidIds = [1] } = {}) {
    if (!(cols > 0 && rows > 0 && tileSize > 0)) {
      throw new RangeError('Tilemap: cols, rows, and tileSize must be positive numbers');
    }
    this.cols = Math.floor(cols);
    this.rows = Math.floor(rows);
    this.tileSize = tileSize;
    this.invTileSize = 1 / tileSize;
    this.originX = originX;
    this.originY = originY;

    this.data = new Uint8Array(this.cols * this.rows);
    this.solidIds = new Set(solidIds);
  }

  get width() {
    return this.cols * this.tileSize;
  }

  get height() {
    return this.rows * this.tileSize;
  }

  inBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  index(col, row) {
    return row * this.cols + col;
  }

  get(col, row) {
    if (!this.inBounds(col, row)) return 1;
    return this.data[row * this.cols + col];
  }

  set(col, row, id) {
    if (!this.inBounds(col, row)) return false;
    this.data[row * this.cols + col] = id;
    return true;
  }

  fill(id = 0) {
    this.data.fill(id);
    return this;
  }

  loadGrid(gridArray) {
    const len = Math.min(this.data.length, gridArray.length);
    for (let i = 0; i < len; i++) {
      this.data[i] = gridArray[i];
    }
    return this;
  }

  isSolid(col, row) {
    if (!this.inBounds(col, row)) return true;
    return this.solidIds.has(this.data[row * this.cols + col]);
  }

  isSolidAtWorld(worldX, worldY) {
    const col = Math.floor((worldX - this.originX) * this.invTileSize);
    const row = Math.floor((worldY - this.originY) * this.invTileSize);
    return this.isSolid(col, row);
  }

  worldToTile(worldX, worldY, out = { col: 0, row: 0 }) {
    out.col = Math.floor((worldX - this.originX) * this.invTileSize);
    out.row = Math.floor((worldY - this.originY) * this.invTileSize);
    return out;
  }

  tileToWorld(col, row, out = { x: 0, y: 0 }) {
    out.x = this.originX + col * this.tileSize + this.tileSize * 0.5;
    out.y = this.originY + row * this.tileSize + this.tileSize * 0.5;
    return out;
  }

  // Resolves circle { x, y, r } against overlapping solid tiles in O(1) time.
  collideCircle(circle, out = { hit: false, nx: 0, ny: 0, depth: 0 }) {
    out.hit = false;
    out.nx = 0;
    out.ny = 0;
    out.depth = 0;

    const r = circle.r;
    const minC = Math.floor((circle.x - r - this.originX) * this.invTileSize);
    const maxC = Math.floor((circle.x + r - this.originX) * this.invTileSize);
    const minR = Math.floor((circle.y - r - this.originY) * this.invTileSize);
    const maxR = Math.floor((circle.y + r - this.originY) * this.invTileSize);

    const ts = this.tileSize;

    for (let row = minR; row <= maxR; row++) {
      for (let col = minC; col <= maxC; col++) {
        if (!this.isSolid(col, row)) continue;

        const bx = this.originX + col * ts;
        const by = this.originY + row * ts;

        const closestX = circle.x < bx ? bx : (circle.x > bx + ts ? bx + ts : circle.x);
        const closestY = circle.y < by ? by : (circle.y > by + ts ? by + ts : circle.y);
        const dx = circle.x - closestX;
        const dy = circle.y - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq >= r * r) continue;

        let nx = 0, ny = 0, depth = 0;
        if (distSq > 0) {
          const dist = Math.sqrt(distSq);
          nx = dx / dist;
          ny = dy / dist;
          depth = r - dist;
        } else {
          const left = circle.x - bx;
          const right = bx + ts - circle.x;
          const top = circle.y - by;
          const bottom = by + ts - circle.y;
          const min = Math.min(left, right, top, bottom);
          if (min === left) { nx = -1; depth = left + r; }
          else if (min === right) { nx = 1; depth = right + r; }
          else if (min === top) { ny = -1; depth = top + r; }
          else { ny = 1; depth = bottom + r; }
        }

        circle.x += nx * depth;
        circle.y += ny * depth;
        out.hit = true;
        out.nx = nx;
        out.ny = ny;
        out.depth = Math.max(out.depth, depth);
      }
    }

    return out;
  }

  // Calls callback(col, row, id, worldX, worldY) only for tiles inside the view box.
  forEachVisible(viewX, viewY, viewW, viewH, callback) {
    const minC = Math.max(0, Math.floor((viewX - this.originX) * this.invTileSize));
    const maxC = Math.min(this.cols - 1, Math.floor((viewX + viewW - this.originX) * this.invTileSize));
    const minR = Math.max(0, Math.floor((viewY - this.originY) * this.invTileSize));
    const maxR = Math.min(this.rows - 1, Math.floor((viewY + viewH - this.originY) * this.invTileSize));

    const ts = this.tileSize;
    let count = 0;

    for (let r = minR; r <= maxR; r++) {
      const wy = this.originY + r * ts;
      const rowOffset = r * this.cols;
      for (let c = minC; c <= maxC; c++) {
        const id = this.data[rowOffset + c];
        callback(c, r, id, this.originX + c * ts, wy);
        count++;
      }
    }
    return count;
  }

  // Greedy 2D rectangle merger: combines contiguous solid tiles into minimal { x, y, w, h } boxes.
  extractWallRects(out = []) {
    out.length = 0;
    const cols = this.cols;
    const rows = this.rows;
    const ts = this.tileSize;
    const visited = new Uint8Array(cols * rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (visited[idx] || !this.isSolid(c, r)) continue;

        let w = 1;
        while (c + w < cols && !visited[r * cols + (c + w)] && this.isSolid(c + w, r)) {
          w++;
        }

        let h = 1;
        outer: while (r + h < rows) {
          for (let k = 0; k < w; k++) {
            const checkIdx = (r + h) * cols + (c + k);
            if (visited[checkIdx] || !this.isSolid(c + k, r + h)) {
              break outer;
            }
          }
          h++;
        }

        for (let dr = 0; dr < h; dr++) {
          for (let dc = 0; dc < w; dc++) {
            visited[(r + dr) * cols + (c + dc)] = 1;
          }
        }

        out.push({
          x: this.originX + c * ts,
          y: this.originY + r * ts,
          w: w * ts,
          h: h * ts
        });
      }
    }

    return out;
  }
}