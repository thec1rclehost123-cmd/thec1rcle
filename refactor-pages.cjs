const fs = require('fs');
const path = require('path');

const targetDirs = [
    'apps/guest-portal/app',
    'apps/partner-dashboard/app'
];

function findFiles(dir, filter, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findFiles(fullPath, filter, fileList);
        } else if (filter(fullPath)) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

const pageFiles = [];
for (const dir of targetDirs) {
    findFiles(path.join(__dirname, dir), (f) => f.endsWith('page.tsx') || f.endsWith('page.jsx'), pageFiles);
}

console.log(`Found ${pageFiles.length} page files.`);

let modifiedCount = 0;

for (const filePath of pageFiles) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if it has "use client"
    if (content.includes('"use client"') || content.includes("'use client'")) {
        const ext = path.extname(filePath);
        const dir = path.dirname(filePath);
        const clientFile = path.join(dir, `PageClient${ext}`);

        // Write original content to PageClient
        fs.writeFileSync(clientFile, content);

        // Write new server component to page
        const isTsx = ext === '.tsx';
        let newContent = `import PageClient from './PageClient';\n\n`;
        newContent += isTsx
            ? `export default function Page(props: any) {\n  return <PageClient {...props} />;\n}\n`
            : `export default function Page(props) {\n  return <PageClient {...props} />;\n}\n`;

        fs.writeFileSync(filePath, newContent);
        console.log(`Refactored: ${filePath}`);
        modifiedCount++;
    }
}

console.log(`Successfully refactored ${modifiedCount} files.`);
