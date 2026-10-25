import { Pool } from '@gameplay/pool.js';

const out = document.getElementById('output');
const spawnBtn = document.getElementById('spawnBtn');
const killBtn = document.getElementById('killBtn');

class Particle {
  constructor() {
    this.id = Math.random().toString(36).substring(2, 7);
    this.active = false;
  }

  init() {
    this.active = true;
  }

  reset() {
    this.active = false;
  }
}

// The pool now calls init() on get() and reset() on release() for us.
const particlePool = new Pool({
  create: () => new Particle(),
  init: (p) => p.init(),
  reset: (p) => p.reset(),
  size: 10,
});

const activeParticles = [];

const render = () => {
  out.textContent = `Idle in pool: ${particlePool.available}\nIn use: ${particlePool.inUse}\n\n`;
  out.textContent += `Total objects in memory: ${particlePool.available + particlePool.inUse}`;
};

spawnBtn.addEventListener('click', () => {
  for (let i = 0; i < 5; i++) {
    activeParticles.push(particlePool.get());
  }
  render();
});

killBtn.addEventListener('click', () => {
  for (let i = 0; i < 3; i++) {
    if (activeParticles.length > 0) {
      particlePool.release(activeParticles.pop());
    }
  }
  render();
});

render();