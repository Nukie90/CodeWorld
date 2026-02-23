const express = require('express');
const cors = require('cors');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const AdmZip = require('adm-zip');

const app = express();

app.use(cors());
app.use(express.json());

function calculateMetrics(code) {
    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'classProperties', 'classPrivateProperties', 'objectRestSpread'],
            ranges: true,
            locations: true,
            allowReturnOutsideFunction: true,
            tokens: true
        });

        // Helper to count lines from tokens
        const countTokenLines = (tokens) => {
            const lines = new Set();
            tokens.forEach(t => {
                // Skip comments
                if (t.type === 'CommentLine' || t.type === 'CommentBlock') return;

                const start = t.loc.start.line;
                const end = t.loc.end.line;
                for (let i = start; i <= end; i++) lines.add(i);
            });
            return lines.size;
        };

        const validTokens = ast.tokens.filter(t => t.type !== 'CommentLine' && t.type !== 'CommentBlock' && t.type !== 'EOF');
        const N_total = validTokens.length;
        const uniqueTokens = new Set(validTokens.map(t => code.slice(t.start, t.end)));
        const n_unique = uniqueTokens.size;
        const halsteadVolume = n_unique > 0 ? (N_total * Math.log2(n_unique)) : 0;

        const metrics = {
            LOC: code.split('\n').length,
            NLOC: countTokenLines(ast.tokens),
            NOF: 0,
            halsteadVolume,
            functions: []
        };

        // --- 1. Analyze Global Scope (Virtual Function) ---
        // We use the entire Program node to calculate complexity of top-level code.
        // We must exclude function definitions from this calculation to avoid double counting,
        // which calculateCognitiveComplexity already does by skipping child functions.
        const { complexity: globalCC, maxNesting: globalMaxNesting } = calculateCognitiveComplexity({
            traverse: (visitor) => traverse(ast, visitor), // Adapter for traverse
            node: ast.program
        }, 0, '(global)');

        // Calculate Global NLOC: Total NLOC - Sum(Child Functions NLOC)
        // Or more accurately: Count tokens that are NOT inside any child function.
        // But for simplicity and speed, let's use the token subtraction method if possible,
        // or just count lines in the file that aren't covered by functions.
        // Actually, existing countTokenLines(ast.tokens) gives total NLOC.
        // We need to subtract NLOC of all discovered functions later, or compute it now.
        // Let's postpone Global NLOC finalization until after we find all functions.

        const globalFunction = {
            name: '(global)',
            NLOC: 0, // Will be updated
            CC: globalCC,
            CYC: typeof calculateCC === 'function' ? calculateCC(code) : 1,
            MI: 100.0,
            maxNesting: globalMaxNesting,
            lineStart: 1,
            lineEnd: code.split('\n').length,
            id: -1, // Special ID for global
            parentId: null
        };
        metrics.functions.push(globalFunction);

        traverse(ast, {
            enter(p) {
                // Only handle function-like nodes (covers FunctionDeclaration/Expression, Arrow, ObjectMethod, ClassMethod)
                if (!p.isFunction()) return;

                // Prefer the function node itself for start/end
                const fnNode = p.node;

                // Name resolution
                let functionName = fnNode.id?.name ?? 'anonymous';
                if (functionName === 'anonymous') {
                    const par = p.parentPath;
                    if (par?.isVariableDeclarator() && par.node.id.type === 'Identifier') {
                        functionName = par.node.id.name;                         // const foo = () => {}
                    } else if (par?.isObjectProperty() && par.node.key.type === 'Identifier') {
                        functionName = par.node.key.name;                        // const o = { foo() {} }
                    }
                    else if (p.isClassMethod() || p.isObjectMethod()) {
                        const key = fnNode.key;
                        if (key?.type === 'Identifier') functionName = key.name; // class X { foo() {} }
                    }
                }

                // Safe slice by character range (no manual line/column math!)
                const start = fnNode.start ?? 0;
                const end = fnNode.end ?? code.length;
                const functionCode = code.slice(start, end);

                const lineStart = fnNode.loc?.start?.line ?? null;
                const lineEnd = fnNode.loc?.end?.line ?? null;

                // Filter tokens belonging to this function
                const fnTokens = ast.tokens.filter(t => t.start >= start && t.end <= end);
                const validFnTokens = fnTokens.filter(t => t.type !== 'CommentLine' && t.type !== 'CommentBlock' && t.type !== 'EOF');
                const N_fn = validFnTokens.length;
                const uniqueFnTokens = new Set(validFnTokens.map(t => code.slice(t.start, t.end)));
                const n_unique_fn = uniqueFnTokens.size;
                const fnHalsteadVolume = n_unique_fn > 0 ? (N_fn * Math.log2(n_unique_fn)) : 0;

                metrics.NOF += 1;
                // Calculate base nesting from ancestors
                let baseNesting = 0;
                let curr = p.parentPath;
                while (curr) {
                    if (curr.isFunction() ||
                        curr.isIfStatement() ||
                        curr.isForStatement() || curr.isForInStatement() || curr.isForOfStatement() ||
                        curr.isWhileStatement() || curr.isDoWhileStatement() ||
                        curr.isSwitchStatement() ||
                        curr.isCatchClause()) {

                        // Handle Else If: if parent is If and we are alternate, don't increment IF parent is implicitly handling it?
                        // Actually, standard nesting rules: "else if" logic is local.
                        // Standard nesting increases for Function, If, Loop, Switch, Catch.
                        // For callbacks, we count the Function boundary as a nesting increment.
                        baseNesting++;
                    }
                    curr = curr.parentPath;
                }

                const { complexity, maxNesting } = calculateCognitiveComplexity(p, baseNesting, functionName);
                const cyclomaticComplexity = typeof calculateCC === 'function' ? calculateCC(functionCode) : 1;

                const fnLoc = (lineEnd !== null && lineStart !== null) ? (lineEnd - lineStart + 1) : 1;
                let mi = 100.0;
                if (fnLoc > 0) {
                    const logV = fnHalsteadVolume > 0 ? Math.log(fnHalsteadVolume) : 0;
                    const logLOC = Math.log(fnLoc);
                    const originalMI = 171 - 5.2 * logV - 0.23 * cyclomaticComplexity - 16.2 * logLOC;
                    mi = Math.max(0, Math.min(100, originalMI * 100 / 171));
                }

                // Determine Parent ID
                // If getFunctionParent returns null, it's a top-level function -> parent is null (sibling of global)
                const parentFn = p.getFunctionParent();
                const parentId = parentFn ? (parentFn.node.start ?? null) : null;

                metrics.functions.push({
                    name: functionName,
                    NLOC: countTokenLines(fnTokens),
                    CC: complexity,
                    CYC: cyclomaticComplexity,
                    MI: parseFloat(mi.toFixed(2)),
                    maxNesting,
                    lineStart,
                    lineEnd,
                    id: start,
                    parentId: parentId
                });
            }
        });

        // Finalize Global NLOC
        // Global NLOC = Total NLOC - Sum(Top-Level Functions NLOC).
        // Top-level functions are those with parentId === null.

        const topLevelFunctionsNLOC = metrics.functions
            .filter(f => f.parentId === null && f.id !== -1) // Exclude self (though global has id -1, just to be safe)
            .reduce((sum, f) => sum + f.NLOC, 0);

        globalFunction.NLOC = Math.max(0, metrics.NLOC - topLevelFunctionsNLOC);


        return metrics;
    } catch (error) {
        console.error('Error parsing code:', error);
        throw error;
    }
}

