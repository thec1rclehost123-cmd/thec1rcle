const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
    if (!fs.existsSync(dir)) return filelist;
    fs.readdirSync(dir).forEach(file => {
        const dirFile = path.join(dir, file);
        try {
            filelist = fs.statSync(dirFile).isDirectory()
                ? walkSync(dirFile, filelist)
                : filelist.concat(dirFile);
        } catch (err) { }
    });
    return filelist;
};

const appsDir = path.join(__dirname, 'apps');
const files = walkSync(appsDir).filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));

const clientHooksRegex = /use(State|Effect|Ref|Memo|Callback|Context|Query|Mutation|Client|Router|Params|SearchParams|Pathname|DashboardAuth|InfiniteQuery|Auth|CancelEvent|PrefersReducedMotion)|on(Click|Change|Submit|KeyDown|KeyUp|Focus|Blur|Scroll|Input)|createContext|window\.|document\./;

const unnecessary = [];

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('"use client"') || content.includes("'use client'")) {
        if (!clientHooksRegex.test(content)) {
            unnecessary.push(file);
        }
    }
});

console.log("Unnecessary 'use client' files:");
unnecessary.forEach(f => console.log(f.replace(appsDir, '')));
