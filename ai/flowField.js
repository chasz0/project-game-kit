// Grid-based Flow Field (Dijkstra / BFS vector field) for O(1) swarm pathfinding.
//
//   const field = new FlowField({ cols: 40, rows: 40, cellSize: 40, originX: -800, originY: -800 });
//   field.setObstacleRect(wall.x, wall.y, wall.w, wall.h, 8);
//   field.compute(player.x, player.y);
//   const dir = field.sample(enemy.x, enemy.y, scratchVec);

const DIRS_4 = [
  [1, 0], [-1, 0], [0, 1], [0, -1]
];

const DIRS_8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1]
];

export class FlowField {
  constructor({ cols = 30, rows = 20, cellSize = 40, originX = 0, originY = 0 } = {}) {
    if (!(cols > 0 && rows > 0 && cellSize > 0)) {
      throw new RangeError('FlowField: cols, rows, and cellSize must be positive numbers');
    }
    this.cols = Math.floor(cols);
    this.rows = Math.floor(rows);
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.originX = originX;
    this.originY = originY;

    const total = this.cols * this.rows;
    this.walls = new Uint8Array(total);
    this.cost = new Int32Array(total);
    this.dirX = new Float32Array(total);
    this.dirY = new Float32Array(total);
    this._queue = new Int32Array(total);
  }

  index(col, row) {
    return row * this.cols + col;
  }

  inBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  worldToCell(worldX, worldY, out = { col: 0, row: 0 }) {
    out.col = Math.floor((worldX - this.originX) * this.invCellSize);
    out.row = Math.floor((worldY - this.originY) * this.invCellSize);
    return out;
  }

  clearWalls() {
    this.walls.fill(0);
  }

  setWall(col, row, blocked = true) {
    if (!this.inBounds(col, row)) return;
    this.walls[row * this.cols + col] = blocked ? 1 : 0;
  }

  isWall(col, row) {
    if (!this.inBounds(col, row)) return true;
    return this.walls[row * this.cols + col] === 1;
  }

  setObstacleRect(x, y, w, h, inflate = 0) {
    const minC = Math.max(0, Math.floor((x - inflate - this.originX) * this.invCellSize));
    const minR = Math.max(0, Math.floor((y - inflate - this.originY) * this.invCellSize));
    const maxC = Math.min(this.cols - 1, Math.floor((x + w + inflate - this.originX) * this.invCellSize));
    const maxR = Math.min(this.rows - 1, Math.floor((y + h + inflate - this.originY) * this.invCellSize));

    for (let r = minR; r <= maxR; r++) {
      const rowOffset = r * this.cols;
      for (let c = minC; c <= maxC; c++) {
        this.walls[rowOffset + c] = 1;
      }
    }
  }

  // If the target is hugging an inflated wall cell, snaps to the closest open cell.
  _findNearestOpenCell(startCol, startRow) {
    if (this.walls[startRow * this.cols + startCol] === 0) {
      return { col: startCol, row: startRow };
    }
    for (let radius = 1; radius <= 5; radius++) {
      let bestCol = -1;
      let bestRow = -1;
      let bestDistSq = Infinity;

      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const c = startCol + dc;
          const r = startRow + dr;
          if (!this.inBounds(c, r)) continue;
          if (this.walls[r * this.cols + c] === 0) {
            const dSq = dc * dc + dr * dr;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestCol = c;
              bestRow = r;
            }
          }
        }
      }
      if (bestCol !== -1) return { col: bestCol, row: bestRow };
    }
    return { col: startCol, row: startRow };
  }

  compute(targetX, targetY) {
    const cols = this.cols;
    const rows = this.rows;
    const walls = this.walls;
    const cost = this.cost;
    const dirX = this.dirX;
    const dirY = this.dirY;
    const queue = this._queue;

    cost.fill(-1);
    dirX.fill(0);
    dirY.fill(0);

    let rawCol = Math.floor((targetX - this.originX) * this.invCellSize);
    let rawRow = Math.floor((targetY - this.originY) * this.invCellSize);
    rawCol = Math.max(0, Math.min(cols - 1, rawCol));
    rawRow = Math.max(0, Math.min(rows - 1, rawRow));

    const seed = this._findNearestOpenCell(rawCol, rawRow);
    const startIdx = seed.row * cols + seed.col;
    cost[startIdx] = 0;

    let head = 0;
    let tail = 0;
    queue[tail++] = startIdx;

    while (head < tail) {
      const curr = queue[head++];
      const cCol = curr % cols;
      const cRow = (curr / cols) | 0;
      const nextCost = cost[curr] + 1;

      for (let i = 0; i < 4; i++) {
        const nc = cCol + DIRS_4[i][0];
        const nr = cRow + DIRS_4[i][1];
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

        const nIdx = nr * cols + nc;
        if (walls[nIdx] === 1 || cost[nIdx] !== -1) continue;

        cost[nIdx] = nextCost;
        queue[tail++] = nIdx;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const myCost = cost[idx];
        if (myCost <= 0) continue;

        let bestCost = myCost;
        let bestDx = 0;
        let bestDy = 0;

        for (let i = 0; i < 8; i++) {
          const dx = DIRS_8[i][0];
          const dy = DIRS_8[i][1];
          const nc = c + dx;
          const nr = r + dy;
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

          // Prevent diagonal corner cutting through adjacent walls
          if (dx !== 0 && dy !== 0) {
            if (walls[r * cols + nc] === 1 || walls[nr * cols + c] === 1) continue;
          }

          const nCost = cost[nr * cols + nc];
          if (nCost !== -1 && nCost < bestCost) {
            bestCost = nCost;
            bestDx = dx;
            bestDy = dy;
          }
        }

        if (bestDx !== 0 || bestDy !== 0) {
          const len = Math.sqrt(bestDx * bestDx + bestDy * bestDy);
          dirX[idx] = bestDx / len;
          dirY[idx] = bestDy / len;
        }
      }
    }
  }

  sample(worldX, worldY, out = { x: 0, y: 0 }) {
    const col = Math.floor((worldX - this.originX) * this.invCellSize);
    const row = Math.floor((worldY - this.originY) * this.invCellSize);

    if (!this.inBounds(col, row)) {
      out.x = 0;
      out.y = 0;
      return out;
    }

    const idx = row * this.cols + col;
    let vx = this.dirX[idx];
    let vy = this.dirY[idx];

    // If agent is on the target cell or nudged into a wall edge, steer toward the best nearby open cell
    if (vx === 0 && vy === 0) {
      let bestCost = 2147483647;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dc === 0 && dr === 0) continue;
          const nc = col + dc;
          const nr = row + dr;
          if (!this.inBounds(nc, nr)) continue;
          const nIdx = nr * this.cols + nc;
          if (this.walls[nIdx] === 0 && this.cost[nIdx] !== -1 && this.cost[nIdx] < bestCost) {
            bestCost = this.cost[nIdx];
            vx = dc;
            vy = dr;
          }
        }
      }
      const len = Math.sqrt(vx * vx + vy * vy);
      if (len > 0) {
        vx /= len;
        vy /= len;
      }
    }

    out.x = vx;
    out.y = vy;
    return out;
  }

  getDistance(worldX, worldY) {
    const col = Math.floor((worldX - this.originX) * this.invCellSize);
    const row = Math.floor((worldY - this.originY) * this.invCellSize);
    if (!this.inBounds(col, row)) return -1;
    return this.cost[row * this.cols + col];
  }
}