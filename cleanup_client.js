const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\Gauri\\Desktop\\Sagar\\Circle\\thec1rcle\\apps\\guest-portal';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.match(/\.(js|jsx|tsx|ts)$/)) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(targetDir);
let fixedCount = 0;

const serverKeywords = [
    'generateMetadata',
    'generateStaticParams',
    'export const revalidate',
    'export const dynamic',
    'export const fetchCache',
    'export const runtime'
];

files.forEach(file => {
    if (file.includes('node_modules') || file.includes('.next')) return;

    let content = fs.readFileSync(file, 'utf8');
    const hasClient = content.includes('"use client"') || content.includes("'use client'");
    const isServerModule = serverKeywords.some(kw => content.includes(kw));

    if (hasClient && isServerModule) {
        // Remove "use client"
        let newContent = content.replace(/^"use client";\r?\n\r?\n?/, '');
        newContent = newContent.replace(/^'use client';\r?\n\r?\n?/, '');

        if (newContent !== content) {
            fs.writeFileSync(file, newContent, 'utf8');
            console.log('Removed "use client" from Server Module:', file);
            fixedCount++;
        }
    }
});

console.log('Total files cleaned up:', fixedCount);
