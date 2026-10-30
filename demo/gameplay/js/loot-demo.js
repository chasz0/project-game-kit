import { LootTable } from '@gameplay/loot.js';

const out = document.getElementById('output');

const mobLoot = new LootTable({ dropChance: 0.65 })
  .add('scrap', { weight: 65, min: 3, max: 10 })
  .add('medkit', { weight: 25, min: 1, max: 1 })
  .add('speed_boost', { weight: 8, min: 1, max: 1 })
  .add('rare_beacon', { weight: 2, min: 1, max: 1 });

const bossLoot = new LootTable({ dropChance: 1.0 })
  .add('boss_core', { guaranteed: true, min: 1, max: 1 })
  .add('scrap', { weight: 50, min: 20, max: 40 })
  .add('medkit', { weight: 30, min: 1, max: 3 })
  .add('rare_beacon', { weight: 20, min: 1, max: 1 });

const log = [];

const show = (title, drops) => {
  const summary = drops.length
    ? drops.map((d) => `${d.id} x${d.count}`).join(', ')
    : 'Nothing dropped';
  log.unshift(`${title} -> ${summary}`);
  if (log.length > 10) log.pop();
  out.textContent = log.join('\n');
};

document.getElementById('btnRollOne').addEventListener('click', () => {
  show('[Grunt Kill]', mobLoot.roll());
});

document.getElementById('btnRollBoss').addEventListener('click', () => {
  show('[Boss Chest]', bossLoot.rollMultiple(4));
});

show('[Initial Test]', mobLoot.roll());