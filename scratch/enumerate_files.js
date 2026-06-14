const fs = require('fs');
const path = require('path');

const dirs = [
  'apps/partner-dashboard/app',
  'apps/partner-dashboard/components',
  'apps/partner-dashboard/lib',
  'apps/api-gateway/src/routes/v1',
  'apps/api-gateway/src/services',
  'packages/core'
];

const domains = ['host', 'venue', 'promoter', 'finance'];

function getDomain(filePath) {
  const lower = filePath.toLowerCase();
  for (const d of domains) {
    if (lower.includes(d)) return d;
  }
  return 'shared';
}

const stats = {
  host: { files: 0, loc: 0, fileList: [] },
  venue: { files: 0, loc: 0, fileList: [] },
  promoter: { files: 0, loc: 0, fileList: [] },
  finance: { files: 0, loc: 0, fileList: [] },
  shared: { files: 0, loc: 0, fileList: [] }
};

function walk(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return;
  }
  if (dir.includes('node_modules')) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else {
      if (!fullPath.match(/\.(js|jsx|ts|tsx|css)$/)) continue;
      const domain = getDomain(fullPath);
      const loc = fs.readFileSync(fullPath, 'utf8').split('\n').length;
      stats[domain].files++;
      stats[domain].loc += loc;
      stats[domain].fileList.push(fullPath);
    }
  }
}

dirs.forEach(walk);

console.log("=== FILE ENUMERATION ===");
for (const domain in stats) {
    console.log(`${domain.toUpperCase()}:`);
    console.log(`  Files: ${stats[domain].files}`);
    console.log(`  LOC: ${stats[domain].loc}`);
    console.log(`  FileList: ${stats[domain].fileList.length > 0 ? '\n    ' + stats[domain].fileList.join('\n    ') : 'None'}`);
}
