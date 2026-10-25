// Finite State Machine for entity AI and game state transitions.
//
//   const fsm = new StateMachine();
//   fsm.add('idle', { enter: () => {}, update: (dt) => {}, exit: () => {} });
//   fsm.change('idle');
//   fsm.update(dt);

export class StateMachine {
  constructor() {
    this.states = new Map();
    this.current = null;
    this.currentStateName = '';
  }

  add(name, config = {}) {
    this.states.set(name, config);
    return this;
  }

  has(name) {
    return this.states.has(name);
  }

  change(name, enterParams) {
    if (!this.states.has(name)) {
      throw new Error(`StateMachine: unknown state "${name}"`);
    }

    if (this.current && this.current.exit) {
      this.current.exit();
    }

    this.currentStateName = name;
    this.current = this.states.get(name);

    if (this.current.enter) {
      this.current.enter(enterParams);
    }
  }

  update(dt) {
    if (this.current && this.current.update) {
      this.current.update(dt);
    }
  }
}