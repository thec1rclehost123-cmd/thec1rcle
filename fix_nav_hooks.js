const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\Gauri\\Desktop\\Sagar\\Circle\\thec1rcle';
const logPath = path.join(rootDir, 'converted_group1.json');

if (!fs.existsSync(logPath)) process.exit(0);

const files = JSON.parse(fs.readFileSync(logPath, 'utf8'));

let fixed = 0;
for (const file of files) {
    const fullPath = path.join(rootDir, file);
    try {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.match(/usePathname|useRouter|useSearchParams/)) {
            if (!content.includes('"use client"')) {
                fs.writeFileSync(fullPath, `"use client";\n\n${content}`, 'utf8');
                console.log('Restored "use client" to:', file);
                fixed++;
            }
        }
    } catch (err) {
        // skip
    }
}
console.log('Total fixed:', fixed);
