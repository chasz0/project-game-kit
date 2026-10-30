import { AbilityManager } from '@gameplay/abilities.js';

const out = document.getElementById('output');
const btnHaste = document.getElementById('btnHaste');

const abilities = new AbilityManager();
let hasteActive = false;
let autoShots = 0;
let lastAction = 'Ready.';

abilities
  .register('blaster', {
    cooldown: 600,
    charges: 1,
    auto: true,
    onUse: () => { autoShots++; }
  })
  .register('dash', {
    cooldown: 1800,
    charges: 2,
    duration: 250,
    onUse: () => { lastAction = 'Dashed! (Invulnerable for 250ms)'; }
  })
  .register('shockwave', {
    cooldown: 3000,
    charges: 1,
    duration: 500,
    onUse: () => { lastAction = 'Shockwave cast!'; }
  });

const getScale = () => (hasteActive ? 0.6 : 1.0);

document.getElementById('btnDash').addEventListener('click', () => {
  if (!abilities.use('dash', null, getScale())) {
    lastAction = 'Dash has no charges left!';
  }
});

document.getElementById('btnNova').addEventListener('click', () => {
  if (!abilities.use('shockwave', null, getScale())) {
    lastAction = 'Shockwave is on cooldown!';
  }
});

btnHaste.addEventListener('click', () => {
  hasteActive = !hasteActive;
  btnHaste.textContent = `Toggle 40% Cooldown Haste: ${hasteActive ? 'ON' : 'OFF'}`;
});

const bar = (ratio, size = 18) => {
  const filled = Math.round((1 - ratio) * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
};

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  abilities.update(dt, null, getScale());

  const b = abilities.getState('blaster');
  const d = abilities.getState('dash');
  const s = abilities.getState('shockwave');

  out.textContent =
    `Cooldown Scale: ${(getScale() * 100).toFixed(0)}%\n\n` +
    `[Auto Blaster]  [${bar(b.cooldownRatio)}]  Shots Fired: ${autoShots}\n` +
    `[Dash Skill]    [${bar(d.cooldownRatio)}]  Charges: ${d.charges}/${d.maxCharges} ${d.isActive ? '(DASHING!)' : ''}\n` +
    `[Shockwave]     [${bar(s.cooldownRatio)}]  ${s.ready ? 'READY' : (s.cooldownLeft / 1000).toFixed(1) + 's'}\n\n` +
    `> ${lastAction}`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);