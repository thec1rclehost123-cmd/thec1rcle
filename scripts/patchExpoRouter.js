/**
 * postinstall patch: create expo-router/internal/routing shim
 *
 * @expo/router-server@55 imports from 'expo-router/internal/routing' but
 * expo-router@5 ships those exports in build/getRoutesCore.js with getRoutesCore
 * renamed to getRoutes. This shim bridges the gap.
 */
const fs = require("fs");
const path = require("path");

const shimDir = path.join(__dirname, "..", "node_modules", "expo-router", "internal");
const shimFile = path.join(shimDir, "routing.js");

const content = `"use strict";
const core = require("../build/getRoutesCore.js");
module.exports = { ...core, getRoutesCore: core.getRoutes };
`;

fs.mkdirSync(shimDir, { recursive: true });
fs.writeFileSync(shimFile, content);
console.log("[postinstall] Patched expo-router/internal/routing shim");
