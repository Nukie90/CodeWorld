const express = require('express');
const cors = require('cors');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const AdmZip = require('adm-zip');
const { ESLint } = require("eslint");

const app = express();

const eslint = new ESLint();

async function getLintResults(code, filename) {
    let lint_score = null;
    let lint_errors = [];
    const safeFilename = filename;

    try {
        const results = await eslint.lintText(code, { filePath: safeFilename });

        if (results && results.length > 0) {
            const result = results[0];
            const messages = result.messages || [];

            lint_errors = messages.map(msg => ({
                type: msg.severity === 2 ? "error" : "warning",
                module: path.parse(safeFilename).name || "",
                obj: "",
                line: msg.line || 0,
                column: msg.column || 0,
                endLine: msg.endLine ?? null,
                endColumn: msg.endColumn ?? null,
                path: safeFilename,
                symbol: msg.ruleId || "",
                message: msg.message || "",
                message_id: msg.ruleId || ""
            }));

            // Simple score formula similar in spirit to pylint
            const errorCount = result.errorCount || 0;
            const warningCount = result.warningCount || 0;

            // start from 10
            // error = -1
            // warning = -0.5
            const rawScore = 10 - (errorCount * 1.0) - (warningCount * 0.5);
            lint_score = Math.max(0, Number(rawScore.toFixed(2)));
        }
    } catch (e) {
        console.error(`Error running eslint on ${safeFilename}:`, e.message);
    }

    return { lint_score, lint_errors };
}

app.use(cors());
app.use(express.json());

