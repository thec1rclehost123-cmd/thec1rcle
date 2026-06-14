import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

const patterns = [
  {
    regex: /(?:(?:sk|pk)_(?:test|live)_)[a-zA-Z0-9]{10,}/,
    name: "Stripe API Key",
  },
  { regex: /AKIA[0-9A-Z]{16}/, name: "AWS Access Key" },
  {
    regex: /(?:-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/,
    name: "Private Key",
  },
  { regex: /ghp_[a-zA-Z0-9]{36,}/, name: "GitHub Personal Access Token" },
  { regex: /gho_[a-zA-Z0-9]{36,}/, name: "GitHub OAuth Token" },
  { regex: /ghu_[a-zA-Z0-9]{36,}/, name: "GitHub User Token" },
  { regex: /(?:xox[abp]-)[a-zA-Z0-9-]{10,}/, name: "Slack Token" },
  {
    regex: /(?:SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43})/,
    name: "SendGrid API Key",
  },
  { regex: /sk-[a-zA-Z0-9]{20,}/, name: "OpenAI API Key" },
  { regex: /AIza[0-9A-Za-z_-]{35}/, name: "Google API Key" },
  {
    regex: /(?<!URI=)[0-9a-fA-F]{32,}(?:\s|$|")/,
    name: "Possible Secret (32+ hex chars)",
  },
];

const isPinnedGitHubAction = (line) =>
  /uses:\s*[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?@[0-9a-fA-F]{40}\s*$/.test(
    line.trim(),
  );

const stagedFiles = execSync("git diff --cached --name-only", {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

let hasSecrets = false;

for (const file of stagedFiles) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    for (const { regex, name } of patterns) {
      if (name === "Possible Secret (32+ hex chars)" && isPinnedGitHubAction(lines[i])) {
        continue;
      }
      if (regex.test(lines[i])) {
        console.error(`⚠  ${name} detected in ${file}:${i + 1}`);
        hasSecrets = true;
      }
    }
  }
}

if (hasSecrets) {
  console.error("\n❌ Commit blocked: potential secrets found in staged files.");
  console.error("   Remove them before committing, or use .gitignore to exclude the file.");
  process.exit(1);
}

console.log("✓ No secrets detected in staged files");
