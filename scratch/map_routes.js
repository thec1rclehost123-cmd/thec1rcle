const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const f of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else if (fullPath.match(/\.(ts|js|tsx|jsx)$/)) {
      files.push(fullPath);
    }
  }
  return files;
}

const bffFiles = getFiles('apps/partner-dashboard/app/api');
const gwFiles = getFiles('apps/api-gateway/src/routes/v1');

const routes = [];

// Rough extraction
for (const file of bffFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let currentMethod = 'UNKNOWN';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/export (async )?function (GET|POST|PUT|PATCH|DELETE)/)) {
        const match = line.match(/export (async )?function (GET|POST|PUT|PATCH|DELETE)/);
        currentMethod = match[2];
    }
    
    if (line.includes('proxyToGateway')) {
        let match = line.match(/GATEWAY_URL\}\/api\/v1([^`"']+)/);
        if (match) {
            routes.push({
                file: file.replace('apps/partner-dashboard/app/api/', ''),
                method: currentMethod,
                target: `/api/v1${match[1].split('?')[0]}`
            });
        }
    }
  }
}

// Find gateway routes
const gwRoutes = [];
for (const file of gwFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
        const match = line.match(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/);
        if (match) {
            gwRoutes.push({
                file: file.replace('apps/api-gateway/src/routes/v1/', ''),
                method: match[1].toUpperCase(),
                path: match[2]
            });
        }
    }
}

console.log("=== ROUTE MAPPING ===");
let matched = 0;
let unmatched = 0;
for (const r of routes) {
    // Basic match check (ignoring exact param names, just checking structure)
    let bffParts = r.target.replace('/api/v1', '').split('/').filter(Boolean);
    let found = false;
    
    for (const gwr of gwRoutes) {
        if (gwr.method !== r.method) continue;
        let gwParts = gwr.path.split('/').filter(Boolean);
        if (bffParts.length === gwParts.length) {
            found = true;
            break;
        }
    }
    
    if (found) {
        matched++;
    } else {
        unmatched++;
        // console.log(`UNMATCHED: ${r.method} ${r.target} (from ${r.file})`);
    }
}
console.log(`Total BFF Proxy Routes: ${routes.length}`);
console.log(`Matched with Gateway: ${matched}`);
console.log(`Unmatched/Dynamic: ${unmatched}`);
// We will sample 5 unmatched routes to see what's wrong
let count = 0;
for (const r of routes) {
    let bffParts = r.target.replace('/api/v1', '').split('/').filter(Boolean);
    let found = false;
    for (const gwr of gwRoutes) {
        if (gwr.method !== r.method) continue;
        let gwParts = gwr.path.split('/').filter(Boolean);
        if (bffParts.length === gwParts.length) {
            found = true;
            break;
        }
    }
    if (!found && count < 20) {
        console.log(`MISSING IN GATEWAY: ${r.method} ${r.target} (from ${r.file})`);
        count++;
    }
}
