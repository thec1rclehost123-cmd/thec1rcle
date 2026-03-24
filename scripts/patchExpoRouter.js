const fs = require("fs");
const path = require("path");

/**
 * Patch only Expo Router v5 installs that are missing the internal routing shim.
 * Newer majors do not need this bridge, and older hoisted installs may not even
 * match the API this shim expects.
 */
const content = `"use strict";
const core = require("../build/getRoutesCore.js");
module.exports = { ...core, getRoutesCore: core.getRoutes };
`;

const candidates = [
    path.join(__dirname, "..", "node_modules", "expo-router"),
    path.join(__dirname, "..", "apps", "mobile-app", "node_modules", "expo-router"),
];

let patched = 0;

for (const routerDir of candidates) {
    const packageJsonPath = path.join(routerDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
        continue;
    }

    const version = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version || "";
    const major = Number(version.split(".")[0]);

    if (major !== 5) {
        continue;
    }

    const shimDir = path.join(routerDir, "internal");
    const shimFile = path.join(shimDir, "routing.js");

    if (fs.existsSync(shimFile)) {
        continue;
    }

    fs.mkdirSync(shimDir, { recursive: true });
    fs.writeFileSync(shimFile, content);
    patched += 1;
    console.log(`[postinstall] Patched expo-router/internal/routing shim in ${path.relative(path.join(__dirname, ".."), routerDir)}`);
}

if (patched === 0) {
    console.log("[postinstall] No Expo Router v5 installs needed patching");
}
