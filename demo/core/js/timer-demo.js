import { timer } from '@core/timer.js';

const out = document.getElementById('output');
const btn = document.getElementById('skillBtn');
const bar = document.getElementById('bar');

let lastTime = performance.now();
let isCooldown = false;

const log = (msg) => out.textContent += msg + '\n';

btn.addEventListener('click', () => {
  if (isCooldown) {
    log('Skill is on cooldown!');
    return;
  }
  
  isCooldown = true;
  log('Skill used! Cooldown started (2 seconds).');
  
  timer.add(
    2000, 
    () => {
      isCooldown = false;
      log('Cooldown finished. Skill ready.');
      bar.style.width = '0%';
    },
    (progress) => {
      // Tween the progress bar width
      bar.style.width = `${progress * 100}%`;
    }
  );
});

const loop = (currentTime) => {
  const dt = currentTime - lastTime;
  lastTime = currentTime;
  
  timer.update(dt);
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);