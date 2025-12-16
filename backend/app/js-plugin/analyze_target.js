const { calculateMetrics } = require('./server');
const fs = require('fs');

const filePath = '/Users/neztage/Desktop/Desktop - Intutch’s MacBook Air/KMITL/Team_Project/CodeWorld/backend/temp_repos/Software-Engineering-Hub.git-9cb5a91e652d/main/templates/Item/main.js';

try {
    const code = fs.readFileSync(filePath, 'utf8');
    const metrics = calculateMetrics(code);

    // Sort functions by complexity descending
    metrics.functions.sort((a, b) => b.CC - a.CC);

    let totalCC = 0;
    metrics.functions.forEach(f => totalCC += f.CC);

    console.log("Total CC:", totalCC);
    console.log(JSON.stringify(metrics, null, 2));
} catch (e) {
    console.error(e);
}
