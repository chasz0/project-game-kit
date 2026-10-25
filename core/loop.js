// Fixed-timestep game loop.
// updateFn(dt) receives fixed step in milliseconds (default 16.67ms at 60Hz).
// renderFn(alpha) receives interpolation factor in [0, 1) for smooth rendering.
//
//   const loop = new GameLoop((dt) => update(dt), (alpha) => render(alpha));
//   loop.start();

export class GameLoop {
  constructor(updateFn, renderFn, targetFps = 60) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.step = 1000 / targetFps;
    this.lastTime = 0;
    this.accumulator = 0;
    this.rafId = null;
    this.isRunning = false;

    this.fps = 0;
    this._frameCount = 0;
    this._lastFpsTime = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const now = performance.now();
    this.lastTime = now;
    this._lastFpsTime = now;
    this._frameCount = 0;
    this.rafId = requestAnimationFrame((time) => this.frame(time));
  }

  stop() {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  frame(currentTime) {
    if (!this.isRunning) return;

    let deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    if (deltaTime > 250) deltaTime = 250;

    this.accumulator += deltaTime;

    while (this.accumulator >= this.step) {
      this.updateFn(this.step);
      this.accumulator -= this.step;
    }

    const alpha = this.accumulator / this.step;
    this.renderFn(alpha);

    this._frameCount++;
    if (currentTime - this._lastFpsTime >= 1000) {
      this.fps = this._frameCount;
      this._frameCount = 0;
      this._lastFpsTime = currentTime;
    }

    this.rafId = requestAnimationFrame((time) => this.frame(time));
  }
}