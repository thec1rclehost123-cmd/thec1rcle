const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\Gauri\\Desktop\\Sagar\\Circle\\thec1rcle';
const appsDir = path.join(rootDir, 'apps');
const packagesDir = path.join(rootDir, 'packages');

const result = {
    total: 0,
    byApp: {},
    files: []
};

function scanDir(dir, appName) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        // Skip node_modules and .next
        if (entry.isDirectory() && !['node_modules', '.next', '.git'].includes(entry.name)) {
            scanDir(fullPath, appName);
        } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.match(/^['"]use client['"]/m)) {
                result.total++;
                if (!result.byApp[appName]) result.byApp[appName] = 0;
                result.byApp[appName]++;

                // Basic heuristic to guess category
                let category = 'Unknown';
                if (content.match(/useState|useEffect|useRef|window\.|document\./)) {
                    if (content.match(/framer-motion|three|gsap|canvas/i)) {
                        category = 'Group 3 (Heavy Client)';
                    } else {
                        category = 'Group 2 (State/Hooks/Browser)';
                    }
                } else if (content.match(/onClick|onChange|onSubmit/)) {
                    category = 'Group 2 (Event Handlers)';
                } else {
                    category = 'Group 1 (Pure UI - Safe to Convert)';
                }

                result.files.push({
                    file: fullPath.replace(rootDir, ''),
                    app: appName,
                    category,
                    size: fs.statSync(fullPath).size
                });
            }
        }
    }
}

// Map directories to scan
scanDir(path.join(appsDir, 'guest-portal'), 'guest-portal');
scanDir(path.join(appsDir, 'partner-dashboard'), 'partner-dashboard');
scanDir(path.join(appsDir, 'admin-console'), 'admin-console');
scanDir(path.join(packagesDir, 'ui'), 'packages/ui');

// Group analysis
const summary = {
    total: result.total,
    byApp: result.byApp,
    group1: result.files.filter(f => f.category.includes('Group 1')).length,
    group2: result.files.filter(f => f.category.includes('Group 2')).length,
    group3: result.files.filter(f => f.category.includes('Group 3')).length,
};

fs.writeFileSync(path.join(rootDir, 'audit_report.json'), JSON.stringify({ summary, files: result.files }, null, 2));
console.log(JSON.stringify(summary, null, 2));
