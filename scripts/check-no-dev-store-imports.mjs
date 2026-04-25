import { readdir, readFile } from "fs/promises";
import path from "path";

const root = process.cwd();
const targets = ["app", "lib"];
const sourceExt = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
      out.push(...(await walk(full)));
      continue;
    }
    if (sourceExt.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(root, p).replaceAll("\\", "/");
}

async function main() {
  const violations = [];
  for (const target of targets) {
    const abs = path.join(root, target);
    const files = await walk(abs);
    for (const file of files) {
      const relPath = rel(file);
      const content = await readFile(file, "utf8");
      const hasDevStoreInImportPath =
        /from\s+["'][^"']*dev-store[^"']*["']|import\s*\(\s*["'][^"']*dev-store[^"']*["']\s*\)/m.test(content);
      if (hasDevStoreInImportPath) {
        violations.push(`[dev-store import path] ${relPath}`);
      }
      if ((relPath.startsWith("app/api/") || relPath.startsWith("app/") || relPath.startsWith("lib/")) && /\breadStore\s*\(|\bwriteStore\s*\(/m.test(content)) {
        violations.push(`[readStore/writeStore call] ${relPath}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("local-json aggregate / import guard check failed:");
    for (const v of violations) console.error(` - ${v}`);
    process.exit(1);
  }
  console.log("import guard check passed (no dev-store path; no readStore/writeStore).");
}

await main();
