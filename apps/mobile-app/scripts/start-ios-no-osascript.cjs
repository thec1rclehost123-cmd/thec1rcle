#!/usr/bin/env node

 

const { execFile, execFileSync, spawn } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const expoCli = require.resolve("expo/bin/cli");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function getSimulators(mode) {
  const raw = run("xcrun", ["simctl", "list", "devices", mode, "--json"]);
  const devices = JSON.parse(raw).devices || {};
  return Object.values(devices).flat();
}

function ensureBootedSimulator() {
  const booted = getSimulators("booted").find((device) => device.name.includes("iPhone"));
  if (booted) return booted;

  const target = getSimulators("available").find((device) => device.name.includes("iPhone"));
  if (!target) {
    throw new Error("No available iPhone simulator found.");
  }

  try {
    run("xcrun", ["simctl", "boot", target.udid], { stdio: "ignore" });
  } catch (error) {
    const message = String(error.stderr || error.message || "");
    if (!message.includes("Unable to boot device in current state")) throw error;
  }

  run("xcrun", ["simctl", "bootstatus", target.udid, "-b"], { stdio: "ignore" });
  return target;
}

function openSimulatorApp() {
  execFile("open", ["-a", "Simulator"], () => {});
}

const ansiPattern = /\u001b\[[0-9;]*m/g;
let opened = false;

try {
  const simulator = ensureBootedSimulator();
  openSimulatorApp();
  console.log(`[mobile-ios] Using ${simulator.name}`);
} catch (error) {
  console.error(`[mobile-ios] ${error.message}`);
  process.exit(1);
}

const metro = spawn(process.execPath, [expoCli, "start", "--clear", "--offline"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=8192",
  },
  stdio: ["inherit", "pipe", "pipe"],
});

function handleOutput(chunk, stream) {
  const text = chunk.toString();
  stream.write(text);

  if (opened) return;

  const clean = text.replace(ansiPattern, "");
  const expMatch = clean.match(/exp:\/\/[^\s]+/);
  const localMatch = clean.match(/Waiting on http:\/\/localhost:(\d+)/);
  if (!expMatch && !localMatch) return;

  opened = true;
  const url = expMatch
    ? expMatch[0].replace(/[),.;]+$/, "")
    : `exp://127.0.0.1:${localMatch[1]}`;
  execFile("xcrun", ["simctl", "openurl", "booted", url], (error) => {
    if (error) {
      console.error(`[mobile-ios] Failed to open ${url}: ${error.message}`);
      return;
    }
    console.log(`[mobile-ios] Opened ${url} in the booted simulator`);
  });
}

metro.stdout.on("data", (chunk) => handleOutput(chunk, process.stdout));
metro.stderr.on("data", (chunk) => handleOutput(chunk, process.stderr));

metro.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
