import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const localesDir = path.join(root, "src", "i18n", "locales");
const languages = ["en", "vi"];
const namespaces = [
  "common",
  "auth",
  "dashboard",
  "focus",
  "documents",
  "settings",
  "notifications",
  "validation",
];

function readJson(language, namespace) {
  const file = path.join(localesDir, language, `${namespace}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function flattenKeys(value, prefix = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

let hasError = false;

for (const namespace of namespaces) {
  const enKeys = new Set(flattenKeys(readJson("en", namespace)));
  const viKeys = new Set(flattenKeys(readJson("vi", namespace)));

  for (const key of enKeys) {
    if (!viKeys.has(key)) {
      hasError = true;
      console.error(`[i18n] Missing vi key: ${namespace}:${key}`);
    }
  }

  for (const key of viKeys) {
    if (!enKeys.has(key)) {
      hasError = true;
      console.error(`[i18n] Missing en key: ${namespace}:${key}`);
    }
  }
}

for (const language of languages) {
  for (const namespace of namespaces) {
    readJson(language, namespace);
  }
}

if (hasError) {
  process.exit(1);
}

console.log("[i18n] Locale keys match.");
