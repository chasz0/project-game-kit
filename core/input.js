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
    this._onMouseDown = (e) => this.state.set(`Mouse${e.button}`, true);
    this._onMouseUp = (e) => this.state.set(`Mouse${e.button}`, false);
    this._onBlur = () => {
      this.state.clear();
      this.prevState.clear();
    };
    this._onMouseMove = (e) => {
      if (this.targetElement) {
        const rect = this.targetElement.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
      } else {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      }
    };

    if (typeof window !== 'undefined') {
      this.attach();
    }
  }

  attach() {
    if (this._attached || typeof window === 'undefined') return;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
    this._attached = true;
  }

  detach() {
    if (!this._attached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
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