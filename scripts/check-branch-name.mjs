import { execSync } from "child_process";

const ALLOWED_BRANCHES = /^(main|staging|testing|develop|master)$/;
const CONVENTIONAL_PREFIX =
  /^(feat|fix|hotfix|bugfix|chore|docs|test|refactor|ci|update|perf|style)(\/[a-zA-Z0-9._-]+)+$/;

const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();

if (!branch) {
  console.log("✓ Not on any branch — skipping branch name check");
  process.exit(0);
}

if (ALLOWED_BRANCHES.test(branch)) {
  console.log(`✓ Protected branch "${branch}" — skipping branch name check`);
  process.exit(0);
}

if (CONVENTIONAL_PREFIX.test(branch)) {
  console.log(`✓ Branch name "${branch}" follows convention`);
  process.exit(0);
}

console.error(`\n❌ Branch name "${branch}" does not follow convention.`);
console.error("   Allowed formats:");
console.error("     feat/description      feat/C1-123-description");
console.error("     fix/description       chore/description");
console.error("     hotfix/description    docs/description");
console.error("     bugfix/description    test/description");
console.error("     refactor/description  ci/description");
console.error("     update/description    perf/description");
console.error("     style/description");
console.error("   Protected branches (exempt): main, staging, testing, develop, master\n");
process.exit(1);
