/* eslint no-var: "error", no-console: "warn" */

var x = 10;

console.log("This triggers a warning, while 'var' triggers an error.");

// create fatal error

function test() {
    console.log("This triggers a warning, while 'var' triggers an error.");

    