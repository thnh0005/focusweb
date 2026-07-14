import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const analyticsFiles = [
  "src/app/(app)/analytics/page.tsx",
  "src/components/features/analytics/FocusTrendChart.tsx",
  "src/components/features/analytics/DistractionSourcesChart.tsx",
  "src/components/features/analytics/SessionBreakdownChart.tsx",
  "src/components/features/analytics/TimeHeatmap.tsx",
  "src/components/features/analytics/WeeklyProgressSnapshot.tsx",
].map((file) => path.join(root, file));

const violations = [];

for (const file of analyticsFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);

  if (/queryKey:\s*\[[^\]]*(?:i18n\.language|language|t\()/s.test(source)) {
    violations.push(`${relative}: locale/translation used in analytics queryKey`);
  }

  if (/dataKey=\{?\s*t\(/.test(source)) {
    violations.push(`${relative}: translated text used as chart dataKey`);
  }

  if (/id:\s*t\(/.test(source)) {
    violations.push(`${relative}: translated text used as metric id`);
  }

  if (/(?:en-US|vi-VN)/.test(source)) {
    violations.push(`${relative}: hard-coded locale detected`);
  }
}

if (violations.length) {
  console.error("[i18n] Analytics state guard failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("[i18n] Analytics language switch guard passed.");
