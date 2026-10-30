import { audio } from '@core/audio.js';

const out = document.getElementById('output');
const btnMute = document.getElementById('btnMute');
const logs = ['Click any sound button above to test the Web Audio synthesizer.'];

const log = (msg) => {
  logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (logs.length > 9) logs.pop();
  out.textContent =
    `Master Volume: ${(audio.masterVolume * 100).toFixed(0)}% | Muted: ${audio.muted}\n\n` +
    logs.join('\n');
};

const bindSound = (btnId, soundId) => {
  document.getElementById(btnId).addEventListener('click', () => {
    const played = audio.play(soundId);
    log(`audio.play('${soundId}') -> ${played ? 'PLAYED' : 'THROTTLED / MUTED'}`);
  });
};

bindSound('btnShoot', 'shoot');
bindSound('btnHit', 'hit');
bindSound('btnExplosion', 'explosion');
bindSound('btnPickup', 'pickup');
bindSound('btnDash', 'dash');
bindSound('btnLevelup', 'levelup');

document.getElementById('btnSwarmBurst').addEventListener('click', () => {
  let playedCount = 0;
  let blockedCount = 0;
  for (let i = 0; i < 50; i++) {
    if (audio.play('hit')) playedCount++;
    else blockedCount++;
  }
  log(`50 same-frame 'hit' calls -> Played: ${playedCount}, Blocked by throttleMs: ${blockedCount}`);
});

btnMute.addEventListener('click', () => {
  const isMuted = audio.toggleMute();
  btnMute.textContent = `Mute: ${isMuted ? 'ON' : 'OFF'}`;
  log(`Toggled mute -> ${isMuted}`);
});

log('Audio manager initialized with 6 procedural presets.');