import { events } from '@core/events.js';

const out = document.getElementById('output');
const log = (msg) => out.textContent += msg + '\n';

const onLevelUp = (data) => {
  log(`System A: Player leveled up to ${data.level}!`);
};

const playSound = (data) => {
  log(`System B: Playing level up sound for level ${data.level}`);
};

// Register listeners
events.on('levelUp', onLevelUp);
events.on('levelUp', playSound);

log('Emitting levelUp event...');
events.emit('levelUp', { level: 2 });

// Remove one listener and fire again
events.off('levelUp', playSound);
log('\nEmitting levelUp event after removing System B...');
events.emit('levelUp', { level: 3 });