const { calculateMetrics } = require('./server');
const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(__dirname, 'temp_code.jsx');




function analyzeFile(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const metrics = calculateMetrics(code);

        // Sort functions by complexity descending (actually by ID to preserve definition order for table?)
        // User output suggests definition order (line 1, then line 12).
        metrics.functions.sort((a, b) => a.id - b.id);

        const fnMap = new Map();
        const childrenMap = new Map();
        const roots = [];

        metrics.functions.forEach(f => {
            fnMap.set(f.id, f);
            childrenMap.set(f.id, []);
        });

        metrics.functions.forEach(f => {
            if (f.parentId !== null && fnMap.has(f.parentId)) {
                childrenMap.get(f.parentId).push(f);
            } else {
                roots.push(f);
            }
        });

        function computeTotalCC(fnId) {
            const f = fnMap.get(fnId);
            const children = childrenMap.get(fnId) || [];
            let childSum = 0;
            children.forEach(c => {
                childSum += computeTotalCC(c.id);
            });
            f.totalCC = f.CC + childSum;
            return f.totalCC;
        }

        roots.forEach(r => computeTotalCC(r.id));

        let outputString = '';
        const log = (msg) => {
            console.log(msg);
            outputString += msg + '\n';
        };

        log('Function Name                 | Start Line | End Line | CC       | NLOC');
        log('-----------------------------------------------------------------------');

        function printNode(fnId, indentLevel = 0) {
            const f = fnMap.get(fnId);
            const children = childrenMap.get(fnId) || [];

            // Format Name
            let nameDisplay = f.name;
            const indent = '     '.repeat(indentLevel);
            const nameCell = (indent + nameDisplay).padEnd(30, ' ');

            let ccDisplay = `${f.totalCC}`;
            if (children.length > 0) {
                ccDisplay += '(total)';
            }

            log(`${nameCell}| ${String(f.lineStart).padEnd(11)}| ${String(f.lineEnd).padEnd(9)}| ${ccDisplay.padEnd(9)}| ${f.NLOC}`);

            children.forEach(c => printNode(c.id, indentLevel + 1));
        }

        roots.forEach(r => printNode(r.id));

        // fs.writeFileSync(path.join(__dirname, 'analysis_output.txt'), outputString);
        // console.log('\nOutput saved to analysis_output.txt');
    }
    catch (error) {
        console.error("Error analyzing file:", error);
    }
}

analyzeFile(filePath);
