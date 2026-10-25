import { Random } from '@core/random.js';

const out = document.getElementById('output');
const btn = document.getElementById('genBtn');
const input = document.getElementById('seedInput');

const lootTable = ['Sword', 'Shield', 'Potion', 'Gold', 'Trash'];

const log = (msg) => out.textContent += msg + '\n';

btn.addEventListener('click', () => {
  out.textContent = ''; 
  const currentSeed = input.value;
  
  const rng1 = new Random(currentSeed);
  const rng2 = new Random(currentSeed);

  log(`Seed: "${currentSeed}"\n`);

  log('--- RNG 1 ---');
  log(`Float: ${rng1.next().toFixed(4)}`);
  log(`Damage: ${rng1.int(10, 20)}`);
  log(`Loot: ${rng1.choice(lootTable)}\n`);

  log('--- RNG 2 (Same Seed) ---');
  log(`Float: ${rng2.next().toFixed(4)}`);
  log(`Damage: ${rng2.int(10, 20)}`);
  log(`Loot: ${rng2.choice(lootTable)}\n`);

  log('Notice how RNG 1 and RNG 2 produce the exact same sequence.');
});