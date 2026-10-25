import { Vec2 } from '../core/vec2.js';

const out = document.getElementById('output');
const log = (msg) => out.textContent += msg + '\n';

const player = new Vec2(0, 0);
const enemy = new Vec2(3, 4);

log(`Player: (${player.x}, ${player.y})`);
log(`Enemy: (${enemy.x}, ${enemy.y})`);
log(`Distance: ${player.distance(enemy)}`);

player.add(new Vec2(1, 1));
log(`Player moved: (${player.x}, ${player.y})`);

enemy.normalize();
log(`Enemy direction (normalized): (${enemy.x.toFixed(2)}, ${enemy.y.toFixed(2)})`);