
const http = require('http');
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'temp_code.js'), 'utf8');

const postData = JSON.stringify({
    code: code,
    filename: 'temp_code.js'
});

const options = {
    hostname: 'localhost',
    port: 3001,
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
            console.log(JSON.stringify(json, null, 2));
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
