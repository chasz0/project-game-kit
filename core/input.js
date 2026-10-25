// Maps physical keyboard and mouse inputs to logical game actions.
// Call input.update() at the end of your game loop to cycle states.
// input.bind('jump', ['Space', 'ArrowUp']);
// if (input.isPressed('jump')) { ... }

class InputManager {
  constructor() {
    this.bindings = new Map();
    this.state = new Map();
    this.prevState = new Map();
    this.mouse = { x: 0, y: 0 };

    window.addEventListener('keydown', (e) => this.state.set(e.code, true));
    window.addEventListener('keyup', (e) => this.state.set(e.code, false));
    window.addEventListener('mousedown', (e) => this.state.set(`Mouse${e.button}`, true));
    window.addEventListener('mouseup', (e) => this.state.set(`Mouse${e.button}`, false));
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
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
    this.prevState = new Map(this.state);
  }
}

export const input = new InputManager();