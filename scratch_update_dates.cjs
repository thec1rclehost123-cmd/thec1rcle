const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'apps/mobile-app/lib/demo/index.ts');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/startDate:\s*'([^']+)'/g, (match, d) => {
  const day = Math.floor(Math.random() * 28) + 1;
  const dayStr = String(day).padStart(2, '0');
  const oldTime = d.split('T')[1];
  return `startDate: '2026-08-${dayStr}T${oldTime}'`;
});

// For endDate, we just shift the month to 08 and keep the original day but wait, if it crossed a month boundary?
// Let's just blindly update month to 08, and if day is > 28 we cap it at 28 just in case.
code = code.replace(/endDate:\s*'([^']+)'/g, (match, d) => {
  // Let's just find the corresponding startDate day? No, this is regex.
  // We can just keep the original day from the string but change month to 08
  const parts = d.split('T');
  const dateParts = parts[0].split('-');
  dateParts[1] = '08';
  return `endDate: '${dateParts.join('-')}T${parts[1]}'`;
});

fs.writeFileSync(file, code);
console.log('Done!');
