import { Progression } from '@gameplay/progression.js';

const out = document.getElementById('output');
const draftBox = document.getElementById('draftBox');

const prog = new Progression({ baseXp: 10, growthFactor: 1.35, linearStep: 5 });

prog
  .registerUpgrade({ id: 'dmg', title: 'Damage Up', desc: '+25% Bullet Damage', maxRank: 3, weight: 3 })
  .registerUpgrade({ id: 'spd', title: 'Move Speed', desc: '+15% Move Speed', maxRank: 3, weight: 3 })
  .registerUpgrade({ id: 'rof', title: 'Rapid Fire', desc: '-15% Fire Delay', maxRank: 2, weight: 2 })
  .registerUpgrade({ id: 'prc', title: 'Piercing Rounds', desc: '+1 Pierce', maxRank: 2, weight: 1 })
  .registerUpgrade({ id: 'hp',  title: 'Max Health', desc: '+40 Max HP', maxRank: 5, weight: 3 });

const bar = (ratio, size = 22) => {
  const filled = Math.round(ratio * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
};

const render = () => {
  draftBox.innerHTML = '';

  if (prog.pendingLevels > 0) {
    const choices = prog.rollChoices(3);
    if (choices.length > 0) {
      draftBox.innerHTML = `<p style="color:var(--accent); font-size:0.85rem; margin-bottom:0.4rem;">Pending Level-Up (${prog.pendingLevels}) — Pick an Upgrade:</p>`;
      choices.forEach((c) => {
        const btn = document.createElement('button');
        btn.textContent = `${c.title} (Rank ${c.currentRank}/${c.maxRank})`;
        btn.addEventListener('click', () => {
          prog.selectUpgrade(c.id);
          render();
        });
        draftBox.appendChild(btn);
      });
    }
  }

  let text = `Level: ${prog.level} | XP: ${prog.xp} / ${prog.xpToNext}\n`;
  text += `[${bar(prog.xpRatio)}]\n\n`;
  text += `--- Acquired Upgrade Ranks ---\n`;
  for (const u of prog.upgrades.values()) {
    const rank = prog.getRank(u.id);
    text += `${u.title.padEnd(18)} Rank ${rank} / ${u.maxRank} ${rank >= u.maxRank ? '[MAXED - Removed from pool]' : ''}\n`;
  }

  out.textContent = text;
};

document.getElementById('btnXpSmall').addEventListener('click', () => { prog.addXp(6); render(); });
document.getElementById('btnXpLarge').addEventListener('click', () => { prog.addXp(25); render(); });
document.getElementById('btnResetProg').addEventListener('click', () => { prog.reset(); render(); });

render();