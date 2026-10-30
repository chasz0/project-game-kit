import { timer } from '@core/timer.js';

const out = document.getElementById('output');
const fuseBar = document.getElementById('fuseBar');
const doorBar = document.getElementById('doorBar');

let bombHandle = null;
let poisonHandle = null;
let doorOpen = false;
const logs = ['Timer sandbox ready.'];

const log = (msg) => {
  logs.unshift(`[${(performance.now() / 1000).toFixed(1)}s] ${msg}`);
  if (logs.length > 8) logs.pop();
  out.textContent = `Active Timers in Manager: ${timer.timers.length}\n\n` + logs.join('\n');
};

document.getElementById('bombBtn').addEventListener('click', () => {
  if (bombHandle) {
    log('Bomb is already ticking!');
    return;
  }
  log('Planted bomb! Explodes in 2.5s...');
  bombHandle = timer.add(
    2500,
    () => {
      bombHandle = null;
      fuseBar.style.width = '0%';
      log('BOOM! Bomb exploded for 100 AoE damage.');
    },
    (progress) => {
      fuseBar.style.width = `${progress * 100}%`;
    }
  );
});

document.getElementById('defuseBtn').addEventListener('click', () => {
  if (!bombHandle) {
    log('No active bomb to defuse.');
    return;
  }
  timer.cancel(bombHandle);
  bombHandle = null;
  fuseBar.style.width = '0%';
  log('Bomb defused via timer.cancel()!');
});

document.getElementById('tweenBtn').addEventListener('click', () => {
  const targetOpen = !doorOpen;
  doorOpen = targetOpen;
  log(`Tweening blast door ${targetOpen ? 'OPEN' : 'CLOSED'} over 1.2s...`);

  timer.add(
    1200,
    () => log(`Door fully ${targetOpen ? 'OPEN' : 'CLOSED'}.`),
    (progress) => {
      const ratio = targetOpen ? progress : 1 - progress;
      doorBar.style.width = `${ratio * 100}%`;
    }
  );
});

document.getElementById('dotBtn').addEventListener('click', () => {
  if (poisonHandle) {
    timer.cancel(poisonHandle);
    poisonHandle = null;
    log('Poison zone deactivated.');
  } else {
    log('Poison zone active (ticking every 500ms)...');
    poisonHandle = timer.every(500, () => {
      log('Poison tick: -5 HP');
    });
  }
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;
  timer.update(dt);
  requestAnimationFrame(loop);
};

log('Click a button above to schedule delays, tweens, or repeating ticks.');
requestAnimationFrame(loop);