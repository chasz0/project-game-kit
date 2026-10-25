// 2D Camera with smooth following, screen shake, and zoom capabilities.
// const cam = new Camera(800, 600);
// cam.follow(player, 0.1);
// cam.apply(ctx);

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

  follow(target, lerp = 1) {
    const targetX = target.x - this.width / (2 * this.zoom);
    const targetY = target.y - this.height / (2 * this.zoom);
    
    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;
  }

  shake(durationMs, intensity) {
    this.shakeTimer = durationMs;
    this.shakeIntensity = intensity;
  }

  setZoom(level) {
    this.zoom = Math.max(0.1, level);
  }

  update(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.offsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.offsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
      this.shakeTimer = 0;
    }
  }

  apply(ctx) {
    // Reset transform, then apply zoom and translation
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.offsetX, -this.y + this.offsetY);
  }
}