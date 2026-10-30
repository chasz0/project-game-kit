import { Inventory } from '@gameplay/inventory.js';

const out = document.getElementById('output');

const player = { hp: 50, maxHp: 100 };
const inv = new Inventory({ maxSlots: 5 });
let statusMsg = 'Inventory initialized (5 max slots).';

inv
  .defineItem('medkit', {
    name: 'Medkit',
    maxStack: 3,
    consumable: true,
    onUse: (p) => { p.hp = Math.min(p.maxHp, p.hp + 50); }
  })
  .defineItem('ammo', {
    name: 'Pulse Ammo',
    maxStack: 30,
    consumable: false
  });

const render = () => {
  let text = `Player HP: ${player.hp}/${player.maxHp} | Slots Used: ${inv.usedSlots}/${inv.maxSlots}\n\n`;
  for (let i = 0; i < inv.maxSlots; i++) {
    const s = inv.slots[i];
    text += `Slot ${i + 1}: ${s ? `${s.name} (${s.count}/${s.maxStack})` : '[ Empty ]'}\n`;
  }
  text += `\n> ${statusMsg}`;
  out.textContent = text;
};

document.getElementById('btnAddMed').addEventListener('click', () => {
  const res = inv.add('medkit', 2);
  statusMsg = `Added ${res.added} Medkit(s). Overflow: ${res.overflow}`;
  render();
});

document.getElementById('btnAddAmmo').addEventListener('click', () => {
  const res = inv.add('ammo', 15);
  statusMsg = `Added ${res.added} Ammo. Overflow: ${res.overflow}`;
  render();
});

document.getElementById('btnUseMed').addEventListener('click', () => {
  statusMsg = inv.use('medkit', player)
    ? 'Used 1 Medkit (+50 HP).'
    : 'No Medkits in inventory!';
  render();
});

document.getElementById('btnClearInv').addEventListener('click', () => {
  inv.clear();
  statusMsg = 'Cleared all slots.';
  render();
});

inv.add('medkit', 2);
inv.add('ammo', 20);
render();