function calculateCC(functionCode) {
    let complexity = 1;
    let ast;

    try {
        let src = String(functionCode).trim();
        try {
            // First, attempt to parse the string normally as a module
            ast = parser.parse(src, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript', 'classProperties', 'objectRestSpread'],
                allowReturnOutsideFunction: true
            });
        } catch (parseError) {
            // If it fails, maybe it's just an isolated function expression that needs wrapping
            if (/^(async\s+)?function\b/.test(src)) {
                src = `(${src})`;
            }
            // Class/Object method shorthand like "foo() { ... }" → wrap into object
            else if (/^\w+\s*\([^)]*\)\s*\{/.test(src)) {
                src = `({ ${src} })`;
            }

            // Arrow functions are already expressions; leave them as-is
            // Now parse in expression position (no extra block!)
            ast = parser.parse(`${src};`, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript', 'classProperties', 'objectRestSpread'],
                allowReturnOutsideFunction: true
            });
        }

        traverse(ast, {
            enter(path) {
                switch (path.type) {
                    case 'IfStatement':
                    case 'ConditionalExpression':
                    case 'ForStatement':
                    case 'ForInStatement':
                    case 'ForOfStatement':
                    case 'WhileStatement':
                    case 'DoWhileStatement':
                    case 'CatchClause':
                        complexity++;
                        break;
                    case 'LogicalExpression':
                        if (path.node.operator === '&&' || path.node.operator === '||') complexity++;
                        break;
                    case 'SwitchCase':
                        if (path.node.test) complexity++;
                        break;
                }
            }
        });

        return complexity;
    } catch (error) {
        console.error('Error calculating cyclomatic complexity:', error);
        console.error('Function code causing error:', functionCode);
        return 1;
    }
}

