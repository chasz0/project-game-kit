import { Stats } from '@gameplay/stats.js';

const out = document.getElementById('output');
const hero = new Stats({ maxHealth: 100, speed: 10, damage: 25 });

// Every toggleable modifier lives in one table: id -> what it does.
const buffs = {
  sprint:   { label: '+50% speed', stat: 'speed',     type: 'percent', value: 0.5 },
  vitality: { label: '+50 max HP', stat: 'maxHealth', type: 'add',     value: 50 },
  curse:    { label: '-30 max HP', stat: 'maxHealth', type: 'add',     value: -30 },
};

let message = '';

const bar = (ratio, size = 20) => {
  const filled = Math.round(ratio * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
};

const render = () => {
  // hasModifier() is the source of truth, so there are no flags to get out of sync.
  const active = Object.entries(buffs)
    .filter(([id]) => hero.hasModifier(id))
    .map(([, buff]) => buff.label);

  let text = `--- Hero Stats ---\n`;
  text += `HP: ${hero.health} / ${hero.maxHealth}\n`;
  text += `[${bar(hero.healthRatio)}]\n`;
  text += `Speed: ${hero.get('speed')}\n`;
  text += `Damage: ${hero.get('damage')}\n\n`;
  text += `Active modifiers: ${active.length ? active.join(', ') : 'none'}\n`;

  if (hero.dead) text += `\n[ HERO DIED ]\n`;
  if (message) text += `\n> ${message}\n`;

  out.textContent = text;
};

const on = (id, handler) => {
  document.getElementById(id).addEventListener('click', () => {
    message = handler() || '';
    render();
  });
};

const hit = (amount) => {
  if (hero.dead) return 'Already dead: damage ignored.';
  return hero.takeDamage(amount)
    ? `Took ${amount} damage. Killing blow! (takeDamage returned true once)`
    : `Took ${amount} damage.`;
};

const toggle = (id) => {
  const buff = buffs[id];
  if (hero.hasModifier(id)) {
    hero.removeModifier(id);
    return `Removed ${buff.label}.`;
  }
  hero.addModifier(id, buff.stat, buff.type, buff.value);
  return `Added ${buff.label}.`;
};

on('dmgBtn', () => hit(15));
on('bigDmgBtn', () => hit(999));

on('healBtn', () => {
  if (hero.dead) return 'Dead heroes cannot be healed. Use Revive.';
  hero.heal(20);
  return 'Healed 20.';
});

on('reviveBtn', () =>
  hero.revive(50) ? 'Revived with 50 HP.' : 'Hero is alive: revive() did nothing.'
);

on('buffBtn', () => toggle('sprint'));
on('buffBtn2', () => toggle('vitality'));
on('curseBtn', () => toggle('curse'));

render();