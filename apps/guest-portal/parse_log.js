const fs = require('fs');
const content = fs.readFileSync('build.log', 'utf16le');
const lines = content.split('\n');
const errors = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Error:')) {
        errors.push(lines[i - 1]);
        errors.push(lines[i]);
        errors.push(lines[i + 1]);
        errors.push(lines[i + 2]);
    }
}
fs.writeFileSync('build-errors.txt', errors.join('\n'));
console.log('Errors written to build-errors.txt');
