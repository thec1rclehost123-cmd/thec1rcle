const fs = require("fs");
const path = require("path");

/**
 * React 18 (web apps) vs React 19 (mobile) version conflict prevents npm from
 * hoisting expo, expo-router, and react-native to root. However, root-level
 * @expo/cli and @expo/metro-config need to find them. Create symlinks so they
 * can. These are safe because nothing else at root depends on these packages.
 */
const rootNodeModules = path.join(__dirname, "..", "node_modules");
const mobileNodeModules = path.join(__dirname, "..", "apps", "mobile-app", "node_modules");

const MOBILE_SYMLINKS = ["expo", "expo-router", "react-native"];

for (const pkg of MOBILE_SYMLINKS) {
    const target = path.join(mobileNodeModules, pkg);
    const linkPath = path.join(rootNodeModules, pkg);

    if (!fs.existsSync(target)) continue; // mobile-app not installed yet
    if (fs.existsSync(linkPath)) {
        // Skip if it's already the correct symlink or a real directory installed by npm
        const stat = fs.lstatSync(linkPath);
        if (stat.isSymbolicLink()) continue; // already symlinked, leave it
        // Real directory — npm installed it; don't overwrite
        continue;
    }

    try {
        fs.symlinkSync(target, linkPath, "junction");
        console.log(`[postinstall] Symlinked ${pkg} → apps/mobile-app/node_modules/${pkg}`);
    } catch (e) {
        // Non-fatal: symlink may already exist in a different form
        console.warn(`[postinstall] Could not symlink ${pkg}: ${e.message}`);
    }
}

/**
 * Patch expo-router installs that are missing the internal/ shims required by
 * @expo/router-server for TypeScript typed route generation.
 *
 * v5: only routing.js was missing (testing.js shipped natively).
 * v6: both routing.js and testing.js are missing (moved to build/testing-library/).
 *
 * The root-level @expo/router-server is pinned and expects these files; since
 * expo-router is kept in apps/mobile-app/node_modules (React 19 vs 18 conflict),
 * the symlink at node_modules/expo-router also needs these shims.
 */

const V5_ROUTING_SHIM = `"use strict";
const core = require("../build/getRoutesCore.js");
module.exports = { ...core, getRoutesCore: core.getRoutes };
`;

const V6_ROUTING_SHIM = `"use strict";
const core = require("../build/getRoutesCore.js");
const matchers = require("../build/matchers.js");
module.exports = {
  ...core,
  getRoutes: core.getRoutes,
  removeSupportedExtensions: matchers.removeSupportedExtensions,
  isTypedRoute: matchers.isTypedRoute,
};
`;

const V6_TESTING_SHIM = `"use strict";
const stubs = require("../build/testing-library/context-stubs.js");
module.exports = {
  requireContext: stubs.requireContext,
  inMemoryContext: stubs.inMemoryContext,
};
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
    const shimDir = path.join(routerDir, "internal");

    if (major === 5) {
        const shimFile = path.join(shimDir, "routing.js");
        if (fs.existsSync(shimFile)) continue;
        fs.mkdirSync(shimDir, { recursive: true });
        fs.writeFileSync(shimFile, V5_ROUTING_SHIM);
        patched += 1;
        console.log(`[postinstall] Patched expo-router v5 internal/routing in ${path.relative(path.join(__dirname, ".."), routerDir)}`);
    } else if (major === 6) {
        let didPatch = false;
        const routingFile = path.join(shimDir, "routing.js");
        const testingFile = path.join(shimDir, "testing.js");
        fs.mkdirSync(shimDir, { recursive: true });
        if (!fs.existsSync(routingFile)) {
            fs.writeFileSync(routingFile, V6_ROUTING_SHIM);
            didPatch = true;
        }
        if (!fs.existsSync(testingFile)) {
            fs.writeFileSync(testingFile, V6_TESTING_SHIM);
            didPatch = true;
        }
        if (didPatch) {
            patched += 1;
            console.log(`[postinstall] Patched expo-router v6 internal/ shims in ${path.relative(path.join(__dirname, ".."), routerDir)}`);
        }
    }
}

if (patched === 0) {
    console.log("[postinstall] No Expo Router installs needed patching");
}
