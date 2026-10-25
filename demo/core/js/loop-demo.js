import { GameLoop } from '@core/loop.js';

const out = document.getElementById('output');
const btn = document.getElementById('toggleBtn');

let ticks = 0;
let frames = 0;

const update = (dt) => {
  ticks++;
};

const render = () => {
  frames++;
  out.textContent = `Updates (Fixed 60hz): ${ticks}\nRenders (Total): ${frames}\nCurrent FPS: ${loop.fps}`;
};

const loop = new GameLoop(update, render, 60);
loop.start();

btn.addEventListener('click', () => {
  if (loop.isRunning) {
    loop.stop();
    btn.textContent = 'Start Loop';
  } else {
    loop.start();
    btn.textContent = 'Stop Loop';
  }
});