function calculateCognitiveComplexity(funcPath, baseNesting = 0, functionName = null) {
    let complexity = 0;
    let nesting = baseNesting;
    let maxNesting = 0; // Track max depth encountered relative to this function

    // Helper to update max nesting
    function checkNesting() {
        // current absolute nesting - baseNesting = depth inside this function
        // Or is max_nesting_depth absolute? Usually relative to function start.
        // Let's assume relative depth (depth of control structures within function).
        // So if we are at `nesting`, relative depth is `nesting - baseNesting`.
        const depth = nesting - baseNesting;
        if (depth > maxNesting) maxNesting = depth;
    }

    // Increment for structural elements (if, looping, catch)
    function addStructural() {
        complexity += 1 + nesting;
    }

    // Increment for fundamental elements (else, default, binary sequences)
    function addFundamental() {
        complexity += 1;
    }

    funcPath.traverse({
        enter(path) {
            // Stop traversal if we hit a nested function (CC is per-function)
            if (path.isFunction() && path !== funcPath) {
                path.skip();
                return;
            }

            // --- Recursion ---
            if (path.isCallExpression() && functionName) {
                const callee = path.node.callee;
                if (callee.type === 'Identifier' && callee.name === functionName) {
                    addFundamental();
                }
            }

            // --- Break/Continue with Label ---
            if ((path.isBreakStatement() || path.isContinueStatement()) && path.node.label) {
                addFundamental();
            }

            // --- Control Flow ---
            if (path.isIfStatement()) {
                const isElseIf = path.key === 'alternate' && path.parentPath.isIfStatement();

                if (isElseIf) {
                    complexity += 1 + (nesting - 1);
                } else {
                    addStructural();
                    nesting++;
                    checkNesting();
                }

                if (path.node.alternate && path.node.alternate.type !== 'IfStatement') {
                    addFundamental();
                }
            }
            else if (path.isSwitchStatement()) {
                nesting++;
                checkNesting();
            }
            else if (path.isSwitchCase()) {
                addFundamental();
            }
            else if (path.isForStatement() || path.isForInStatement() || path.isForOfStatement() ||
                path.isWhileStatement() || path.isDoWhileStatement()) {
                addStructural();
                nesting++;
                checkNesting();
            }
            else if (path.isCatchClause()) {
                addStructural();
                nesting++;
                checkNesting();
            }
            // --- Logical Operators ---
            else if (path.isLogicalExpression()) {
                const op = path.node.operator;
                if (op === '&&' || op === '||' || op === '??') {
                    if (!path.parentPath.isLogicalExpression() || path.parentPath.node.operator !== op) {
                        addFundamental();
                    }
                }
            }
            else if (path.isConditionalExpression()) {
                addStructural();
                nesting++;
                checkNesting();
            }
        },
        exit(path) {
            if (path.isIfStatement()) {
                const isElseIf = path.key === 'alternate' && path.parentPath.isIfStatement();
                if (!isElseIf) {
                    nesting--;
                }
            }
            else if (path.isSwitchStatement() ||
                path.isForStatement() || path.isForInStatement() || path.isForOfStatement() ||
                path.isWhileStatement() || path.isDoWhileStatement() ||
                path.isCatchClause() ||
                path.isConditionalExpression()) {
                nesting--;
            }
        }
    });

    return { complexity, maxNesting };
}

function analyzeFile(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        return {
            fileName: path.basename(filePath),
            metrics: calculateMetrics(code)
        };
    } catch (error) {
        return {
            fileName: path.basename(filePath),
            error: error.message
        };
    }
}

