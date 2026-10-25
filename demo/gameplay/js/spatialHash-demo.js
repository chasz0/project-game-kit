import { SpatialHash } from '@gameplay/spatialHash.js';

const out = document.getElementById('output');
const btn = document.getElementById('queryBtn');

// Create a grid with 100x100 pixel cells
const grid = new SpatialHash(100);
const totalEntities = 10000;

// Populate the world
for (let i = 0; i < totalEntities; i++) {
  grid.insert({
    id: i,
    x: Math.random() * 2000, 
    y: Math.random() * 2000,
    w: 10,
    h: 10
  });
}

out.textContent = `World Populated.\n`;
out.textContent += `Total Entities in memory: ${totalEntities}\n`;
out.textContent += `World Size: 2000x2000\n\n`;
out.textContent += `Ready to query.\n`;

btn.addEventListener('click', () => {
  const start = performance.now();
  
  // Query a small 150x150 area in the middle of the world
  const results = grid.query(1000, 1000, 150, 150);
  
  const end = performance.now();
  
  out.textContent += `\nQueried 150x150 area at (1000, 1000)...\n`;
  out.textContent += `Found ${results.length} entities nearby.\n`;
  out.textContent += `Query took ${(end - start).toFixed(2)} ms.\n`;
});