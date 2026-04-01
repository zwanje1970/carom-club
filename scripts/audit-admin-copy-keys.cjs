/**
 * One-off: substring scan — keys with no literal match outside lib/admin-copy.ts.
 * Many keys are built dynamically (`admin.venues.type.${type}` 등) → 결과에 FALSE POSITIVES.
 * Do not use output as “delete list” without manual review.
 * Run: node scripts/audit-admin-copy-keys.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const copyPath = path.join(root, "lib", "admin-copy.ts");
const text = fs.readFileSync(copyPath, "utf8");
const keys = [...text.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
const uniq = [...new Set(keys)];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
      walk(p, out);
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      out.push(p);
    }
  }
  return out;
}

const dirs = ["app", "components", "lib", "hooks", "scripts"];
const files = dirs.flatMap((d) => walk(path.join(root, d)));

const unused = [];
for (const k of uniq) {
  let found = false;
  for (const f of files) {
    if (f.replace(/\\/g, "/").endsWith("lib/admin-copy.ts")) continue;
    const t = fs.readFileSync(f, "utf8");
    if (t.includes(k)) {
      found = true;
      break;
    }
  }
  if (!found) unused.push(k);
}

console.log("TOTAL_KEYS", uniq.length);
console.log("UNUSED_OUTSIDE_admin-copy.ts", unused.length);
for (const k of unused.sort()) console.log(k);
