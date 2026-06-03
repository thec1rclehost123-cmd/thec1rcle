import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const partnerDashboardRoot = path.join(repoRoot, "apps", "partner-dashboard");

const ROUTE_FILE_PATTERN = /\/route\.(ts|js)$/;
const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs)$/;
const UPLOAD_PATTERN = /\b(uploadBytes|uploadBytesResumable|getDownloadURL)\b/;
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
]);

const STORE_FILES = [
  "lib/server/hostSettingsStore.ts",
  "lib/server/promoterFinanceStore.ts",
  "lib/server/promoterLinkStore.js",
  "lib/server/promoterSettingsStore.ts",
  "lib/server/staffProfileStore.ts",
];

function walkFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, results);
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function routeCount(relativeDir) {
  const fullDir = path.join(partnerDashboardRoot, relativeDir);
  return walkFiles(fullDir).filter((filePath) => ROUTE_FILE_PATTERN.test(filePath)).length;
}

function findSourceFiles(rootDir) {
  return walkFiles(rootDir).filter((filePath) => SOURCE_FILE_PATTERN.test(filePath));
}

function collectUploadSurfaces() {
  return findSourceFiles(partnerDashboardRoot)
    .filter((filePath) => UPLOAD_PATTERN.test(fs.readFileSync(filePath, "utf8")))
    .map((filePath) => path.relative(repoRoot, filePath))
    .sort();
}

function collectStoreInventory() {
  const sourceFiles = findSourceFiles(partnerDashboardRoot)
    .filter((filePath) => !filePath.endsWith(".test.ts") && !filePath.endsWith(".test.js"));

  return STORE_FILES.map((relativePath) => {
    const aliasPath = `@/${relativePath}`;
    const importNeedle = `${path.basename(relativePath, path.extname(relativePath))}`;
    const referencedBy = sourceFiles
      .filter((filePath) => {
        const relativeFilePath = path.relative(repoRoot, filePath);
        if (relativeFilePath.endsWith(relativePath)) return false;
        const source = fs.readFileSync(filePath, "utf8");
        return source.includes(aliasPath) || source.includes(importNeedle);
      })
      .map((filePath) => path.relative(repoRoot, filePath))
      .sort();

    return {
      file: relativePath,
      referencedBy,
      referenceCount: referencedBy.length,
    };
  });
}

export function buildPartnerDashboardHardeningBaseline() {
  return {
    routeCounts: {
      hostBffRoutes: routeCount(path.join("app", "api", "host")),
      venueBffRoutes: routeCount(path.join("app", "api", "venue")),
      promoterBffRoutes: routeCount(path.join("app", "api", "promoter")),
      crossRolePromoterRoutes: routeCount(path.join("app", "api", "partner", "promoter")),
      unifiedPartnerCatchAllRoutes: routeCount(path.join("app", "api", "partners")),
    },
    routeDirectories: {
      host: {
        discover: fs.existsSync(path.join(partnerDashboardRoot, "app", "host", "discover", "page.tsx")),
        network: fs.existsSync(path.join(partnerDashboardRoot, "app", "host", "network", "page.tsx")),
        partnerships: fs.existsSync(path.join(partnerDashboardRoot, "app", "host", "partnerships", "page.tsx")),
      },
      venue: {
        connections: fs.existsSync(path.join(partnerDashboardRoot, "app", "venue", "connections", "page.tsx")),
        partners: fs.existsSync(path.join(partnerDashboardRoot, "app", "venue", "partners", "page.tsx")),
        partnerships: fs.existsSync(path.join(partnerDashboardRoot, "app", "venue", "partnerships", "page.tsx")),
      },
      promoter: {
        connections: fs.existsSync(path.join(partnerDashboardRoot, "app", "promoter", "connections", "page.tsx")),
        partners: fs.existsSync(path.join(partnerDashboardRoot, "app", "promoter", "partners", "page.tsx")),
        partnerships: fs.existsSync(path.join(partnerDashboardRoot, "app", "promoter", "partnerships", "page.tsx")),
      },
    },
    uploadSurfaces: collectUploadSurfaces(),
    storeInventory: collectStoreInventory(),
  };
}

if (process.argv[1] === __filename) {
  console.log(JSON.stringify(buildPartnerDashboardHardeningBaseline(), null, 2));
}
