const OFFSET = 32768;
const STRIDE = 65536;
const MAX_CELLS_PER_CLIENT = 4096;

const cellKey = (cx, cy) => (cx + OFFSET) * STRIDE + (cy + OFFSET);

export class SpatialHash {
  constructor(cellSize = 64) {
    if (!(cellSize > 0) || !Number.isFinite(cellSize)) {
      throw new RangeError(`SpatialHash: cellSize must be a positive number, got ${cellSize}`);
    }
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
    this.bounds = new WeakMap();
    this.size = 0;
    this._seen = new Set();
  }

  get cellCount() {
    return this.cells.size;
  }

  _validateBounds(minX, minY, maxX, maxY) {
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY) ||
      minX > maxX ||
      minY > maxY
    ) {
      throw new RangeError('SpatialHash: bounds must be finite numbers');
    }
    if ((maxX - minX + 1) * (maxY - minY + 1) > MAX_CELLS_PER_CLIENT) {
      throw new RangeError('SpatialHash: client spans too many cells; use a larger cellSize');
    }
  }

  insert(client) {
    if (this.bounds.has(client)) {
      return this.update(client);
    }

    const minX = this._minX(client);
    const minY = this._minY(client);
    const maxX = this._maxX(client);
    const maxY = this._maxY(client);
    this._validateBounds(minX, minY, maxX, maxY);

    this._addToCells(client, minX, minY, maxX, maxY);
    this.bounds.set(client, { minX, minY, maxX, maxY });
    this.size++;
    return true;
  }

  remove(client) {
    const prev = this.bounds.get(client);
    if (!prev) return false;

    this._removeFromCells(client, prev.minX, prev.minY, prev.maxX, prev.maxY);
    this.bounds.delete(client);
    this.size--;
    return true;
  }

  update(client) {
    const prev = this.bounds.get(client);
    if (!prev) return this.insert(client);

    const minX = this._minX(client);
    const minY = this._minY(client);
    const maxX = this._maxX(client);
    const maxY = this._maxY(client);
    this._validateBounds(minX, minY, maxX, maxY);

    if (
      prev.minX === minX &&
      prev.minY === minY &&
      prev.maxX === maxX &&
      prev.maxY === maxY
    ) {
      return false;
    }

    this._removeFromCells(client, prev.minX, prev.minY, prev.maxX, prev.maxY);
    this._addToCells(client, minX, minY, maxX, maxY);

    prev.minX = minX;
    prev.minY = minY;
    prev.maxX = maxX;
    prev.maxY = maxY;
    return true;
  }

  query(x, y, w, h, out = []) {
    out.length = 0;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
      return out;
    }

    const inv = this.invCellSize;
    const minX = Math.floor(x * inv);
    const minY = Math.floor(y * inv);
    const maxX = Math.floor((x + w) * inv);
    const maxY = Math.floor((y + h) * inv);

    if (minX === maxX && minY === maxY) {
      const cell = this.cells.get(cellKey(minX, minY));
      if (cell) {
        for (const client of cell) out.push(client);
      }
      return out;
    }

    const seen = this._seen;
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.cells.get(cellKey(cx, cy));
        if (!cell) continue;
        for (const client of cell) {
          if (!seen.has(client)) {
            seen.add(client);
            out.push(client);
          }
        }
      }
    }
    seen.clear();
    return out;
  }

  queryRadius(x, y, r, out = []) {
    const d = r * 2;
    return this.query(x - r, y - r, d, d, out);
  }

  clear() {
    this.cells.clear();
    this.bounds = new WeakMap();
    this.size = 0;
  }

  _minX(c) {
    return Math.floor((c.r !== undefined ? c.x - c.r : c.x) * this.invCellSize);
  }

  _minY(c) {
    return Math.floor((c.r !== undefined ? c.y - c.r : c.y) * this.invCellSize);
  }

  _maxX(c) {
    const right = c.r !== undefined ? c.x + c.r : c.x + (c.w || 0);
    return Math.floor(right * this.invCellSize);
  }

  _maxY(c) {
    const bottom = c.r !== undefined ? c.y + c.r : c.y + (c.h || 0);
    return Math.floor(bottom * this.invCellSize);
  }

  _addToCells(client, minX, minY, maxX, maxY) {
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = cellKey(cx, cy);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set();
          this.cells.set(key, cell);
        }
        cell.add(client);
      }
    }
  }

  _removeFromCells(client, minX, minY, maxX, maxY) {
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = cellKey(cx, cy);
        const cell = this.cells.get(key);
        if (cell) {
          cell.delete(client);
          if (cell.size === 0) this.cells.delete(key);
        }
      }
    }
  }
}