const express = require('express');
const cors = require('cors');
const multer = require('multer');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use(cors());
app.use(express.json());

function calculateMetrics(code) {
    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'classProperties', 'classPrivateProperties', 'objectRestSpread'],
            ranges: true,
            locations: true,
            allowReturnOutsideFunction: true
        });

        const metrics = {
            LOC: code.split('\n').length,
            NLOC: code.split('\n').filter(l => l.trim()).length,
            NOF: 0,
            functions: []
        };

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
                    } else if (p.isClassMethod() || p.isObjectMethod()) {
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

                metrics.functions.push({
                    name: functionName,
                    NLOC: functionCode.split('\n').filter(l => l.trim()).length,
                    CC: calculateCognitiveComplexity(p, baseNesting), // Pass the NodePath and baseNesting
                    lineStart,
                    lineEnd
                });
            }
        });

        return metrics;
    } catch (error) {
        console.error('Error parsing code:', error);
        throw error;
    }
}

// function calculateCC(functionCode) {
//   let complexity = 1;
//   try {
//     let src = String(functionCode).trim();

//     // If it starts with 'async function' or 'function', wrap to make it an expression
//     if (/^(async\s+)?function\b/.test(src)) {
//       src = `(${src})`;
//     }
//     // Class/Object method shorthand like "foo() { ... }" → wrap into object
//     else if (/^\w+\s*\([^)]*\)\s*\{/.test(src)) {
//       src = `({ ${src} })`;
//     }

//     // Arrow functions are already expressions; leave them as-is
//     // Now parse in expression position (no extra block!)
//     const ast = parser.parse(`${src};`, {
//       sourceType: 'module',
//       plugins: ['jsx', 'typescript', 'classProperties', 'objectRestSpread'],
//       allowReturnOutsideFunction: true
//     });

//     traverse(ast, {
//       enter(path) {
//         switch (path.type) {
//           case 'IfStatement':
//           case 'ConditionalExpression':
//           case 'ForStatement':
//           case 'ForInStatement':
//           case 'ForOfStatement':
//           case 'WhileStatement':
//           case 'DoWhileStatement':
//           case 'CatchClause':
//             complexity++;
//             break;
//           case 'LogicalExpression':
//             if (path.node.operator === '&&' || path.node.operator === '||') complexity++;
//             break;
//           case 'SwitchCase':
//             if (path.node.test) complexity++;
//             break;
//         }
//       }
//     });

//     return complexity;
//   } catch (error) {
//     console.error('Error calculating cyclomatic complexity:', error);
//     console.error('Function code causing error:', functionCode);
//     return 1;
//   }
// }

function calculateCognitiveComplexity(funcPath, baseNesting = 0) {
    let complexity = 0;
    let nesting = baseNesting;

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

            // --- Control Flow ---
            if (path.isIfStatement()) {
                const isElseIf = path.key === 'alternate' && path.parentPath.isIfStatement();

                if (isElseIf) {
                    // Else-if should not increase nesting relative to the chain
                    // Parent nesting included us, so cost is flat (+1 structural)
                    // We calculate cost using (nesting - 1) to simulate being at parent's level
                    complexity += 1 + (nesting - 1);
                } else {
                    addStructural();
                    nesting++;
                }

                // Check for 'else' (non-if alternate)
                if (path.node.alternate && path.node.alternate.type !== 'IfStatement') {
                    addFundamental();
                }
            }
            else if (path.isSwitchStatement()) {
                nesting++;
            }
            else if (path.isSwitchCase()) {
                addFundamental(); // Covers case and default
            }
            else if (path.isForStatement() || path.isForInStatement() || path.isForOfStatement() ||
                path.isWhileStatement() || path.isDoWhileStatement()) {
                addStructural();
                nesting++;
            }
            else if (path.isCatchClause()) {
                addStructural();
                nesting++; // Catch block implies nesting
            }
            // --- Logical Operators (&&, ||, ??) ---
            else if (path.isLogicalExpression()) {
                const op = path.node.operator;
                if (op === '&&' || op === '||' || op === '??') {
                    // Only add if not part of a sequence of the same operator
                    if (!path.parentPath.isLogicalExpression() || path.parentPath.node.operator !== op) {
                        addFundamental();
                    }
                }
            }
            // Removed ConditionalExpression to match user expectation (CC=1 for formatFileSize)
            else if (path.isConditionalExpression()) {
                addStructural();
                nesting++;
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

    return complexity;
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

app.post('/analyze-zip', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        console.log('Received file:', req.file.originalname);
        const zip = new AdmZip(req.file.path);
        const extractPath = path.join('uploads', 'extracted_' + Date.now());

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


        // Clean up uploaded file and extracted contents
        fs.unlinkSync(req.file.path);
        cleanupDirectory(extractPath);

        res.json({
            rootFolder: detectedRoot || null,
            totalFiles: results.length,
            results
        });
    } catch (error) {
        // Clean up on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

// Keep the original single file endpoint
app.post('/analyze', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const result = analyzeFile(req.file.path);

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

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

        let complexity_sum = 0;
        let complexity_max = 0;

        const functions = babelMetrics.functions.map(f => {
            const cc = f.CC;
            complexity_sum += cc;
            if (cc > complexity_max) {
                complexity_max = cc;
            }
            return {
                cyclomatic_complexity: cc,
                nloc: f.NLOC,
                token_count: 0, // Not available from babel parser
                name: f.name,
                long_name: f.name, // Use name as long_name
                start_line: f.lineStart,
                end_line: 0, // Not available
                max_nesting_depth: 0, // Not available
            };
        });

        const function_count = functions.length;
        const complexity_avg = function_count > 0 ? parseFloat((complexity_sum / function_count).toFixed(2)) : 0.0;

        const responseMetrics = {
            filename: filename,
            language: 'javascript', // Hardcode for this endpoint
            total_loc: babelMetrics.LOC,
            total_nloc: babelMetrics.NLOC,
            function_count: function_count,
            complexity_avg: complexity_avg,
            complexity_max: complexity_max,
            functions: functions,
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