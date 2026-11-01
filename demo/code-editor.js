import * as GameKit from '../index.js';

export class CodeEditor {
  constructor(container, { title = 'Live Snippet', tag = '', desc = '', code = '', autoRun = true } = {}) {
    this.container = container;
    this.title = title;
    this.tag = tag;
    this.desc = desc;
    this.initialCode = code.trim();
    this.render();
    if (autoRun) this.run(false);
  }

  render() {
    this.root = document.createElement('div');
    this.root.className = 'gk-editor-card';

    this.root.innerHTML = `
      <div class="gk-editor-meta">
        <div class="gk-editor-head">
          <h3>${this.title}</h3>
          ${this.tag ? `<span class="gk-editor-tag">${this.tag}</span>` : ''}
        </div>
        ${this.desc ? `<p class="gk-editor-desc">${this.desc}</p>` : ''}
      </div>

      <div class="gk-editor-shell">
        <div class="gk-editor-toolbar">
          <span class="gk-editor-hint">
            Editable JS (All GameKit Modules in Scope) &bull; Ctrl+Enter to Run
            <span class="gk-editor-status" data-role="status"></span>
          </span>
          <div class="gk-editor-actions">
            <button type="button" class="gk-btn-secondary" data-action="copy">Copy Code</button>
            <button type="button" class="gk-btn-secondary" data-action="reset">Reset</button>
            <button type="button" class="gk-btn-primary" data-action="run">Run Code ▶</button>
          </div>
        </div>

        <div class="gk-editor-body">
          <div class="gk-editor-gutter" aria-hidden="true">1</div>
          <textarea class="gk-editor-input" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
        </div>

        <div class="gk-editor-console">
          <div class="gk-console-head">
            <span class="gk-console-label">Console Output</span>
            <span class="gk-console-time" data-role="exec-time"></span>
          </div>
          <pre class="gk-console-out"></pre>
        </div>
      </div>
    `;

    this.textarea = this.root.querySelector('.gk-editor-input');
    this.gutter = this.root.querySelector('.gk-editor-gutter');
    this.outputEl = this.root.querySelector('.gk-console-out');
    this.statusEl = this.root.querySelector('[data-role="status"]');
    this.timeEl = this.root.querySelector('[data-role="exec-time"]');

    this.textarea.value = this.initialCode;
    this.updateGutter();

    this.textarea.addEventListener('input', () => this.updateGutter());
    this.textarea.addEventListener('scroll', () => {
      this.gutter.scrollTop = this.textarea.scrollTop;
    });

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        this.textarea.value =
          this.textarea.value.substring(0, start) + '  ' + this.textarea.value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
        this.updateGutter();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.run(true);
      }
    });

    this.root.querySelector('[data-action="run"]').addEventListener('click', () => this.run(true));
    this.root.querySelector('[data-action="reset"]').addEventListener('click', () => this.reset());
    this.root.querySelector('[data-action="copy"]').addEventListener('click', () => this.copyCode());

    this.container.appendChild(this.root);
  }

  flashStatus(text) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.classList.add('visible');
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      this.statusEl.classList.remove('visible');
    }, 1400);
  }

  async copyCode() {
    try {
      await navigator.clipboard.writeText(this.textarea.value);
      this.flashStatus('Copied!');
    } catch {
      this.flashStatus('Copy failed');
    }
  }

  updateGutter() {
    const lines = this.textarea.value.split('\n').length;
    let nums = '';
    for (let i = 1; i <= lines; i++) {
      nums += i + '\n';
    }
    this.gutter.textContent = nums;
    const height = Math.max(140, Math.min(380, lines * 22 + 24));
    this.textarea.style.height = `${height}px`;
    this.gutter.style.height = `${height}px`;
  }

  reset() {
    this.textarea.value = this.initialCode;
    this.updateGutter();
    this.run(true);
    this.flashStatus('Reset to default');
  }

  formatValue(val) {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }

  async run(animate = true) {
    if (animate) {
      this.root.classList.remove('is-running');
      void this.root.offsetWidth;
      this.root.classList.add('is-running');
    }

    const logs = [];
    const customConsole = {
      log: (...args) => logs.push(args.map((a) => this.formatValue(a)).join(' ')),
      warn: (...args) => logs.push('[warn] ' + args.map((a) => this.formatValue(a)).join(' ')),
      error: (...args) => logs.push('[error] ' + args.map((a) => this.formatValue(a)).join(' '))
    };

    const scopeKeys = Object.keys(GameKit);
    const scopeValues = scopeKeys.map((k) => GameKit[k]);

    this.outputEl.classList.remove('is-error');
    const t0 = performance.now();

    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(...scopeKeys, 'console', this.textarea.value);
      const result = await fn(...scopeValues, customConsole);
      const elapsed = (performance.now() - t0).toFixed(2);

      if (result !== undefined) {
        logs.push('Return: ' + this.formatValue(result));
      }

      this.outputEl.textContent = logs.length > 0 ? logs.join('\n') : '(Executed with no console.log output)';
      if (this.timeEl) this.timeEl.textContent = `Executed in ${elapsed} ms`;
      if (animate) this.flashStatus('Executed');
    } catch (err) {
      this.outputEl.classList.add('is-error');
      this.outputEl.textContent = `${err.name}: ${err.message}`;
      if (this.timeEl) this.timeEl.textContent = 'Error';
    }
  }
}