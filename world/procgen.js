// Seeded procedural grid generators for caves, dungeons, and tactical arenas.
//
//   const cave = procgen.cellularAutomata({ cols: 50, rows: 50, rng: () => rng.next() });
//   const dungeon = procgen.dungeonRooms({ cols: 50, rows: 50, roomCount: 10, rng: () => rng.next() });

export const procgen = {
  // Generates organic caves and flood-fills isolated pockets so the whole map is reachable.
  cellularAutomata({
    cols = 40,
    rows = 40,
    fillChance = 0.44,
    steps = 4,
    birthLimit = 4,
    survivalLimit = 3,
    border = true,
    ensureConnected = true,
    rng = Math.random
  } = {}) {
    let grid = new Uint8Array(cols * rows);
    let next = new Uint8Array(cols * rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (border && (c === 0 || r === 0 || c === cols - 1 || r === rows - 1)) {
          grid[r * cols + c] = 1;
        } else {
          grid[r * cols + c] = rng() < fillChance ? 1 : 0;
        }
      }
    }

    for (let s = 0; s < steps; s++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (border && (c === 0 || r === 0 || c === cols - 1 || r === rows - 1)) {
            next[r * cols + c] = 1;
            continue;
          }
          const neighbors = this._countWallNeighbors(grid, cols, rows, c, r);
          const cur = grid[r * cols + c];
          if (cur === 1) {
            next[r * cols + c] = neighbors >= survivalLimit ? 1 : 0;
          } else {
            next[r * cols + c] = neighbors > birthLimit ? 1 : 0;
          }
        }
      }
      const tmp = grid;
      grid = next;
      next = tmp;
    }

    if (ensureConnected) {
      this._keepLargestCavern(grid, cols, rows);
    }

    const spawn = this.findOpenTile(grid, cols, rows);
    return { grid, cols, rows, spawn };
  },

  // Carves non-overlapping rectangular rooms and connects them with L-shaped corridors.
  dungeonRooms({
    cols = 40,
    rows = 40,
    roomCount = 10,
    minSize = 5,
    maxSize = 10,
    corridorWidth = 2,
    rng = Math.random
  } = {}) {
    const grid = new Uint8Array(cols * rows);
    grid.fill(1);

    const rooms = [];
    const maxAttempts = roomCount * 8;

    for (let a = 0; a < maxAttempts && rooms.length < roomCount; a++) {
      const w = minSize + Math.floor(rng() * (maxSize - minSize + 1));
      const h = minSize + Math.floor(rng() * (maxSize - minSize + 1));
      const x = 2 + Math.floor(rng() * Math.max(1, cols - w - 4));
      const y = 2 + Math.floor(rng() * Math.max(1, rows - h - 4));

      let overlaps = false;
      for (let i = 0; i < rooms.length; i++) {
        const other = rooms[i];
        if (
          x - 2 < other.x + other.w &&
          x + w + 2 > other.x &&
          y - 2 < other.y + other.h &&
          y + h + 2 > other.y
        ) {
          overlaps = true;
          break;
        }
      }

      if (overlaps) continue;

      for (let r = y; r < y + h; r++) {
        for (let c = x; c < x + w; c++) {
          grid[r * cols + c] = 0;
        }
      }

      const cx = Math.floor(x + w * 0.5);
      const cy = Math.floor(y + h * 0.5);

      if (rooms.length > 0) {
        const prev = rooms[rooms.length - 1];
        this._carveCorridor(grid, cols, rows, prev.cx, prev.cy, cx, cy, corridorWidth);
      }

      rooms.push({ x, y, w, h, cx, cy });
    }

    const spawn = rooms.length > 0
      ? { col: rooms[0].cx, row: rooms[0].cy }
      : this.findOpenTile(grid, cols, rows);

    return { grid, cols, rows, rooms, spawn };
  },

  // Generates an open arena with spaced pillars and a guaranteed clear center zone.
  arenaPillars({
    cols = 40,
    rows = 40,
    pillarCount = 14,
    minSize = 2,
    maxSize = 5,
    corridorGap = 2,
    clearCenterRadius = 4,
    border = true,
    rng = Math.random
  } = {}) {
    const grid = new Uint8Array(cols * rows);

    if (border) {
      for (let c = 0; c < cols; c++) {
        grid[c] = 1;
        grid[(rows - 1) * cols + c] = 1;
      }
      for (let r = 0; r < rows; r++) {
        grid[r * cols] = 1;
        grid[r * cols + (cols - 1)] = 1;
      }
    }

    const midC = Math.floor(cols * 0.5);
    const midR = Math.floor(rows * 0.5);
    const pillars = [];
    let attempts = 0;

    while (pillars.length < pillarCount && attempts < pillarCount * 10) {
      attempts++;
      const w = minSize + Math.floor(rng() * (maxSize - minSize + 1));
      const h = minSize + Math.floor(rng() * (maxSize - minSize + 1));
      const c = 3 + Math.floor(rng() * Math.max(1, cols - w - 6));
      const r = 3 + Math.floor(rng() * Math.max(1, rows - h - 6));

      if (
        Math.abs(c + w * 0.5 - midC) < clearCenterRadius + w * 0.5 &&
        Math.abs(r + h * 0.5 - midR) < clearCenterRadius + h * 0.5
      ) {
        continue;
      }

      let tooClose = false;
      for (let i = 0; i < pillars.length; i++) {
        const p = pillars[i];
        if (
          c - corridorGap < p.c + p.w &&
          c + w + corridorGap > p.c &&
          r - corridorGap < p.r + p.h &&
          r + h + corridorGap > p.r
        ) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) continue;

      for (let rr = r; rr < r + h; rr++) {
        for (let cc = c; cc < c + w; cc++) {
          grid[rr * cols + cc] = 1;
        }
      }
      pillars.push({ c, r, w, h });
    }

    return { grid, cols, rows, pillars, spawn: { col: midC, row: midR } };
  },

  // Finds the open tile (value === 0) closest to the center of the map.
  findOpenTile(grid, cols, rows) {
    const midC = Math.floor(cols * 0.5);
    const midR = Math.floor(rows * 0.5);
    if (grid[midR * cols + midC] === 0) return { col: midC, row: midR };

    const maxR = Math.max(cols, rows);
    for (let rad = 1; rad < maxR; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const c = midC + dc;
          const r = midR + dr;
          if (c >= 0 && c < cols && r >= 0 && r < rows && grid[r * cols + c] === 0) {
            return { col: c, row: r };
          }
        }
      }
    }
    return { col: midC, row: midR };
  },

  _countWallNeighbors(grid, cols, rows, col, row) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dc === 0 && dr === 0) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows || grid[nr * cols + nc] === 1) {
          count++;
        }
      }
    }
    return count;
  },

  _keepLargestCavern(grid, cols, rows) {
    const total = cols * rows;
    const labels = new Int32Array(total);
    const queue = new Int32Array(total);
    let currentLabel = 0;
    let bestLabel = -1;
    let bestSize = 0;

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (let i = 0; i < total; i++) {
      if (grid[i] === 1 || labels[i] !== 0) continue;

      currentLabel++;
      let head = 0;
      let tail = 0;
      queue[tail++] = i;
      labels[i] = currentLabel;

      while (head < tail) {
        const curr = queue[head++];
        const cc = curr % cols;
        const cr = (curr / cols) | 0;

        for (let d = 0; d < 4; d++) {
          const nc = cc + dirs[d][0];
          const nr = cr + dirs[d][1];
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
          const nIdx = nr * cols + nc;
          if (grid[nIdx] === 0 && labels[nIdx] === 0) {
            labels[nIdx] = currentLabel;
            queue[tail++] = nIdx;
          }
        }
      }

      if (tail > bestSize) {
        bestSize = tail;
        bestLabel = currentLabel;
      }
    }

    if (bestLabel !== -1) {
      for (let i = 0; i < total; i++) {
        if (grid[i] === 0 && labels[i] !== bestLabel) {
          grid[i] = 1;
        }
      }
    }
  },

  _carveCorridor(grid, cols, rows, x1, y1, x2, y2, width) {
    const carvePoint = (cx, cy) => {
      for (let dy = 0; dy < width; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const c = Math.min(cols - 2, Math.max(1, cx + dx));
          const r = Math.min(rows - 2, Math.max(1, cy + dy));
          grid[r * cols + c] = 0;
        }
      }
    };

    let cx = x1;
    let cy = y1;
    while (cx !== x2) {
      carvePoint(cx, cy);
      cx += cx < x2 ? 1 : -1;
    }
    while (cy !== y2) {
      carvePoint(cx, cy);
      cy += cy < y2 ? 1 : -1;
    }
    carvePoint(x2, y2);
  }
};