import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const checks = [];

function read(relPath) {
    return fs.readFileSync(path.join(root, relPath), "utf8");
}

function expectIncludes(relPath, snippet, message) {
    const contents = read(relPath);
    if (!contents.includes(snippet)) {
        checks.push({ ok: false, message: `${message} (${relPath})` });
        return;
    }
    checks.push({ ok: true, message });
}

function expectFile(relPath, message) {
    const exists = fs.existsSync(path.join(root, relPath));
    checks.push({ ok: exists, message: `${message} (${relPath})` });
}

expectIncludes("package.json", "\"functions\"", "Root workspaces include functions");
expectIncludes("package.json", "http://localhost:3000/api/inngest", "Inngest dev target points at guest-portal");
expectIncludes("apps/partner-dashboard/package.json", "next dev --turbo -p 3001", "Partner dashboard dev port is 3001");
expectIncludes("apps/admin-console/package.json", "next dev --turbo -p 3002", "Admin console dev port is 3002");
expectIncludes("apps/partner-dashboard/Dockerfile", "ENV PORT 3001", "Partner dashboard Docker port is 3001");
expectIncludes("docker-compose.yml", "- \"3001:3001\"", "Docker compose exposes partner dashboard on 3001");
expectIncludes("docker-compose.yml", "- \"3002:3002\"", "Docker compose exposes admin console on 3002");
expectIncludes("apps/api-gateway/src/config/index.ts", "default('4000')", "API gateway defaults to port 4000");
expectIncludes("apps/api-gateway/.env.example", "FRONTEND_URLS=http://localhost:3000,http://localhost:3001,http://localhost:3002", "API gateway example CORS origins match local web ports");
expectIncludes("packages/core/workflows/maintenance.js", "http://localhost:4000/api/v1", "Maintenance workflow pings the API gateway");
expectIncludes("scripts/patchExpoRouter.js", "major !== 5", "Expo Router patch is version-gated");
expectIncludes("packages/ui/package.json", "\"react\": \"^18.0.0 || ^19.0.0\"", "UI peers allow React 18 and 19");
expectFile("apps/api-gateway/.env.example", "API gateway example env exists");
expectFile("apps/admin-console/.env.example", "Admin console example env exists");

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
    const prefix = check.ok ? "OK" : "FAIL";
    console.log(`${prefix} ${check.message}`);
}

if (failures.length > 0) {
    process.exitCode = 1;
    console.error(`\n${failures.length} stack check(s) failed.`);
} else {
    console.log(`\nAll ${checks.length} stack checks passed.`);
}