function calculateMaintainabilityIndex(halsteadVolume, cyclomaticComplexity, loc) {
    if (loc <= 0) return 100.0;

    const logV = halsteadVolume > 0 ? Math.log(halsteadVolume) : 0;
    const logLOC = Math.log(loc);
    const originalMI = 171 - 5.2 * logV - 0.23 * cyclomaticComplexity - 16.2 * logLOC;

    return Math.max(0, Math.min(100, originalMI * 100 / 171));
}

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

        const countLLOC = (startNode, skipNested = false) => {
            let count = 0;
            const visitor = {
                enter(path) {
                    if (path.isStatement() || path.isDeclaration()) {
                        if (skipNested && path.isFunction() && path.node !== startNode) {
                            path.skip();
                            return;
                        }
                        count++;
                    }
                }
            };
            if (startNode === ast.program) {
                traverse(ast, visitor);
            } else {
                traverse(ast, visitor, path ? path.scope : undefined, path ? path.state : undefined, path ? path.parentPath : undefined);
                // but simpler is to use path.traverse if we have a path.
                // Since we are inside calculateMetrics, we might not have paths for everything.
            }
            return count;
        };

        // Simpler countLLOC using node directly if we don't have paths yet:
        const countLLOCFromNode = (node, skipNested = false) => {
            let count = 0;
            traverse(ast, {
                enter(path) {
                    // Check if current path is a descendant of node
                    let isDescendant = false;
                    let curr = path;
                    while (curr) {
                        if (curr.node === node) {
                            isDescendant = true;
                            break;
                        }
                        curr = curr.parentPath;
                    }
                    if (!isDescendant) return;

                    if (path.isStatement() || path.isDeclaration()) {
                        if (skipNested && path.isFunction() && path.node !== node) {
                            path.skip();
                            return;
                        }
                        // Only increment count for non-container declarations/statements
                        if (!path.isFunctionDeclaration() && !path.isClassDeclaration() && !path.isBlockStatement()) {
                            count++;
                        }
                    }
                }
            });
            return count;
        };

        const validTokens = ast.tokens.filter(t => t.type !== 'CommentLine' && t.type !== 'CommentBlock' && t.type !== 'EOF');
        const N_total = validTokens.length;
        const uniqueTokens = new Set(validTokens.map(t => code.slice(t.start, t.end)));
        const n_unique = uniqueTokens.size;
        const halsteadVolume = n_unique > 0 ? (N_total * Math.log2(n_unique)) : 0;

        const metrics = {
            LOC: code.split('\n').length,
            LLOC: countLLOCFromNode(ast.program),
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
        }, 0, 'code outside functions');

        const functionRanges = [];
        traverse(ast, {
            enter(path) {
                if (!path.isFunction()) return;

                const start = path.node.start;
                const end = path.node.end;
                if (start === undefined || end === undefined) return;

                functionRanges.push({ start, end });
            }
        });

        const globalTokens = validTokens.filter(t =>
            !functionRanges.some(range => t.start >= range.start && t.end <= range.end)
        );
        const globalUniqueTokens = new Set(globalTokens.map(t => code.slice(t.start, t.end)));
        const globalHalsteadVolume = globalUniqueTokens.size > 0
            ? globalTokens.length * Math.log2(globalUniqueTokens.size)
            : 0;
        const globalLLOC = countLLOCFromNode(ast.program, true);

        let fileCYC = 1;
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
                        fileCYC++;
                        break;
                    case 'LogicalExpression':
                        if (path.node.operator === '&&' || path.node.operator === '||') fileCYC++;
                        break;
                    case 'SwitchCase':
                        if (path.node.test) fileCYC++;
                        break;
                }
            }
        });

        // Calculate global scope (outside functions) Cyclomatic Complexity
        let globalCYC = 1;
        traverse(ast, {
            enter(path) {
                if (path.isFunction()) {
                    path.skip();
                    return;
                }
                switch (path.type) {
                    case 'IfStatement':
                    case 'ConditionalExpression':
                    case 'ForStatement':
                    case 'ForInStatement':
                    case 'ForOfStatement':
                    case 'WhileStatement':
                    case 'DoWhileStatement':
                    case 'CatchClause':
                        globalCYC++;
                        break;
                    case 'LogicalExpression':
                        if (path.node.operator === '&&' || path.node.operator === '||') globalCYC++;
                        break;
                    case 'SwitchCase':
                        if (path.node.test) globalCYC++;
                        break;
                }
            }
        });
        const loc = code.split('\n').length;
        const globalMI = calculateMaintainabilityIndex(globalHalsteadVolume, globalCYC, globalLLOC);

        const globalFunction = {
            name: 'code outside functions',
            LLOC: globalLLOC,
            CC: globalCC,
            CYC: globalCYC,
            MI: parseFloat(globalMI.toFixed(2)),
            halsteadVolume: globalHalsteadVolume,
            maxNesting: globalMaxNesting,
            lineStart: 1,
            lineEnd: loc,
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

                // Calculate local cyclomatic complexity (skip inner functions)
                let cyclomaticComplexity = 1;
                p.traverse({
                    enter(innerPath) {
                        if (innerPath.isFunction() && innerPath !== p) {
                            innerPath.skip();
                            return;
                        }
                        switch (innerPath.type) {
                            case 'IfStatement':
                            case 'ConditionalExpression':
                            case 'ForStatement':
                            case 'ForInStatement':
                            case 'ForOfStatement':
                            case 'WhileStatement':
                            case 'DoWhileStatement':
                            case 'CatchClause':
                                cyclomaticComplexity++;
                                break;
                            case 'LogicalExpression':
                                if (innerPath.node.operator === '&&' || innerPath.node.operator === '||') cyclomaticComplexity++;
                                break;
                            case 'SwitchCase':
                                if (innerPath.node.test) cyclomaticComplexity++;
                                break;
                        }
                    }
                });

                const fnLoc = (lineEnd !== null && lineStart !== null) ? (lineEnd - lineStart + 1) : 1;
                const mi = calculateMaintainabilityIndex(fnHalsteadVolume, cyclomaticComplexity, fnLoc);

                // Determine Parent ID
                // If getFunctionParent returns null, it's a top-level function -> parent is null (sibling of global)
                const parentFn = p.getFunctionParent();
                const parentId = parentFn ? (parentFn.node.start ?? null) : null;

                metrics.functions.push({
                    name: functionName,
                    LLOC: countLLOCFromNode(fnNode, true),
                    CC: complexity,
                    CYC: cyclomaticComplexity,
                    MI: parseFloat(mi.toFixed(2)),
                    halsteadVolume: fnHalsteadVolume,
                    maxNesting,
                    lineStart,
                    lineEnd,
                    id: start,
                    parentId: parentId
                });
            }
        });

        metrics.fileCYC = fileCYC;

        return metrics;
    } catch (error) {
        console.error('Error parsing code:', error);
        throw error;
    }
}

