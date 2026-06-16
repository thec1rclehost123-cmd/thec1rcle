import fs from 'fs';

let content = fs.readFileSync('PageClient.tsx', 'utf8');

content = content.replace(/emerald-500/g, 'c1rcle-orange');
content = content.replace(/emerald-400/g, 'c1rcle-orange-light');
content = content.replace(/rgba\(16,185,129,0\.2\)/g, 'rgba(244,74,34,0.2)');

fs.writeFileSync('PageClient.tsx', content);
console.log('Replaced emerald with c1rcle-orange');
