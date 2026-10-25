import { Vec2 } from '@core/vec2.js';

const out = document.getElementById('output');
const log = (msg) => out.textContent += msg + '\n';

const player = new Vec2(0, 0);
const enemy = new Vec2(3, 4);

log(`Player: (${player.x}, ${player.y})`);
log(`Enemy: (${enemy.x}, ${enemy.y})`);
log(`Distance: ${player.distance(enemy)} (Squared: ${player.distanceSq(enemy)})`);

const toEnemy = Vec2.sub(enemy, player).normalize();
log(`Direction to enemy (non-mutating): (${toEnemy.x.toFixed(2)}, ${toEnemy.y.toFixed(2)})`);
log(`Enemy unchanged: (${enemy.x}, ${enemy.y})`);