async function buildFileMetricsResponse(code, filename) {
    const babelMetrics = calculateMetrics(code);
    babelMetrics.functions.sort((a, b) => a.id - b.id);

    const fnMap = new Map();
    const childrenMap = new Map();
    const roots = [];

    babelMetrics.functions.forEach(f => {
        f.children = [];
        fnMap.set(f.id, f);
        childrenMap.set(f.id, []);
    });

    babelMetrics.functions.forEach(f => {
        if (f.parentId !== null && fnMap.has(f.parentId)) {
            childrenMap.get(f.parentId).push(f);
        } else {
            roots.push(f);
        }
    });

    function processNode(fnId) {
        const f = fnMap.get(fnId);
        const children = childrenMap.get(fnId);

        let childCogSum = 0;
        let childCycSum = 0;

        children.forEach(c => {
            const sums = processNode(c.id);
            childCogSum += sums.cc;
            childCycSum += sums.cyc;
            f.children.push(c);
        });

        f.totalCC = (f.CC || 0) + childCogSum;
        f.totalCYC = (f.CYC || 0) + childCycSum;

        return { cc: f.totalCC, cyc: f.totalCYC };
    }

    roots.forEach(r => processNode(r.id));

    function formatFunction(f, parentLongName = '') {
        const currentLongName = parentLongName ? `${parentLongName}.${f.name}` : f.name;

        return {
            name: f.name,
            long_name: currentLongName,
            start_line: f.lineStart ?? null,
            end_line: f.lineEnd ?? null,
            lloc: f.LLOC ?? 0,
            cognitive_complexity: f.CC ?? 0,
            cyclomatic_complexity: f.CYC ?? 0,
            total_cognitive_complexity: f.totalCC ?? (f.CC ?? 0),
            maintainability_index: f.MI ?? 100.0,
            max_nesting_depth: f.maxNesting ?? 0,
            halstead_volume: f.halsteadVolume ?? 0.0,
            id: f.id ?? null,
            parentId: f.parentId ?? null,
            children: f.children.map(c => formatFunction(c, currentLongName))
        };
    }

    const hierarchicalFunctions = roots.map(r => formatFunction(r, ''));

    let complexity_sum = 0;
    let complexity_max = 0;

    babelMetrics.functions.forEach(f => {
        const cyc = f.CYC ?? 0;
        complexity_sum += cyc;
        if (cyc > complexity_max) complexity_max = cyc;
    });

    const fileCyc = babelMetrics.fileCYC !== undefined ? babelMetrics.fileCYC : complexity_sum;
    const maintainability_index = calculateMaintainabilityIndex(
        babelMetrics.halsteadVolume ?? 0,
        fileCyc,
        babelMetrics.LOC ?? 0
    );

    const total_cognitive_complexity =
        roots.reduce((sum, r) => sum + (r.totalCC || 0), 0);

    const { lint_score, lint_errors } = await getLintResults(code, filename);

    return {
        filename,
        language: /\.(ts|tsx)$/i.test(filename) ? "typescript" : "javascript",
        total_loc: babelMetrics.LOC ?? 0,
        total_lloc: babelMetrics.LLOC ?? 0,
        function_count: babelMetrics.functions.length,
        total_complexity: babelMetrics.fileCYC !== undefined ? babelMetrics.fileCYC : complexity_sum,
        complexity_max,
        total_cognitive_complexity,
        halstead_volume: babelMetrics.halsteadVolume ?? 0.0,
        maintainability_index: parseFloat(maintainability_index.toFixed(2)),
        is_unsupported: false,
        lint_score,
        lint_errors,
        functions: hierarchicalFunctions
    };
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

async function analyzeFileAt(filePath, rootPathForRel) {
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const rel = rootPathForRel ? path.relative(rootPathForRel, filePath) : path.basename(filePath);
        const fileName = rel.replaceAll(path.sep, '/');

        return await buildFileMetricsResponse(code, fileName);
    } catch (error) {
        const rel = rootPathForRel ? path.relative(rootPathForRel, filePath) : path.basename(filePath);
        const fileName = rel.replaceAll(path.sep, '/');

        return {
            filename: fileName,
            language: /\.(ts|tsx)$/i.test(fileName) ? "typescript" : "javascript",
            total_loc: 0,
            total_nloc: 0,
            function_count: 0,
            total_complexity: 0,
            complexity_max: 0,
            total_cognitive_complexity: 0,
            halstead_volume: 0.0,
            maintainability_index: 0.0,
            is_unsupported: false,
            lint_score: null,
            lint_errors: [],
            functions: [],
            error: error.message
        };
    }
}

