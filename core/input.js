// Maps physical keyboard and mouse inputs to logical game actions.

class InputManager {
  constructor() {
    this.bindings = new Map();
    this.state = new Map();
    this.prevState = new Map();
    this.mouse = { x: 0, y: 0 };
    this.targetElement = document.body;

    window.addEventListener('keydown', (e) => this.state.set(e.code, true));
    window.addEventListener('keyup', (e) => this.state.set(e.code, false));
    window.addEventListener('mousedown', (e) => this.state.set(`Mouse${e.button}`, true));
    window.addEventListener('mouseup', (e) => this.state.set(`Mouse${e.button}`, false));
    
    window.addEventListener('blur', () => {
      this.state.clear();
      this.prevState.clear();
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.targetElement.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
  }

  setTarget(element) {
    this.targetElement = element;
  }

  bind(action, keys) {
    this.bindings.set(action, Array.isArray(keys) ? keys : [keys]);
  }

  isDown(action) {
    const keys = this.bindings.get(action) || [];
    return keys.some(key => this.state.get(key));
  }

  isPressed(action) {
    const keys = this.bindings.get(action) || [];
    return keys.some(key => this.state.get(key) && !this.prevState.get(key));
  }

  isReleased(action) {
    const keys = this.bindings.get(action) || [];
    return keys.some(key => !this.state.get(key) && this.prevState.get(key));
  }

  update() {
    this.prevState.clear();
    for (const [key, value] of this.state) {
      this.prevState.set(key, value);
    }
  }
}

export const input = new InputManager();