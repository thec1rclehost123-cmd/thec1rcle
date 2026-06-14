const fs = require('fs');
const path = require('path');

function walkDir(dir, filterExt = ['.ts', '.tsx', '.js', '.jsx']) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (file === 'node_modules' || file === '.next' || file === 'dist' || file === '.turbo' || file === 'build') return;
        
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(fullPath, filterExt));
        } else {
            const ext = path.extname(fullPath);
            if (filterExt.includes(ext)) {
                results.push({
                    path: fullPath,
                    content: fs.readFileSync(fullPath, 'utf8')
                });
            }
        }
    });
    return results;
}

const bffFiles = walkDir('apps/partner-dashboard/app/api');
const gatewayFiles = walkDir('apps/api-gateway/src/routes');

let proxyCount = 0;
let proxiedPaths = new Set();

bffFiles.forEach(f => {
    const lines = f.content.split('\n');
    lines.forEach(line => {
        if (line.includes('proxyToGateway')) {
            proxyCount++;
            const match = line.match(/GATEWAY_URL\}\/api\/v1\/([^?`"']+)/);
            if (match && match[1]) {
                let p = match[1].split('/${')[0]; 
                proxiedPaths.add(p);
            }
        }
    });
});

let unmatched = [];
const allGatewayContent = gatewayFiles.map(f => f.content).join('\n');

proxiedPaths.forEach(p => {
    const searchA = `('/${p}`;
    const searchB = `("/${p}`;
    const searchC = `\`/${p}`;
    
    if (!allGatewayContent.includes(searchA) && !allGatewayContent.includes(searchB) && !allGatewayContent.includes(searchC)) {
        const parts = p.split('/');
        const prefixSearch = `('/${parts.slice(1).join('/')}`;
        if (!allGatewayContent.includes(prefixSearch)) {
             unmatched.push(p);
        }
    }
});

console.log(`TOTAL_PROXY_CALLS=${proxyCount}`);
console.log(`TOTAL_UNIQUE_PROXY_PATHS=${proxiedPaths.size}`);
console.log(`UNMATCHED_PATHS=${unmatched.length}`);
console.log(`UNMATCHED_EXAMPLES=${unmatched.slice(0, 10).join(', ')}`);
console.log(`DRIFT_PERCENT=${Math.round((unmatched.length / proxiedPaths.size) * 100)}%`);
