import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const onboardingDir = path.join(root, "src", "app", "onboarding");
const files = [
  "domain/page.tsx",
  "duration/page.tsx",
  "extension/page.tsx",
].map((file) => path.join(onboardingDir, file));

const violations = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);

  if (/key=\{(?:t\(|i18n\.language|language)\}/.test(source)) {
    violations.push(`${relative}: language/translation used as React key`);
  }

  if (/id:\s*t\(/.test(source)) {
    violations.push(`${relative}: translated text used as onboarding id`);
  }

  if (/useEffect[\s\S]*i18n\.language/.test(source) || /useEffect[\s\S]*language/.test(source)) {
    violations.push(`${relative}: language referenced in onboarding effect`);
  }
}

if (violations.length) {
  console.error("[i18n] Onboarding state guard failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("[i18n] Onboarding language switch guard passed.");
