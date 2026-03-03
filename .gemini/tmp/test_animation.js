const fs = require('fs');
const content = fs.readFileSync('/Users/roshan/Desktop/Uni/CodeWorld/frontend/src/components/results/visualizations/Island3DVisualization.jsx', 'utf8');

// Simple verification steps:
const checks = [
   content.includes("group.visible = false;"), 
   content.includes("group.position.set(islandCenterX, 800, islandCenterZ);"),
   content.includes("droneGroup.position.set(avgX, 800, avgZ);"),
   content.includes("if (d.group.visible) {")
];

console.log(checks);
