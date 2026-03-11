const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\Gauri\\Desktop\\Sagar\\Circle\\thec1rcle';
const reportPath = path.join(rootDir, 'audit_report.json');

if (!fs.existsSync(reportPath)) {
    console.error('Audit report not found. Run analyze_clients.js first.');
    process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const group1Files = report.files.filter(f => f.category.includes('Group 1'));

console.log(`Found ${group1Files.length} Group 1 components. Beginning conversion to Server Components...`);

let successCount = 0;
let failedCount = 0;
const convertedFiles = [];

for (const fileObj of group1Files) {
    const fullPath = path.join(rootDir, fileObj.file);
    try {
        let content = fs.readFileSync(fullPath, 'utf8');

        // Check if the file actually has "use client"
        if (!content.match(/^['"]use client['"];?/m)) {
            continue;
        }

        // Remove "use client" (and any trailing newlines/semicolons associated with it)
        content = content.replace(/^['"]use client['"];?\s*\n?/m, '');

        fs.writeFileSync(fullPath, content, 'utf8');
        convertedFiles.push(fileObj.file);
        successCount++;
    } catch (err) {
        console.error(`Failed to process ${fileObj.file}:`, err.message);
        failedCount++;
    }
}

console.log(`\nConversion complete.`);
console.log(`Successfully converted: ${successCount} files.`);
if (failedCount > 0) console.log(`Failed to process: ${failedCount} files.`);

// Save log of converted files for the report
fs.writeFileSync(path.join(rootDir, 'converted_group1.json'), JSON.stringify(convertedFiles, null, 2));
