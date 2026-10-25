import { input } from '@core/input.js';

const out = document.getElementById('output');

input.bind('left', ['KeyA', 'ArrowLeft']);
input.bind('right', ['KeyD', 'ArrowRight']);
input.bind('shoot', ['Space', 'Mouse0']);

const loop = () => {
  let text = `Mouse: (${input.mouse.x}, ${input.mouse.y})\n\n`;
  
  text += `Moving Left: ${input.isDown('left')}\n`;
  text += `Moving Right: ${input.isDown('right')}\n`;
  
  if (input.isPressed('shoot')) {
    text += `\n> PEW PEW! (Shoot just pressed)`;
  } else if (input.isDown('shoot')) {
    text += `\n> Charging laser... (Shoot held)`;
  } else if (input.isReleased('shoot')) {
    text += `\n> Click! (Shoot just released)`;
  }

  out.textContent = text;
  
  // Must be called at the end of the frame to shift states
  input.update(); 
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);