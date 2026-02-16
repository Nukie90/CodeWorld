const { calculateMetrics } = require('./server');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'temp_code.jsx');

console.log(`Analyzing file: ${filePath}`);

try {
    const code = fs.readFileSync(filePath, 'utf8');
    const metrics = calculateMetrics(code);
    const lines = code.split('\n');

    console.log(`Total Lines in File: ${lines.length}`);
    console.log(`Number of Functions Found: ${metrics.functions.length}`);

    // Sort functions by start line just in case
    metrics.functions.sort((a, b) => {
        if (a.lineStart === b.lineStart) return a.id - b.id;
        return a.lineStart - b.lineStart;
    });

    metrics.functions.forEach(fn => {
        console.log('\n' + '='.repeat(60));
        console.log(`Function Name: "${fn.name}"`);
        console.log(`ID: ${fn.id}`);
        console.log(`Scope: Lines ${fn.lineStart} to ${fn.lineEnd}`);
        console.log(`NLOC: ${fn.NLOC}`);
        console.log(`Cognitive Complexity: ${fn.CC}`);
        console.log('-'.repeat(60));

        // Extract code lines (1-based line numbers to 0-based array index)
        const startIdx = Math.max(0, fn.lineStart - 1);
        const endIdx = Math.min(lines.length, fn.lineEnd);

        const fnCodeLines = lines.slice(startIdx, endIdx);

        // Use a preview if it's too long, but user asked to "see the code", so I'll prioritize showing it or a significant chunk.
        // For (global), it might be huge.

        if (fn.name === '(global)') {
            console.log(`[Displaying first 20 lines and last 5 lines of (global) content due to size]`);
            console.log(fnCodeLines.slice(0, 20).join('\n'));
            console.log('... [snip] ...');
            console.log(fnCodeLines.slice(-5).join('\n'));
        } else {
            console.log(fnCodeLines.join('\n'));
        }

        console.log('='.repeat(60));
    });

} catch (err) {
    console.error('Error analyzing file:', err);
}
