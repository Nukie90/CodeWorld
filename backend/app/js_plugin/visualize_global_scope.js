const { calculateMetrics } = require('./server');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'temp_code.jsx');

try {
    const code = fs.readFileSync(filePath, 'utf8');
    const metrics = calculateMetrics(code);
    const lines = code.split('\n');

    console.log(`Analyzing: ${filePath}`);
    console.log('Visualizing (global) scope content by masking top-level functions...\n');

    // Get top-level functions (excluding global itself)
    const topLevelFns = metrics.functions
        .filter(f => f.parentId === null && f.id !== -1)
        .sort((a, b) => a.lineStart - b.lineStart);

    let currentLine = 1;
    let globalLocCount = 0;

    for (const fn of topLevelFns) {
        // Print global code before this function
        while (currentLine < fn.lineStart) {
            console.log(`${currentLine.toString().padEnd(4)}: ${lines[currentLine - 1]}`);
            globalLocCount++;
            currentLine++;
        }

        // Print placeholder for the function
        console.log(`${currentLine.toString().padEnd(4)}: [Function: ${fn.name} (Lines ${fn.lineStart}-${fn.lineEnd})]`);

        // Skip over function body
        currentLine = fn.lineEnd + 1;
    }

    // Print remaining global code after last function
    while (currentLine <= lines.length) {
        console.log(`${currentLine.toString().padEnd(4)}: ${lines[currentLine - 1]}`);
        globalLocCount++;
        currentLine++;
    }

    console.log('\n' + '='.repeat(40));
    console.log(`Total File Lines: ${lines.length}`);
    console.log(`Global Scope Lines (LOC): ${globalLocCount}`);

    // Check if NLOC is available for global function
    const globalFn = metrics.functions.find(f => f.id === -1);
    if (globalFn) {
        console.log(`Global Scope Logical Lines (NLOC): ${globalFn.NLOC}`);
    }
    console.log('='.repeat(40));

} catch (err) {
    console.error(err);
}
