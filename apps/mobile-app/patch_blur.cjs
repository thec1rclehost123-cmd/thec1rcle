const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/mobile-app');
let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('BlurView') && content.includes('<BlurView')) {
    // Only replace if it doesn't already have experimentalBlurMethod
    const original = content;
    content = content.replace(/<BlurView(?!\s+experimentalBlurMethod)([^>]*?)>/g, '<BlurView experimentalBlurMethod="dimezisBlurView"$1>');
    if (original !== content) {
      fs.writeFileSync(file, content, 'utf8');
      modifiedCount++;
      console.log(`Patched: ${file}`);
    }
  }
});
console.log(`Total files patched: ${modifiedCount}`);
