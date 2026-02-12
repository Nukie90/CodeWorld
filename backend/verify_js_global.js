const { calculateMetrics } = require('./app/js_plugin/server');

const code = `
const a = 1;

if (a > 0) {
    console.log('global');
}

function foo() {
    return;
}
`;

try {
    const metrics = calculateMetrics(code);
    const globalFn = metrics.functions.find(f => f.id === -1);
    const fooFn = metrics.functions.find(f => f.name === 'foo');

    if (!globalFn) {
        console.error('FAIL: (global) function not found');
        process.exit(1);
    }

    if (fooFn.parentId !== null) {
        console.error(`FAIL: foo parentId should be null (sibling), got ${fooFn.parentId}`);
        process.exit(1);
    }

    // Check CC
    if (globalFn.CC !== 1) { // 1 for if(a>0)
        console.error(`FAIL: Global CC should be 1, got ${globalFn.CC}`);
        process.exit(1);
    }

    console.log('SUCCESS: JS Separation verification passed');

} catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
}