app.post('/analyze-zip', async (req, res) => {
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

        async function processDirectory(directory) {
            const files = fs.readdirSync(directory);
            for (const file of files) {
                const fullPath = path.join(directory, file);
                const stat = fs.statSync(fullPath);

                // ✅ Skip node_modules and other heavy/irrelevant folders
                if (stat.isDirectory()) {
                    if (file === 'node_modules' || file.startsWith('.git') || file === 'dist' || file === 'build') {
                        console.log(`Skipping ignored folder: ${fullPath}`);
                        continue;
                    }
                    await processDirectory(fullPath);
                } else if (isCodeFile(file)) {
                    results.push(await analyzeFileAt(fullPath, rootPath));
                }
            }
        }

        await processDirectory(rootPath);


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
app.post('/analyze', async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const code = req.file.buffer.toString('utf8');
        const result = await buildFileMetricsResponse(code, req.file.originalname);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/analyze-code', express.json(), async (req, res) => {
    const { code, filename } = req.body;

    if (!code || !filename) {
        return res.status(400).json({ error: 'Request must include "code" and "filename"' });
    }

    try {
        const responseMetrics = await buildFileMetricsResponse(code, filename);
        res.json(responseMetrics);
    } catch (error) {
        console.error(`Error analyzing code for ${filename}:`, error);
        res.status(500).json({ error: `Failed to analyze code: ${error.message}` });
    }
});

// Batch endpoint: analyze multiple files in a single HTTP request (eliminates N sequential calls per commit)
// Body: { files: [{ code: string, filename: string }, ...] }
// Returns: array of analysis results (same schema as /analyze-code per item)
app.post('/analyze-batch', express.json({ limit: '50mb' }), async (req, res) => {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Request must include a non-empty "files" array' });
    }

    try {
    return await buildFileMetricsResponse(code, filename);
} catch (error) {
    console.error(`Batch: error analyzing ${filename}:`, error.message);
    return {
        filename,
        language: /\.(ts|tsx)$/i.test(filename) ? "typescript" : "javascript",
        total_loc: code.split('\n').length,
        total_nloc: 0,
        function_count: 0,
        total_complexity: 0,
        complexity_max: 0,
        total_cognitive_complexity: 0,
        halstead_volume: 0.0,
        maintainability_index: 0.0,
        is_unsupported: false,
        lint_score: null,
        lint_errors: [],
        functions: [],
        error: error.message
    };
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
