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

const particlePool = new Pool(() => new Particle(), 10);
const activeParticles = [];

const render = () => {
  out.textContent = `Pool Size (Inactive): ${particlePool.items.length}\nActive Particles: ${activeParticles.length}\n\n`;
  out.textContent += `Total objects in memory: ${particlePool.items.length + activeParticles.length}`;
};

spawnBtn.addEventListener('click', () => {
  for (let i = 0; i < 5; i++) {
    const p = particlePool.get();
    p.init();
    activeParticles.push(p);
  }
  render();
});

killBtn.addEventListener('click', () => {
  for (let i = 0; i < 3; i++) {
    if (activeParticles.length > 0) {
      const p = activeParticles.pop();
      p.reset();
      particlePool.release(p);
    }
  }
  render();
});

render();