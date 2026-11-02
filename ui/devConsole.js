// In-game developer command console, live variable watcher, frame-time ring buffer,
// and Canvas 2D debug overlay (FPS graph, SpatialHash grid, and collision hitboxes).
//
//   const dev = new DevConsole({ toggleKey: 'Backquote' });
//   dev.registerCommand('spawn', (args) => spawnMob(args[0], Number(args[1] || 1)), 'spawn <type> [count]');
//   dev.watch('Entities', () => enemies.length);
//   dev.beginFrame(); ... dev.endFrame();
//   dev.renderOverlay(ctx);

export class DevConsole {
  constructor({
    toggleKey = 'Backquote',
    sampleCount = 90,
    maxLogs = 80,
    mountElement = typeof document !== 'undefined' ? document.body : null
  } = {}) {
    this.toggleKey = toggleKey;
    this.sampleCount = Math.max(16, sampleCount);
    this.maxLogs = Math.max(10, maxLogs);

    this.isOpen = false;
    this.showProfiler = true;
    this.showSpatialGrid = false;
    this.showHitboxes = false;

    this.commands = new Map();
    this.watchers = new Map();
    this.logs = [];
    this.history = [];
    this.historyIndex = -1;

    this.frameTimes = new Float32Array(this.sampleCount);
    this.updateTimes = new Float32Array(this.sampleCount);
    this.sampleIdx = 0;
    this._frameStart = 0;
    this._updateStart = 0;
    this.avgFrameMs = 16.67;
    this.maxFrameMs = 16.67;

    this._root = null;
    this._logEl = null;
    this._watchEl = null;
    this._inputEl = null;
    this._onWindowKeyDown = null;

    this.registerDefaults();

    if (mountElement && typeof document !== 'undefined') {
      this._mountDOM(mountElement);
    }
  }

  registerDefaults() {
    this.registerCommand('help', () => {
      const lines = ['Available commands:'];
      for (const [name, cmd] of this.commands.entries()) {
        lines.push(`  ${name.padEnd(12)} - ${cmd.help}`);
      }
      return lines.join('\n');
    }, 'List all registered console commands');

    this.registerCommand('clear', () => {
      this.logs.length = 0;
      this._renderLogs();
      return 'Console cleared.';
    }, 'Clear console output log');

    this.registerCommand('profiler', (args) => {
      this.showProfiler = args[0] !== undefined ? args[0] === 'on' || args[0] === '1' : !this.showProfiler;
      return `Profiler overlay: ${this.showProfiler ? 'ON' : 'OFF'}`;
    }, 'Toggle Canvas frame-time profiler [on|off]');

    this.registerCommand('grid', (args) => {
      this.showSpatialGrid = args[0] !== undefined ? args[0] === 'on' || args[0] === '1' : !this.showSpatialGrid;
      return `SpatialHash debug grid: ${this.showSpatialGrid ? 'ON' : 'OFF'}`;
    }, 'Toggle SpatialHash cell bounds [on|off]');

    this.registerCommand('hitboxes', (args) => {
      this.showHitboxes = args[0] !== undefined ? args[0] === 'on' || args[0] === '1' : !this.showHitboxes;
      return `Collision hitboxes: ${this.showHitboxes ? 'ON' : 'OFF'}`;
    }, 'Toggle entity collision circles [on|off]');
  }

  registerCommand(name, handler, help = '') {
    if (!name || typeof handler !== 'function') {
      throw new Error('DevConsole.registerCommand: name and handler function required');
    }
    this.commands.set(name.toLowerCase(), { name: name.toLowerCase(), handler, help });
    return this;
  }

  watch(label, getterFn) {
    if (typeof getterFn === 'function') {
      this.watchers.set(label, getterFn);
    }
    return this;
  }

  log(message, type = 'info') {
    this.logs.push({ text: String(message), type });
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this._renderLogs();
  }

  _tokenize(line) {
    const tokens = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match;
    while ((match = re.exec(line)) !== null) {
      tokens.push(match[1] ?? match[2] ?? match[3]);
    }
    return tokens;
  }

