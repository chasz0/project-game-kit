// Chunked offscreen canvas cache for fast O(1) Tilemap rendering and localized dirty-tile rebuilds.
//
//   const mapRenderer = new TilemapRenderer(tilemap, { chunkSize: 16 });
//   mapRenderer.invalidateAll();                   // call after procgen / loadGrid
//   mapRenderer.invalidateTile(col, row);          // call after map.set(col, row, id)
//   mapRenderer.render(ctx, cam.x, cam.y, viewW, viewH);

export class TilemapRenderer {
  constructor(tilemap, {
    chunkSize = 16,
    floorColor = '#080b12',
    floorAltColor = '#0a0e17',
    wallColor = '#141d2f',
    wallInnerColor = '#1b273d',
    borderColor = '#233452',
    customTileDrawer = null
  } = {}) {
    if (!tilemap) throw new Error('TilemapRenderer: tilemap instance is required');
    this.tilemap = tilemap;
    this.chunkSize = Math.max(4, Math.floor(chunkSize));
    this.floorColor = floorColor;
    this.floorAltColor = floorAltColor;
    this.wallColor = wallColor;
    this.wallInnerColor = wallInnerColor;
    this.borderColor = borderColor;
    this.customTileDrawer = customTileDrawer;

    this.chunkCols = Math.ceil(tilemap.cols / this.chunkSize);
    this.chunkRows = Math.ceil(tilemap.rows / this.chunkSize);
    this.chunkPixelSize = this.chunkSize * tilemap.tileSize;

    this.chunksDrawnThisFrame = 0;
    this.chunksRebuiltThisFrame = 0;
    this.totalRebuilds = 0;

    this.chunks = new Array(this.chunkCols * this.chunkRows);
    for (let r = 0; r < this.chunkRows; r++) {
      for (let c = 0; c < this.chunkCols; c++) {
        this.chunks[r * this.chunkCols + c] = {
          col: c,
          row: r,
          canvas: null,
          ctx: null,
          dirty: true
        };
      }
    }
  }

  get totalChunks() {
    return this.chunks.length;
  }

  invalidateAll() {
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].dirty = true;
    }
  }

  // Marks the chunk containing (col, row) dirty, plus neighbor chunks if on a seam.
  invalidateTile(col, row) {
    if (!this.tilemap.inBounds(col, row)) return;
    const cs = this.chunkSize;
    const cc = Math.floor(col / cs);
    const cr = Math.floor(row / cs);
    this._markChunkDirty(cc, cr);

    const localC = col % cs;
    const localR = row % cs;
    if (localC === 0) this._markChunkDirty(cc - 1, cr);
    if (localC === cs - 1) this._markChunkDirty(cc + 1, cr);
    if (localR === 0) this._markChunkDirty(cc, cr - 1);
    if (localR === cs - 1) this._markChunkDirty(cc, cr + 1);
  }

  // Blits only the chunks intersecting the viewport box (viewX, viewY, viewW, viewH).
  render(ctx, viewX = 0, viewY = 0, viewW = this.tilemap.width, viewH = this.tilemap.height) {
    this.chunksDrawnThisFrame = 0;
    this.chunksRebuiltThisFrame = 0;

    const tm = this.tilemap;
    const cpSize = this.chunkPixelSize;

    const minCC = Math.max(0, Math.floor((viewX - tm.originX) / cpSize));
    const maxCC = Math.min(this.chunkCols - 1, Math.floor((viewX + viewW - tm.originX) / cpSize));
    const minCR = Math.max(0, Math.floor((viewY - tm.originY) / cpSize));
    const maxCR = Math.min(this.chunkRows - 1, Math.floor((viewY + viewH - tm.originY) / cpSize));

    for (let cr = minCR; cr <= maxCR; cr++) {
      const worldY = tm.originY + cr * cpSize;
      for (let cc = minCC; cc <= maxCC; cc++) {
        const chunk = this.chunks[cr * this.chunkCols + cc];
        if (chunk.dirty) {
          this._rebuildChunk(chunk);
          this.chunksRebuiltThisFrame++;
          this.totalRebuilds++;
        }
        if (chunk.canvas) {
          const worldX = tm.originX + cc * cpSize;
          ctx.drawImage(chunk.canvas, worldX, worldY);
          this.chunksDrawnThisFrame++;
        }
      }
    }

    return this.chunksDrawnThisFrame;
  }

  _markChunkDirty(cc, cr) {
    if (cc < 0 || cc >= this.chunkCols || cr < 0 || cr >= this.chunkRows) return;
    this.chunks[cr * this.chunkCols + cc].dirty = true;
  }

  _ensureChunkCanvas(chunk, width, height) {
    if (chunk.canvas) return chunk.ctx;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      chunk.canvas = c;
      chunk.ctx = c.getContext('2d');
      return chunk.ctx;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(width, height);
      chunk.canvas = c;
      chunk.ctx = c.getContext('2d');
      return chunk.ctx;
    }
    return null;
  }

  _rebuildChunk(chunk) {
    chunk.dirty = false;
    const tm = this.tilemap;
    const ts = tm.tileSize;
    const cs = this.chunkSize;

    const startCol = chunk.col * cs;
    const startRow = chunk.row * cs;
    const endCol = Math.min(tm.cols, startCol + cs);
    const endRow = Math.min(tm.rows, startRow + cs);

    const pixelW = (endCol - startCol) * ts;
    const pixelH = (endRow - startRow) * ts;
    const cCtx = this._ensureChunkCanvas(chunk, pixelW, pixelH);
    if (!cCtx) return;

    cCtx.clearRect(0, 0, pixelW, pixelH);

    for (let r = startRow; r < endRow; r++) {
      const ly = (r - startRow) * ts;
      for (let c = startCol; c < endCol; c++) {
        const lx = (c - startCol) * ts;
        const id = tm.get(c, r);

        if (this.customTileDrawer) {
          this.customTileDrawer(cCtx, c, r, id, lx, ly, ts);
          continue;
        }

        if (tm.isSolid(c, r)) {
          cCtx.fillStyle = this.wallColor;
          cCtx.fillRect(lx, ly, ts, ts);
          cCtx.fillStyle = this.wallInnerColor;
          cCtx.fillRect(lx + 2, ly + 2, ts - 4, ts - 4);

          // Draw exposed outer wall edges so contiguous blocks look unified
          cCtx.fillStyle = this.borderColor;
          if (!tm.isSolid(c, r - 1)) cCtx.fillRect(lx, ly, ts, 1.5);
          if (!tm.isSolid(c, r + 1)) cCtx.fillRect(lx, ly + ts - 1.5, ts, 1.5);
          if (!tm.isSolid(c - 1, r)) cCtx.fillRect(lx, ly, 1.5, ts);
          if (!tm.isSolid(c + 1, r)) cCtx.fillRect(lx + ts - 1.5, ly, 1.5, ts);
        } else {
          cCtx.fillStyle = (c + r) % 2 === 0 ? this.floorAltColor : this.floorColor;
          cCtx.fillRect(lx, ly, ts, ts);
        }
      }
    }
  }
}