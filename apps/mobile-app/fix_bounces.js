/* eslint-disable */

const fs = require('fs');
const path = require('path');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (
        file.endsWith('.tsx') ||
        file.endsWith('.ts') ||
        file.endsWith('.jsx') ||
        file.endsWith('.js')
      ) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = [...walk('app'), ...walk('components')];

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  const tags = [
    'ScrollView',
    'FlatList',
    'SectionList',
    'FlashList',
    'Animated\\.ScrollView',
    'Animated\\.FlatList',
    'Animated\\.FlashList',
    'BottomSheetScrollView',
    'BottomSheetFlatList',
    'KeyboardAwareScrollView',
  ];

  const regex = new RegExp(`<(${tags.join('|')})([^>]*?)>`, 'g');

  newContent = newContent.replace(regex, (match, tag, props) => {
    let newProps = props;

    if (!newProps.includes('bounces=')) {
      if (newProps.endsWith('/')) {
        newProps = ` bounces={false} overScrollMode="never" ${newProps.slice(0, -1)}/`;
      } else {
        newProps = ` bounces={false} overScrollMode="never"${newProps}`;
      }
    } else {
      // replace existing bounces
      newProps = newProps.replace(/bounces=\{[^\}]+\}/g, 'bounces={false}');
      newProps = newProps.replace(/bounces="[^"]+"/g, 'bounces={false}');
      // Also add overScrollMode if not there
      if (!newProps.includes('overScrollMode=')) {
        if (newProps.endsWith('/')) {
          newProps = ` overScrollMode="never" ${newProps.slice(0, -1)}/`;
        } else {
          newProps = ` overScrollMode="never"${newProps}`;
        }
      }
    }
    return `<${tag}${newProps}>`;
  });

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated ' + file);
  }
});
