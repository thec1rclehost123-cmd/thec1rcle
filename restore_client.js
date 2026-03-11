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

const clientPatterns = [
    'useState',
    'useEffect',
    'useRef',
    'useMemo',
    'useCallback',
    'usePathname',
    'useRouter',
    'useSearchParams',
    'useAuth',
    'framer-motion',
    'motion.',
    'AnimatePresence',
    'react-virtuoso',
    'useForm',
    'useFieldArray'
];

files.forEach(file => {
    if (file.includes('node_modules') || file.includes('.next')) return;

    let content = fs.readFileSync(file, 'utf8');
    const needsClient = clientPatterns.some(p => content.includes(p));
    const hasClient = content.includes('"use client"') || content.includes("'use client'");

    if (needsClient && !hasClient) {
        // Double check it's not a library file or something
        if (content.includes('export default function') || content.includes('const ') || content.includes('function ')) {
            fs.writeFileSync(file, `"use client";\n\n${content}`, 'utf8');
            console.log('Fixed:', file);
            fixedCount++;
        }
    }
});

console.log('Total files fixed:', fixedCount);
