// Fast 2D spatial queries to find nearby objects without checking everything.
// const grid = new SpatialHash(100); // 100x100 cell size
// grid.insert({ id: 1, x: 10, y: 10, w: 5, h: 5 });
// const nearby = grid.query(0, 0, 50, 50);

export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  insert(client) {
    const minX = Math.floor(client.x / this.cellSize);
    const minY = Math.floor(client.y / this.cellSize);
    const maxX = Math.floor((client.x + client.w) / this.cellSize);
    const maxY = Math.floor((client.y + client.h) / this.cellSize);

    client._cells = [];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        if (!this.cells.has(key)) {
          this.cells.set(key, new Set());
        }
        this.cells.get(key).add(client);
        client._cells.push(key);
      }
    }
  }

  remove(client) {
    if (!client._cells) return;
    for (const key of client._cells) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(client);
        if (cell.size === 0) this.cells.delete(key);
      }
    }
    client._cells = [];
  }

  update(client) {
    this.remove(client);
    this.insert(client);
  }

  query(x, y, w, h) {
    const minX = Math.floor(x / this.cellSize);
    const minY = Math.floor(y / this.cellSize);
    const maxX = Math.floor((x + w) / this.cellSize);
    const maxY = Math.floor((y + h) / this.cellSize);

    const results = new Set();
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (cell) {
          for (const client of cell) {
            results.add(client);
          }
        }
      }
    }
    return Array.from(results);
  }
}