import { StateMachine } from '@gameplay/stateMachine.js';

const out = document.getElementById('output');
const log = (msg) => out.textContent += msg + '\n';

const fsm = new StateMachine();

fsm.add('idle', {
  enter: () => log('[ENTER] Idle: Looking around.'),
  update: (dt) => log(`[UPDATE] Idle: Resting for ${dt}ms.`),
  exit: () => log('[EXIT] Idle: Spotted something!')
});

fsm.add('chase', {
  enter: () => log('[ENTER] Chase: Running towards target!'),
  update: (dt) => log(`[UPDATE] Chase: Closing distance...`),
  exit: () => log('[EXIT] Chase: In range.')
});

fsm.add('attack', {
  enter: () => log('[ENTER] Attack: Swinging weapon!'),
  update: (dt) => log(`[UPDATE] Attack: Dealing damage!`),
  exit: () => log('[EXIT] Attack: Stepping back.')
});

document.getElementById('btnIdle').addEventListener('click', () => {
  out.textContent = '';
  fsm.change('idle');
  fsm.update(16);
});

document.getElementById('btnChase').addEventListener('click', () => {
  out.textContent = '';
  fsm.change('chase');
  fsm.update(16);
});

document.getElementById('btnAttack').addEventListener('click', () => {
  out.textContent = '';
  fsm.change('attack');
  fsm.update(16);
});

// Initial state
fsm.change('idle');