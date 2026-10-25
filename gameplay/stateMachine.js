// Finite State Machine for managing entity behaviors and game flows.
// fsm.add('idle', { enter: () => {}, update: (dt) => {}, exit: () => {} });
// fsm.change('idle');

export class StateMachine {
  constructor() {
    this.states = new Map();
    this.current = null;
    this.currentStateName = '';
  }

  add(name, config) {
    this.states.set(name, config);
  }

  change(name, enterParams) {
    if (!this.states.has(name)) return;

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