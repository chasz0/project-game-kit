import { DialogueSystem } from '@ui/dialogue.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const out = document.getElementById('output');
const dlgSpeaker = document.getElementById('dlgSpeaker');
const dlgText = document.getElementById('dlgText');
const dlgChoices = document.getElementById('dlgChoices');

const player = { hp: 80, maxHp: 100, scrap: 40, damageBonus: 0 };

const renderChoiceButtons = () => {
  dlgChoices.innerHTML = '';
  const state = dialogue.getState();
  if (!state) return;

  if (state.choices.length > 0 && !state.isTyping) {
    state.choices.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.textContent = `${idx + 1}. ${c.label}`;
      btn.addEventListener('click', () => {
        dialogue.choose(idx);
        renderChoiceButtons();
      });
      dlgChoices.appendChild(btn);
    });
  }
};

const dialogue = new DialogueSystem({
  charsPerSecond: 50,
  onNodeEnter: () => renderChoiceButtons(),
  onEnd: () => {
    dlgSpeaker.textContent = 'DIALOGUE ENDED';
    dlgText.textContent = 'Returned to active combat.';
    dlgChoices.innerHTML = '';
  }
});

dialogue
  .addNode('shrine_intro', {
    speaker: 'CORRUPT OBELISK',
    text: 'The monolith hums with unstable energy. How do you proceed?',
    choices: [
      {
        label: 'Sacrifice 35 HP for +25% Damage (Requires >35 HP)',
        next: 'shrine_blood',
        condition: (p) => p.hp > 35,
        action: (p) => { p.hp -= 35; p.damageBonus += 25; }
      },
      {
        label: 'Insert 30 Scrap to Repair Armor (+20 HP)',
        next: 'shrine_scrap',
        condition: (p) => p.scrap >= 30,
        action: (p) => { p.scrap -= 30; p.hp = Math.min(p.maxHp, p.hp + 20); }
      },
      {
        label: 'Step away from the obelisk',
        next: null
      }
    ]
  })
  .addNode('shrine_blood', {
    speaker: 'CORRUPT OBELISK',
    text: 'Your vitality fuels the weapons core. (+25% Damage acquired)',
    next: null
  })
  .addNode('shrine_scrap', {
    speaker: 'CORRUPT OBELISK',
    text: 'Nanite plating reconstructed. (+20 HP restored)',
    next: null
  });

document.getElementById('btnStartShrine').addEventListener('click', () => {
  dialogue.start('shrine_intro', player);
});

document.getElementById('btnAdvance').addEventListener('click', () => {
  const wasTyping = dialogue.isTyping;
  dialogue.advance();
  if (wasTyping) renderChoiceButtons();
});

document.getElementById('btnBarkSurge').addEventListener('click', () => {
  dialogue.bark('OVERWATCH HQ', 'Radar spike! Swarm Director entering PEAK SURGE phase!', {
    duration: 3000,
    color: '#d9b978'
  });
});

document.getElementById('btnBarkBoss').addEventListener('click', () => {
  dialogue.bark('APEX TANK', 'ARMOR PLATING ENGAGED. TARGETING PLAYER.', {
    duration: 3000,
    color: '#c96b6b'
  });
});

let lastTime = performance.now();

const loop = (now) => {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  const wasTyping = dialogue.isTyping;
  dialogue.update(dt);
  if (wasTyping && !dialogue.isTyping) {
    renderChoiceButtons();
  }

  const state = dialogue.getState();
  if (state) {
    dlgSpeaker.textContent = state.speaker;
    dlgText.textContent = state.visibleText;
  }

  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#233452';
  ctx.font = '11px monospace';
  ctx.fillText('Live Combat Canvas (Non-blocking Radio Comms render below):', 16, 24);

  dialogue.renderBarkBanner(ctx, canvas.width, 44);

  out.textContent =
    `Player Context -> HP: ${player.hp}/${player.maxHp} | Scrap: ${player.scrap} | Damage Bonus: +${player.damageBonus}%\n` +
    `Active Bark Queue: ${dialogue.barkQueue.length} waiting | Dialogue Active: ${dialogue.isActive}`;

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);