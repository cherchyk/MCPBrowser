import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import os from "os";

const chromeEnv = process.env.CHROME_PATH;
const defaultPaths = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

const chromePath = chromeEnv || defaultPaths.find((p) => p && p.length && existsSync(p));

if (!chromePath) {
  console.error("Chrome/Edge not found. Set CHROME_PATH env to your browser executable.");
  process.exit(1);
}

const userDataDir = process.env.CHROME_USER_DATA_DIR || path.join(os.homedir(), "AppData/Local/ChromeAuthProfile");
const remotePort = process.env.CHROME_REMOTE_DEBUG_PORT || "9222";

const args = [
  `--remote-debugging-port=${remotePort}`,
  `--user-data-dir=${userDataDir}`,
];

console.log("Launching Chrome with:");
console.log(`  exe: ${chromePath}`);
console.log(`  user-data-dir: ${userDataDir}`);
console.log(`  remote-debugging-port: ${remotePort}`);

const child = spawn(chromePath, args, {
  detached: true,
  stdio: "ignore",
});

child.unref();
