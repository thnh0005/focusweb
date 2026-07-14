import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const provider = fs.readFileSync(
  path.join(root, "src", "i18n", "LanguageProvider.tsx"),
  "utf8"
);

const forbidden = [
  "@/stores/session.store",
  "useSessionStore",
  "notifySessionStart",
  "notifySessionEnd",
  "notifySessionPause",
  "notifySessionResume",
  "clearActiveSession",
  "startSession(",
  "endSession(",
];

const failures = forbidden.filter((token) => provider.includes(token));

if (failures.length > 0) {
  console.error("[i18n] Language switch touches session lifecycle:", failures.join(", "));
  process.exit(1);
}

console.log("[i18n] Language switch is isolated from session lifecycle.");
