import { collision } from '@gameplay/collision.js';

const out = document.getElementById('output');
const btn = document.getElementById('moveBtn');

const boxA = { x: 0, y: 0, w: 20, h: 20 };
const boxB = { x: 10, y: 10, w: 20, h: 20 };

const circleA = { x: 50, y: 50, r: 10 };
const circleB = { x: 65, y: 50, r: 10 };

const render = () => {
  let text = `--- Box vs Box ---\n`;
  text += `Box A: (${boxA.x}, ${boxA.y})\n`;
  text += `Box B: (${boxB.x}, ${boxB.y})\n`;
  text += `Overlapping: ${collision.boxBox(boxA, boxB)}\n\n`;

  text += `--- Circle vs Circle ---\n`;
  text += `Circle A: (${circleA.x}, ${circleA.y})\n`;
  text += `Circle B: (${circleB.x}, ${circleB.y})\n`;
  text += `Overlapping: ${collision.circleCircle(circleA, circleB)}\n\n`;
  
  text += `--- Circle vs Box ---\n`;
  text += `Circle A & Box B Overlapping: ${collision.circleBox(circleA, boxB)}\n`;

  out.textContent = text;
};

btn.addEventListener('click', () => {
  boxB.x += 5;
  circleB.x += 2;
  render();
});

render();