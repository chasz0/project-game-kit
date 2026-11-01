// Maps keyboard and mouse inputs to named actions.
//
//   input.setTarget(canvas);
//   input.bind('shoot', ['Space', 'Mouse0']);
//   if (input.isPressed('shoot')) fire();
//   input.update(); // call at the end of each fixed update step

export class InputManager {
  constructor(targetElement = null) {
    this.bindings = new Map();
    this.state = new Map();
    this.prevState = new Map();
    this.mouse = { x: 0, y: 0 };
    this.targetElement = targetElement;
    this._attached = false;

    this._onKeyDown = (e) => this.state.set(e.code, true);
    this._onKeyUp = (e) => this.state.set(e.code, false);
    this._onMouseDown = (e) => {
      this._updateMouse(e);
      this.state.set(`Mouse${e.button}`, true);
    };
    this._onMouseUp = (e) => {
      this._updateMouse(e);
      this.state.set(`Mouse${e.button}`, false);
    };
    this._onBlur = () => {
      this.state.clear();
      this.prevState.clear();
    };
    this._onMouseMove = (e) => {
      this._updateMouse(e);
    };

    if (typeof window !== 'undefined') {
      this.attach();
    }
  }

  _resolveTarget(e) {
    if (this.targetElement) return this.targetElement;
    if (typeof HTMLCanvasElement !== 'undefined' && e?.target instanceof HTMLCanvasElement) {
      return e.target;
    }
    if (typeof document !== 'undefined') {
      return document.querySelector('canvas');
    }
    return null;
  }

  _updateMouse(e) {
    const el = this._resolveTarget(e);
    if (!el) {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const style = typeof window !== 'undefined' ? window.getComputedStyle(el) : null;
    const padLeft = style ? parseFloat(style.paddingLeft) || 0 : 0;
    const padRight = style ? parseFloat(style.paddingRight) || 0 : 0;
    const padTop = style ? parseFloat(style.paddingTop) || 0 : 0;
    const padBottom = style ? parseFloat(style.paddingBottom) || 0 : 0;

    const borderLeft = el.clientLeft || 0;
    const borderTop = el.clientTop || 0;
    const contentW = (el.clientWidth || rect.width) - padLeft - padRight;
    const contentH = (el.clientHeight || rect.height) - padTop - padBottom;

    const logicalW = el.width || contentW;
    const logicalH = el.height || contentH;

    let renderW = contentW;
    let renderH = contentH;
    let offsetX = 0;
    let offsetY = 0;

    const fit = style ? style.objectFit : 'fill';
    if (fit === 'contain' || (fit === 'scale-down' && (logicalW > contentW || logicalH > contentH))) {
      const scale = Math.min(contentW / logicalW, contentH / logicalH);
      renderW = logicalW * scale;
      renderH = logicalH * scale;
      offsetX = (contentW - renderW) * 0.5;
      offsetY = (contentH - renderH) * 0.5;
    } else if (fit === 'cover') {
      const scale = Math.max(contentW / logicalW, contentH / logicalH);
      renderW = logicalW * scale;
      renderH = logicalH * scale;
      offsetX = (contentW - renderW) * 0.5;
      offsetY = (contentH - renderH) * 0.5;
    }

    const relX = e.clientX - rect.left - borderLeft - padLeft - offsetX;
    const relY = e.clientY - rect.top - borderTop - padTop - offsetY;

    this.mouse.x = renderW > 0 ? (relX / renderW) * logicalW : 0;
    this.mouse.y = renderH > 0 ? (relY / renderH) * logicalH : 0;
  }

  attach() {
    if (this._attached || typeof window === 'undefined') return;
    window.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('keyup', this._onKeyUp, true);
    window.addEventListener('mousedown', this._onMouseDown, true);
    window.addEventListener('mouseup', this._onMouseUp, true);
    window.addEventListener('mousemove', this._onMouseMove, true);
    window.addEventListener('blur', this._onBlur);
    this._attached = true;
  }

  detach() {
    if (!this._attached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('keyup', this._onKeyUp, true);
    window.removeEventListener('mousedown', this._onMouseDown, true);
    window.removeEventListener('mouseup', this._onMouseUp, true);
    window.removeEventListener('mousemove', this._onMouseMove, true);
    window.removeEventListener('blur', this._onBlur);
    this._attached = false;
  }

  setTarget(element) {
    this.targetElement = element;
  }

  bind(action, keys) {
    this.bindings.set(action, Array.isArray(keys) ? keys : [keys]);
  }

  isDown(action) {
    const keys = this.bindings.get(action);
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) {
      if (this.state.get(keys[i])) return true;
    }
    return false;
  }

  isPressed(action) {
    const keys = this.bindings.get(action);
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (this.state.get(k) && !this.prevState.get(k)) return true;
    }
    return false;
  }

  isReleased(action) {
    const keys = this.bindings.get(action);
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!this.state.get(k) && this.prevState.get(k)) return true;
    }
    return false;
  }

  update() {
    this.prevState.clear();
    for (const [key, val] of this.state) {
      if (val) this.prevState.set(key, true);
    }
  }
}

export const input = new InputManager();