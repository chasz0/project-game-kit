import { timer } from '@core/timer.js';

const out = document.getElementById('output');
const fuseBar = document.getElementById('fuseBar');
const fuseTimer = document.getElementById('fuseTimer');
const doorBar = document.getElementById('doorBar');

const BOMB_DURATION = 2500;
let bombHandle = null;
let poisonHandle = null;
let doorOpen = false;
const logs = ['Timer sandbox ready.'];

const renderOut = () => {
  out.textContent = `Active Timers in Manager: ${timer.timers.length}\n\n` + logs.join('\n');
};

const log = (msg) => {
  logs.unshift(`[${(performance.now() / 1000).toFixed(1)}s] ${msg}`);
  if (logs.length > 8) logs.pop();
  renderOut();
};

document.getElementById('bombBtn').addEventListener('click', () => {
  if (bombHandle) {
    log('Bomb is already ticking!');
    return;
  }
  fuseBar.style.background = '#c96b6b';
  fuseTimer.textContent = '2.50s';

  bombHandle = timer.add(
    BOMB_DURATION,
    () => {
      bombHandle = null;
      fuseBar.style.width = '0%';
      fuseTimer.textContent = 'EXPLODED (0.00s)';
      log('BOOM! Bomb exploded for 100 AoE damage.');
    },
    (progress) => {
      fuseBar.style.width = `${progress * 100}%`;
      const remaining = ((1 - progress) * (BOMB_DURATION / 1000)).toFixed(2);
      fuseTimer.textContent = `${remaining}s`;
    }
  );
  log('Planted bomb! Explodes in 2.5s...');
});

document.getElementById('defuseBtn').addEventListener('click', () => {
  if (!bombHandle) {
    log('No active bomb to defuse.');
    return;
  }
  const stoppedAt = ((1 - bombHandle.elapsed / bombHandle.duration) * (BOMB_DURATION / 1000)).toFixed(2);
  timer.cancel(bombHandle);
  bombHandle = null;
  fuseBar.style.background = '#6bc98f';
  fuseTimer.textContent = `DEFUSED (${stoppedAt}s left)`;
  log(`Bomb defused with ${stoppedAt}s remaining!`);
});

document.getElementById('tweenBtn').addEventListener('click', () => {
  const targetOpen = !doorOpen;
  doorOpen = targetOpen;

  timer.add(
    1200,
    () => log(`Door fully ${targetOpen ? 'OPEN' : 'CLOSED'}.`),
    (progress) => {
      const ratio = targetOpen ? progress : 1 - progress;
      doorBar.style.width = `${ratio * 100}%`;
    }
  );
  log(`Tweening blast door ${targetOpen ? 'OPEN' : 'CLOSED'} over 1.2s...`);
});

document.getElementById('dotBtn').addEventListener('click', () => {
  if (poisonHandle) {
    timer.cancel(poisonHandle);
    poisonHandle = null;
    log('Poison zone deactivated.');
  } else {
    poisonHandle = timer.every(500, () => {
      log('Poison tick: -5 HP');
    });
    log('Poison zone active (ticking every 500ms)...');
  }
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;
  timer.update(dt);
  renderOut();
  requestAnimationFrame(loop);
};

log('Click a button above to schedule delays, tweens, or repeating ticks.');
requestAnimationFrame(loop);