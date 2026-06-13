const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const exclusionList = require("metro-config/private/defaults/exclusionList").default;

// 3. Exclude the root's duplicates to avoid Metro's duplicate dependencies error
config.resolver.blockList = exclusionList([
  new RegExp(`^${escapePath(path.join(workspaceRoot, "node_modules", "react"))}\\/.*$`),
  new RegExp(`^${escapePath(path.join(workspaceRoot, "node_modules", "react-dom"))}\\/.*$`),
  new RegExp(`^${escapePath(path.join(workspaceRoot, "node_modules", "react-native-safe-area-context"))}\\/.*$`),
  new RegExp(`^${escapePath(path.join(workspaceRoot, "node_modules", "@expo", "log-box"))}\\/.*$`),
]);



function escapePath(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Use NativeWind
module.exports = withNativeWind(config, { input: "./global.css" });
