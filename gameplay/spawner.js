// Timed wave progression and geometric spawn position calculator.
//
//   const spawner = new WaveSpawner({ rng: () => rng.next() });
//   spawner.addWave({ duration: 15000, interval: 2000, count: 6, types: [{ id: 'grunt', weight: 3 }] });
//   spawner.update(dt, player.x, player.y, (spawn) => createEnemy(spawn));

export class WaveSpawner {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.waves = [];
    this.waveIndex = 0;
    this.waveNumber = 1;
    this.waveElapsed = 0;
    this.spawnTimer = 0;
    this.totalSpawned = 0;
  }

  addWave({
    duration = 15000,
    interval = 2500,
    count = 5,
    shape = 'ring',
    minRadius = 380,
    maxRadius = 520,
    width = 800,
    height = 600,
    types = [{ id: 'default', weight: 1 }]
  } = {}) {
    this.waves.push({
      duration,
      interval: Math.max(50, interval),
      count: Math.max(1, count),
      shape,
      minRadius,
      maxRadius,
      width,
      height,
      types
    });
    return this;
  }

  get currentWave() {
    if (this.waves.length === 0) return null;
    return this.waves[Math.min(this.waveIndex, this.waves.length - 1)];
  }

  update(dt, centerX = 0, centerY = 0, onSpawn = null) {
    const wave = this.currentWave;
    if (!wave) return 0;

    this.waveElapsed += dt;
    this.spawnTimer += dt;

    if (this.waveElapsed >= wave.duration) {
      this.waveElapsed -= wave.duration;
      this.waveNumber++;
      if (this.waveIndex < this.waves.length - 1) {
        this.waveIndex++;
      }
    }

    let spawnedNow = 0;
    const active = this.currentWave;

    while (this.spawnTimer >= active.interval) {
      this.spawnTimer -= active.interval;
      for (let i = 0; i < active.count; i++) {
        const pos = this._computePoint(active, centerX, centerY);
        const type = this._pickWeighted(active.types);
        this.totalSpawned++;
        spawnedNow++;
        if (onSpawn) {
          onSpawn({ x: pos.x, y: pos.y, type, wave: this.waveNumber });
        }
      }
    }

    return spawnedNow;
  }

  pointOnRing(cx, cy, minR, maxR, out = { x: 0, y: 0 }) {
    const angle = this.rng() * Math.PI * 2;
    const r = minR + this.rng() * (maxR - minR);
    out.x = cx + Math.cos(angle) * r;
    out.y = cy + Math.sin(angle) * r;
    return out;
  }

  pointOnPerimeter(cx, cy, w, h, out = { x: 0, y: 0 }) {
    const halfW = w * 0.5;
    const halfH = h * 0.5;
    const edge = Math.floor(this.rng() * 4);
    const t = (this.rng() - 0.5) * 2;

    if (edge === 0) { out.x = cx + t * halfW; out.y = cy - halfH; }
    else if (edge === 1) { out.x = cx + halfW; out.y = cy + t * halfH; }
    else if (edge === 2) { out.x = cx + t * halfW; out.y = cy + halfH; }
    else { out.x = cx - halfW; out.y = cy + t * halfH; }
    return out;
  }

  reset() {
    this.waveIndex = 0;
    this.waveNumber = 1;
    this.waveElapsed = 0;
    this.spawnTimer = 0;
    this.totalSpawned = 0;
  }

  _computePoint(wave, cx, cy) {
    if (wave.shape === 'perimeter') {
      return this.pointOnPerimeter(cx, cy, wave.width, wave.height);
    }
    return this.pointOnRing(cx, cy, wave.minRadius, wave.maxRadius);
  }

  _pickWeighted(types) {
    let total = 0;
    for (let i = 0; i < types.length; i++) {
      total += types[i].weight ?? 1;
    }
    let roll = this.rng() * total;
    for (let i = 0; i < types.length; i++) {
      roll -= types[i].weight ?? 1;
      if (roll <= 0) return types[i].id;
    }
    return types[types.length - 1].id;
  }
}