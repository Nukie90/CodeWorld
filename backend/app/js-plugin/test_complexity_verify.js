const { calculateMetrics } = require('./server');
const assert = require('assert');

// Helper to check CC
function checkCC(code, expectedCC, name = 'test') {
    const metrics = calculateMetrics(code);
    const fn = metrics.functions[0]; // Assuming one function
    if (!fn) {
        console.error(`No function found in code: ${code}`);
        return;
    }
    const actual = fn.CC;
    if (actual === expectedCC) {
        console.log(`[PASS] ${name}: Expected ${expectedCC}, got ${actual}`);
    } else {
        console.error(`[FAIL] ${name}: Expected ${expectedCC}, got ${actual}`);
        console.error(`Code:\n${code}`);
    }
}

console.log('--- Verifying Cognitive Complexity ---');

// 1. If-Else
// if (1) -> 1
// else -> 1
// Total: 2
checkCC(
    `function testElse() {
        if (x) {
        } else {
        }
    }`,
    2,
    'If-Else'
);

// 2. Linear Else If (should not penalize structural nesting of else ifs, but count else)
// if (x) ... (+1)
// else if (y) ... (technically if nested in else? No, structure is flattened usually?)
// My implementation:
// if (x) -> +1
// else if (y) -> Alternate is IfStatement.
//    Child If: +1. Nesting increases?
//    My nesting logic: nesting++ on enter If.
//    If I simply nest, if..else if..else if will explode in nesting.
//    Sonar Rule: "No increment for else if".
//    Let's see what my code does:
//    Enter If(x): +1 (struct) + 0 (nest). Nesting=1.
//      Enter Alternate If(y): +1 (struct) + 1 (nest). Nesting=2.
//    This seems to penalize else-if nesting!
//    Wait, Sonar says "else if" is treated as one construct?
//    My code: "if (path.node.alternate && path.node.alternate.type !== 'IfStatement')" adds +1 for final else.
//    But the `else if` node itself is visited.
//    If `else if` is visited as a child of `alternate`, it triggers `IfStatement` visitor.
//    So it adds structural complexity (+1) + nesting.
//    If nesting is not reset, it penalizes.
//    Standard Babel traverse: `else if` is just a nested IfStatement in alternate.
//    To support "no nesting penalty for else if", I need to detect if parent is IfStatement (alternate).
//    My code: `if (path.isIfStatement()) { addStructural(); ... }`
//    It counts +1 structural always.
//    Does it add nesting? `nesting++`.
//    If I want to avoid nesting penalty for else-if, I should check `if (path.parentPath.isIfStatement() && path.key === 'alternate')`.
//    If so, do NOT increment nesting? OR do NOT increment complexity?
//    Sonar: "else if" +1 complexity. No nesting increment?
//    Actually, "if, else if, else..." each add +1.
//    Nesting should not increase for the chain.
//    I missed fixing the nesting for `else if`.
//    Let's test it first.
checkCC(
    `function testElseIf() {
        if (x) {
        } else if (y) {
        }
    }`,
    2, // Expect: 1 (if) + 1 (else if). If nesting applied, 2nd if might be higher?
    // My code: First if: 1. Nesting=1.
    // Second if (nested in alternate): 1 + 1 (nesting) = 2?
    // Total = 3? If so, I need to fix logic.
    'Else-If Chain'
);

// 3. Logical Sequences
// a && b && c
// && (top): +1
// && (child): +0 (same op)
// Total: 1
checkCC(
    `function testBool() {
        if (a && b && c) {}
    }`,
    2, // 1 (if) + 1 (boolean seq).
    'Boolean Sequence'
);

// 4. Switch
// Switch: +0 (complexity), +1 (nesting for children?)
// Case 1: +1
// Default: +1
// Total: 2
checkCC(
    `function testSwitch() {
        switch (x) {
            case 1: break;
            default: break;
        }
    }`,
    2,
    'Switch Default'
);

// 5. Mixed
checkCC(
    `function textMixed() {
        if (x) { // +1
           if (y) {} // +2 (1 + 1 nest)
        } else { // +1
           return;
        }
    }`,
    4, // 1 + 2 + 1 = 4
    'Mixed Nesting'
);