  execute(rawLine, context = null) {
    const trimmed = String(rawLine || '').trim();
    if (!trimmed) return '';

    this.history.unshift(trimmed);
    if (this.history.length > 40) this.history.pop();
    this.historyIndex = -1;

    this.log(`> ${trimmed}`, 'cmd');

    const parts = this._tokenize(trimmed);
    if (parts.length === 0) return '';
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const entry = this.commands.get(cmdName);
    if (!entry) {
      const msg = `Unknown command "${cmdName}". Type "help" for a list.`;
      this.log(msg, 'error');
      return msg;
    }

    try {
      const res = entry.handler(args, context);
      if (res !== undefined && res !== null && res !== '') {
        this.log(String(res), 'out');
      }
      return res;
    } catch (err) {
      const msg = `Error: ${err.message}`;
      this.log(msg, 'error');
      return msg;
    }
  }

  toggle(forceState) {
    this.isOpen = forceState !== undefined ? Boolean(forceState) : !this.isOpen;
    if (this._root) {
      this._root.style.display = this.isOpen ? 'flex' : 'none';
      if (this.isOpen && this._inputEl) {
        this._updateWatchPanel();
        setTimeout(() => this._inputEl.focus(), 0);
      }
    }
    return this.isOpen;
  }

  destroy() {
    if (this._onWindowKeyDown && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onWindowKeyDown);
      this._onWindowKeyDown = null;
    }
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
    this._root = null;
    this._logEl = null;
    this._watchEl = null;
    this._inputEl = null;
    this.isOpen = false;
  }

  beginFrame() {
    this._frameStart = performance.now();
  }

  beginUpdate() {
    this._updateStart = performance.now();
  }

  endUpdate() {
    if (this._updateStart > 0) {
      this.updateTimes[this.sampleIdx] = performance.now() - this._updateStart;
    }
  }

  endFrame() {
    const now = performance.now();
    const elapsed = this._frameStart > 0 ? now - this._frameStart : 16.67;
    this.frameTimes[this.sampleIdx] = elapsed;
    this.sampleIdx = (this.sampleIdx + 1) % this.sampleCount;

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < this.sampleCount; i++) {
      const v = this.frameTimes[i];
      sum += v;
      if (v > peak) peak = v;
    }
    this.avgFrameMs = sum / this.sampleCount;
    this.maxFrameMs = peak;

    if (this.isOpen) {
      this._updateWatchPanel();
    }
  }

  // Draws world-space SpatialHash active cells and entity collision circles.
  renderSpatialDebug(ctx, { spatialHash = null, entities = [], obstacles = [] } = {}) {
    if (!this.showSpatialGrid && !this.showHitboxes) return;

    ctx.save();

    if (this.showSpatialGrid && spatialHash) {
      const cs = spatialHash.cellSize;
      ctx.strokeStyle = 'rgba(120, 176, 217, 0.28)';
      ctx.lineWidth = 1;

      for (const [key, bucket] of spatialHash.cells.entries()) {
        if (!bucket || bucket.size === 0) continue;
        const cx = Math.floor(key / 65536) - 32768;
        const cy = (key % 65536) - 32768;
        ctx.strokeRect(cx * cs, cy * cs, cs, cs);
      }
    }

    if (this.showHitboxes) {
      ctx.strokeStyle = '#6bc98f';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        const ex = e.pos ? e.pos.x : e.x;
        const ey = e.pos ? e.pos.y : e.y;
        const er = e.r ?? 10;
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = '#c96b6b';
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (o.r !== undefined) {
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
      }
    }

    ctx.restore();
  }

  // Draws a compact screen-space frame-time sparkline & watcher HUD on the canvas.
  renderOverlay(ctx, x = 12, y = 12) {
    if (!this.showProfiler) return;

    const w = 185;
    const graphH = 38;
    const watchCount = this.watchers.size;
    const totalH = 44 + graphH + watchCount * 14;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = 'rgba(8, 11, 18, 0.86)';
    ctx.strokeStyle = '#233452';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, totalH);
    ctx.strokeRect(x, y, w, totalH);

    const estFps = Math.min(240, Math.round(1000 / Math.max(1, this.avgFrameMs)));
    ctx.fillStyle = '#f3ead3';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`FPS ~${estFps} | Avg ${this.avgFrameMs.toFixed(2)}ms`, x + 8, y + 14);
    ctx.fillStyle = '#8e9bb0';
    ctx.font = '9px monospace';
    ctx.fillText(`Peak: ${this.maxFrameMs.toFixed(1)}ms | [~] Console`, x + 8, y + 26);

    const gx = x + 8;
    const gy = y + 32;
    const gw = w - 16;

    ctx.fillStyle = '#06080e';
    ctx.fillRect(gx, gy, gw, graphH);

    const budgetY = gy + graphH - Math.min(graphH, (16.67 / 33.3) * graphH);
    ctx.strokeStyle = 'rgba(217, 185, 120, 0.35)';
    ctx.beginPath();
    ctx.moveTo(gx, budgetY);
    ctx.lineTo(gx + gw, budgetY);
    ctx.stroke();

    const barW = gw / this.sampleCount;
    for (let i = 0; i < this.sampleCount; i++) {
      const idx = (this.sampleIdx + i) % this.sampleCount;
      const ms = this.frameTimes[idx];
      const h = Math.min(graphH, (ms / 33.3) * graphH);
      ctx.fillStyle = ms > 18 ? '#c96b6b' : '#6bc98f';
      ctx.fillRect(gx + i * barW, gy + graphH - h, Math.max(1, barW - 0.5), h);
    }

    let wy = gy + graphH + 13;
    ctx.font = '10px monospace';
    for (const [label, fn] of this.watchers.entries()) {
      let val = '';
      try { val = fn(); } catch { val = 'err'; }
      ctx.fillStyle = '#8e9bb0';
      ctx.fillText(`${label}:`, gx, wy);
      ctx.fillStyle = '#f3ead3';
      ctx.fillText(String(val), gx + 92, wy);
      wy += 14;
    }

    ctx.restore();
  }

  _isExternalEditable(target) {
    if (!target || target === this._inputEl) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      Boolean(target.isContentEditable)
    );
  }

  _mountDOM(parent) {
    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;top:10%;left:50%;bottom:18px;transform:translateX(-50%);width:min(760px,94vw);' +
      'height:250px;background:rgba(8,11,18,0.95);border:1px solid #233452;border-radius:8px;' +
      'display:none;flex-direction:column;z-index:9999;font-family:monospace;font-size:12px;color:#e6e1d6;' +
      'box-shadow:0 12px 32px rgba(0,0,0,0.6);overflow:hidden;';

    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:#101624;border-bottom:1px solid #233452;">
        <strong style="color:#f3ead3;">GameKit DevConsole [~]</strong>
        <span data-role="watch" style="color:#d9b978;font-size:11px;"></span>
      </div>
      <div data-role="logs" style="flex:1;padding:8px 12px;overflow-y:auto;white-space:pre-wrap;line-height:1.45;"></div>
      <div style="display:flex;border-top:1px solid #233452;background:#06090f;align-items:center;padding:0 10px;">
        <span style="color:#d9b978;margin-right:6px;">&gt;</span>
        <input data-role="input" type="text" placeholder="Type 'help' or a command and press Enter..."
          style="flex:1;background:transparent;border:none;outline:none;color:#f3ead3;font-family:monospace;font-size:12px;padding:7px 0;margin:0;" />
      </div>
    `;

    parent.appendChild(root);
    this._root = root;
    this._logEl = root.querySelector('[data-role="logs"]');
    this._watchEl = root.querySelector('[data-role="watch"]');
    this._inputEl = root.querySelector('[data-role="input"]');

    this._onWindowKeyDown = (e) => {
      if (e.code === this.toggleKey && !this._isExternalEditable(e.target)) {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this._onWindowKeyDown);

    this._inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === this.toggleKey || e.code === 'Escape') {
        e.preventDefault();
        this.toggle(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const val = this._inputEl.value;
        this._inputEl.value = '';
        this.execute(val);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.history.length > 0 && this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this._inputEl.value = this.history[this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this._inputEl.value = this.history[this.historyIndex];
        } else {
          this.historyIndex = -1;
          this._inputEl.value = '';
        }
      }
    });

    this.log('DevConsole ready. Type "help" for available commands.', 'info');
  }

  _renderLogs() {
    if (!this._logEl) return;
    this._logEl.innerHTML = this.logs
      .map((item) => {
        const color =
          item.type === 'error' ? '#c96b6b' :
          item.type === 'cmd' ? '#d9b978' :
          item.type === 'out' ? '#f3ead3' : '#8e9bb0';
        return `<div style="color:${color};">${this._escape(item.text)}</div>`;
      })
      .join('');
    this._logEl.scrollTop = this._logEl.scrollHeight;
  }

  _updateWatchPanel() {
    if (!this._watchEl) return;
    const parts = [];
    for (const [k, fn] of this.watchers.entries()) {
      try { parts.push(`${k}: ${fn()}`); } catch { /* ignore */ }
    }
    this._watchEl.textContent = parts.join(' | ');
  }

  _escape(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}