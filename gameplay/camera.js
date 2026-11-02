// 2D viewport camera with frame-rate independent follow, screen shake, and zoom.
//
//   const cam = new Camera(800, 600);
//   cam.follow(player, 0.1, dt);
//   cam.update(dt);
//   cam.apply(ctx);
//   const worldPos = cam.screenToWorld(mouseX, mouseY);

export class Camera {
  constructor(viewportWidth, viewportHeight) {
    this.width = viewportWidth;
    this.height = viewportHeight;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;

    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  // Smoothly tracks target. Pass dt (ms) for frame-rate independent damping.
  follow(target, lerp = 1, dt = 16.67) {
    const targetX = target.x - this.width / (2 * this.zoom);
    const targetY = target.y - this.height / (2 * this.zoom);
    const factor = lerp >= 1 ? 1 : 1 - Math.pow(1 - lerp, dt / 16.67);

    this.x += (targetX - this.x) * factor;
    this.y += (targetY - this.y) * factor;
  }

  shake(durationMs, intensity) {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(this.shakeTimer, durationMs);
      this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    } else {
      this.shakeTimer = Math.max(0, durationMs);
      this.shakeIntensity = Math.max(0, intensity);
    }
  }

  setZoom(level) {
    this.zoom = Math.max(0.1, level);
  }

  screenToWorld(screenX, screenY, out = { x: 0, y: 0 }) {
    out.x = screenX / this.zoom + this.x - this.offsetX;
    out.y = screenY / this.zoom + this.y - this.offsetY;
    return out;
  }

  worldToScreen(worldX, worldY, out = { x: 0, y: 0 }) {
    out.x = (worldX - this.x + this.offsetX) * this.zoom;
    out.y = (worldY - this.y + this.offsetY) * this.zoom;
    return out;
  }

  update(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (this.shakeTimer <= 0) {
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.offsetX = 0;
        this.offsetY = 0;
      } else {
        this.offsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
        this.offsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      }
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
      this.shakeTimer = 0;
      this.shakeIntensity = 0;
    }
  }

  apply(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.offsetX, -this.y + this.offsetY);
  }
}