function cleanupDirectory(directory) {
    if (fs.existsSync(directory)) {
        fs.readdirSync(directory).forEach((file) => {
            const curPath = path.join(directory, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                cleanupDirectory(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(directory);
    }
}

// --- add these helpers near the top (after other functions) ---
function topLevelName(entryName) {
    // normalize and take the first component before '/'
    const clean = entryName.replace(/^\.\/+/, '');
    const parts = clean.split('/');
    return parts[0] || '';
}

function detectZipRootFolder(zip) {
    // Collect top-level names for all non-empty entries
    const counts = new Map();
    let hasTopLevelFiles = false;

    for (const e of zip.getEntries()) {
        // skip directory-only entries with empty name or __MACOSX noise
        if (!e.entryName || e.isDirectory) continue;
        const top = topLevelName(e.entryName);
        if (!top || top === '__MACOSX') continue;

        // If a file appears directly at top level (no slash), mark it
        if (!e.entryName.includes('/')) hasTopLevelFiles = true;

        counts.set(top, (counts.get(top) || 0) + 1);
    }

    // If there are files at top-level, there's no single root folder
    if (hasTopLevelFiles) return null;

    // If exactly one top-level folder dominates, use it
    if (counts.size === 1) {
        for (const name of counts.keys()) return name; // the only key
    }

    // Otherwise, ambiguous/mixed layout
    return null;
}

function isCodeFile(file) {
    return file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx');
}

function analyzeFileAt(filePath, rootPathForRel) {
    // like your analyzeFile, but preserves path relative to detected root
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const rel = rootPathForRel ? path.relative(rootPathForRel, filePath) : path.basename(filePath);
        return {
            fileName: rel.replaceAll(path.sep, '/'),
            metrics: calculateMetrics(code)
        };
    } catch (error) {
        const rel = rootPathForRel ? path.relative(rootPathForRel, filePath) : path.basename(filePath);
        return {
            fileName: rel.replaceAll(path.sep, '/'),
            error: error.message
        };
    }
}

app.post('/analyze-zip', (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        console.log('Received file:', req.file.originalname);
        const zip = new AdmZip(req.file.buffer);
        const extractPath = path.join(os.tmpdir(), 'extracted_' + Date.now());

        // Create extraction directory
        if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath);

        // Detect root folder from entries BEFORE extract
        const detectedRoot = detectZipRootFolder(zip);

        // Extract the zip file
        zip.extractAllTo(extractPath, true);

        // Decide actual root path to traverse
        const rootPath = detectedRoot
            ? path.join(extractPath, detectedRoot)
            : extractPath;

        // Traverse from the chosen root
        const results = [];

        (function processDirectory(directory) {
            fs.readdirSync(directory).forEach(file => {
                const fullPath = path.join(directory, file);
                const stat = fs.statSync(fullPath);

                // ✅ Skip node_modules and other heavy/irrelevant folders
                if (stat.isDirectory()) {
                    if (file === 'node_modules' || file.startsWith('.git') || file === 'dist' || file === 'build') {
                        console.log(`Skipping ignored folder: ${fullPath}`);
                        return;
                    }
                    processDirectory(fullPath);
                } else if (isCodeFile(file)) {
                    results.push(analyzeFileAt(fullPath, rootPath));
                }
            });
        })(rootPath);


        // Clean up extracted contents
        // req.file is in memory, so no path to unlink
        cleanupDirectory(extractPath);

        res.json({
            rootFolder: detectedRoot || null,
            totalFiles: results.length,
            results
        });
    } catch (error) {
        // Clean up on error
        // req.file is in memory

        res.status(500).json({ error: error.message });
    }
});

// Keep the original single file endpoint
app.post('/analyze', (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Calculate without saving to disk first
        const metrics = calculateMetrics(req.file.buffer.toString('utf8'));
        const result = {
            fileName: req.file.originalname,
            metrics: metrics
        };

        res.json(result.metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/analyze-code', express.json(), (req, res) => {
    const { code, filename } = req.body;

    if (!code || !filename) {
        return res.status(400).json({ error: 'Request must include "code" and "filename"' });
    }

    try {
        const babelMetrics = calculateMetrics(code);

        // Sort by ID to preserve order
        babelMetrics.functions.sort((a, b) => a.id - b.id);

        const fnMap = new Map();
        const childrenMap = new Map();
        const roots = [];

        // Initialize maps
        babelMetrics.functions.forEach(f => {
            f.children = []; // Prepare for nesting
            fnMap.set(f.id, f);
            childrenMap.set(f.id, []);
        });

        // Build hierarchy
        babelMetrics.functions.forEach(f => {
            if (f.parentId !== null && fnMap.has(f.parentId)) {
                childrenMap.get(f.parentId).push(f);
            } else {
                roots.push(f);
            }
        });

        // Compute Total CC recursively and build nested structure
        function processNode(fnId) {
            const f = fnMap.get(fnId);
            const children = childrenMap.get(fnId);
            let childSum = 0;
            let childCycSum = 0;

            children.forEach(c => {
                const sums = processNode(c.id);
                childSum += sums.cc;
                childCycSum += sums.cyc;
                f.children.push(c); // Add child object to parent
            });

            f.totalCC = f.CC + childSum;
            f.totalCYC = f.CYC + childCycSum;

            return { cc: f.totalCC, cyc: f.totalCYC };
        }

        roots.forEach(r => processNode(r.id));

        // Helper to format the tree for response recursively
        function formatFunction(f, parentLongName = '') {
            const currentLongName = parentLongName ? `${parentLongName}.${f.name}` : f.name;

            const children = f.children.map(c => formatFunction(c, currentLongName));

            return {
                cognitive_complexity: f.CC,
                total_cognitive_complexity: f.totalCC, // Add total CC
                cyclomatic_complexity: f.CYC,
                maintainability_index: f.MI ?? 100.0,
                nloc: f.NLOC,
                token_count: 0,
                name: f.name,
                long_name: currentLongName,
                start_line: f.lineStart,
                end_line: f.lineEnd, // Available now
                max_nesting_depth: f.maxNesting || 0,
                children: children
            };
        }

        const hierarchicalFunctions = roots.map(r => formatFunction(r, ''));

        // Recalculate global stats if needed, or just return top-level stats
        let complexity_sum = 0;
        let complexity_max = 0;

        // For stats, we might want to iterate ALL functions to get max/sum, not just roots?
        // Usually sum is sum of ALL functions' CC. 
        babelMetrics.functions.forEach(f => {
            complexity_sum += f.CYC; // maintainability index expects cyclomatic
            if (f.CYC > complexity_max) complexity_max = f.CYC;
        });

        const function_count = babelMetrics.functions.length;
        const complexity_avg = function_count > 0 ? parseFloat((complexity_sum / function_count).toFixed(2)) : 0.0;

        let maintainability_index = 100.0;
        if (babelMetrics.LOC > 0) {
            const logV = babelMetrics.halsteadVolume > 0 ? Math.log(babelMetrics.halsteadVolume) : 0;
            const logLOC = Math.log(babelMetrics.LOC);
            const originalMI = 171 - 5.2 * logV - 0.23 * complexity_sum - 16.2 * logLOC;
            maintainability_index = Math.max(0, Math.min(100, originalMI * 100 / 171));
        }

        const responseMetrics = {
            filename: filename,
            language: 'javascript',
            total_loc: babelMetrics.LOC,
            total_nloc: babelMetrics.NLOC,
            function_count: function_count,
            total_complexity: complexity_sum,
            complexity_max: complexity_max,
            maintainability_index: parseFloat(maintainability_index.toFixed(2)),
            functions: hierarchicalFunctions, // Returns roots with nested children
        };

        res.json(responseMetrics);
    } catch (error) {
        console.error(`Error analyzing code for ${filename}:`, error);
        res.status(500).json({ error: `Failed to analyze code: ${error.message}` });
    }
});


if (require.main === module) {
    const PORT = process.env.PORT || 3001;

    app.listen(PORT)
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${PORT} is busy, trying port ${PORT + 1}`);
                app.listen(PORT + 1)
                    .on('listening', () => {
                        console.log(`Server running on port ${PORT + 1}`);
                    });
            } else {
                console.error('Error starting server:', err);
            }
        })
        .on('listening', () => {
            console.log(`Server running on port ${PORT}`);
        });
}

module.exports = { calculateMetrics };