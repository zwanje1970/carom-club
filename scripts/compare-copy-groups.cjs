const fs = require("fs");
const path = require("path");
const t = fs.readFileSync(path.join(__dirname, "../lib/admin-copy.ts"), "utf8");
const def = [...t.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
const uniq = [...new Set(def)];
const gStart = t.indexOf("export const ADMIN_COPY_GROUPS");
const gText = t.slice(gStart);
const inGroup = new Set();
const r = /"([a-zA-Z][a-zA-Z0-9_.]*)"/g;
let m;
while ((m = r.exec(gText)) !== null) {
  const k = m[1];
  if (k.includes(".") && !k.startsWith("http")) inGroup.add(k);
}
const missing = uniq.filter((k) => !inGroup.has(k));
const extra = [...inGroup].filter((k) => !uniq.includes(k));
console.log("DEFAULT keys:", uniq.length);
console.log("Quoted dotted ids in GROUPS block:", inGroup.size);
console.log("In DEFAULT but not referenced in GROUPS array:", missing.length);
if (missing.length) missing.forEach((k) => console.log("  ", k));
console.log("In GROUPS but not in DEFAULT (false positives):", extra.length);
