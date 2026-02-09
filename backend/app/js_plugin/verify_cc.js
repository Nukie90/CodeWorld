const { calculateMetrics } = require('./server');
const fs = require('fs');

// Read code from a separate file to avoid string escaping issues
try {
    const codeToCheck = fs.readFileSync('./temp_code.js', 'utf8');

    const metrics = calculateMetrics(codeToCheck);

    console.log("--- Cognitive Complexity Analysis ---");
    console.log("Function Name".padEnd(30) + "| Start Line | End Line | CC");
    console.log("-".repeat(60));

    metrics.functions.forEach(f => {
        console.log(`${f.name.padEnd(30)} | ${String(f.lineStart).padEnd(10)} | ${String(f.lineEnd).padEnd(8)} | ${f.CC}`);
    });
} catch (error) {
    console.log("Error verifying CC:", error.message);
}
