const fs = require("fs");
const path = require("path");

const WORKSPACE_DIR = path.resolve(__dirname, "../apps/partner-dashboard");
const ARTIFACTS_DIR = path.resolve(__dirname, "../../.gemini/antigravity/artifacts");
const REPORT_FILE = path.join(WORKSPACE_DIR, "any_casts_report.json");

function scanDirectory(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (!file.includes("node_modules") && !file.includes(".next") && !file.includes("dist")) {
                scanDirectory(filePath, fileList);
            }
        } else if (filePath.endsWith(".ts") || filePath.endsWith(".tsx") || filePath.endsWith(".js") || filePath.endsWith(".jsx")) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

function auditCasts() {
    const files = scanDirectory(WORKSPACE_DIR);
    const results = [];

    for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");
        const occurrences = [];

        lines.forEach((line, index) => {
            if (line.includes("as any")) {
                occurrences.push({
                    line: index + 1,
                    code: line.trim()
                });
            }
        });

        if (occurrences.length > 0) {
            results.push({
                file: path.relative(path.resolve(__dirname, ".."), file),
                count: occurrences.length,
                occurrences
            });
        }
    }

    // Ensure output directories exist
    if (!fs.existsSync(path.dirname(REPORT_FILE))) {
        fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    }

    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
    
    const totalCount = results.reduce((acc, r) => acc + r.count, 0);
    console.log(`[AUDIT COMPLETE] Found ${totalCount} 'as any' casts in ${results.length} files inside partner-dashboard.`);
}

auditCasts();
