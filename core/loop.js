// Fixed-timestep game loop for stable physics and framerate-independent updates.
// const loop = new GameLoop((dt) => update(dt), () => render());
// loop.start();

export class GameLoop {
  constructor(updateFn, renderFn, fps = 60) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.step = 1000 / fps;
    this.lastTime = 0;
    this.accumulator = 0;
    this.rafId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame((time) => this.frame(time));
  }

  stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.rafId);
  }

  frame(currentTime) {
    if (!this.isRunning) return;

    let deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    if (deltaTime > 250) {
      deltaTime = 250;
    }

    this.accumulator += deltaTime;

    while (this.accumulator >= this.step) {
      this.updateFn(this.step);
      this.accumulator -= this.step;
    }

    this.renderFn();
    this.rafId = requestAnimationFrame((time) => this.frame(time));
  }
}