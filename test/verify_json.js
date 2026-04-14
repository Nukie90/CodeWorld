
const http = require('http');
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'temp.js'), 'utf8');

const postData = JSON.stringify({
    code: code,
    filename: 'test.js'
});

const options = {
    hostname: 'localhost',
    port: 3100,
    path: '/analyze-code',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log(`Sending request to ${options.hostname}:${options.port}...`);

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const outputString = JSON.stringify(json, null, 2);
            console.log(outputString);
            // fs.writeFileSync(path.join(__dirname, 'output.txt'), outputString);
            // console.log('Output saved to output.txt');
        } catch (e) {
            console.error('Response was not JSON:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
