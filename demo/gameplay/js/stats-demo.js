import { Stats } from '@gameplay/stats.js';

const out = document.getElementById('output');
const dmgBtn = document.getElementById('dmgBtn');
const healBtn = document.getElementById('healBtn');
const buffBtn = document.getElementById('buffBtn');

const hero = new Stats({ maxHealth: 100, speed: 10, damage: 25 });
let hasBuff = false;

const render = () => {
  let text = `--- Hero Stats ---\n`;
  text += `HP: ${hero.health} / ${hero.get('maxHealth')}\n`;
  text += `Speed: ${hero.get('speed')}\n`;
  text += `Damage: ${hero.get('damage')}\n\n`;
  text += `Active Speed Buff: ${hasBuff ? 'YES (+50%)' : 'NO'}\n`;
  
  if (hero.health === 0) {
    text += `\n[ HERO DIED ]`;
  }
  
  out.textContent = text;
};

dmgBtn.addEventListener('click', () => {
  hero.takeDamage(15);
  render();
});

healBtn.addEventListener('click', () => {
  hero.heal(20);
  render();
});

buffBtn.addEventListener('click', () => {
  hasBuff = !hasBuff;
  if (hasBuff) {
    hero.addModifier('sprint', 'speed', 'mult', 0.5);
  } else {
    hero.removeModifier('sprint');
  }
  render();
});

render();