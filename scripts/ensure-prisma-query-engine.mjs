/**
 * Windows: custom output `generated/prisma` 에서 prisma generate 가
 * query_engine-windows.dll.node rename(EPERM) 으로 실패하면 최종 DLL 이 없어
 * next start 시 PrismaClientInitializationError 가 난다.
 * node_modules/prisma 에 포함된 동일 버전 엔진을 복사해 복구한다.
 *
 * 다른 OS 에서는 no-op.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  process.exit(0);
}

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const destDir = join(root, "generated", "prisma");
const dest = join(destDir, "query_engine-windows.dll.node");

function findBundledEngine() {
  const direct = join(root, "node_modules", "prisma", "query_engine-windows.dll.node");
  if (existsSync(direct)) return direct;
  const enginesRoot = join(root, "node_modules", "prisma", "engines");
  if (existsSync(enginesRoot)) {
    for (const name of readdirSync(enginesRoot)) {
      const p = join(enginesRoot, name, "query_engine-windows.dll.node");
      if (existsSync(p)) return p;
    }
  }
  const nested = join(root, "node_modules", "prisma", "node_modules", "@prisma", "engines", "query_engine-windows.dll.node");
  if (existsSync(nested)) return nested;
  const flat = join(root, "node_modules", "@prisma", "engines", "query_engine-windows.dll.node");
  if (existsSync(flat)) return flat;
  return null;
}

function destLooksValid() {
  try {
    return existsSync(dest) && statSync(dest).size > 1_000_000;
  } catch {
    return false;
  }
}

if (destLooksValid()) {
  process.exit(0);
}

const src = findBundledEngine();
if (!src) {
  console.error(
    "[ensure-prisma-query-engine] Could not find query_engine-windows.dll.node under node_modules/prisma. Run npm install. (non-fatal for npm run build)"
  );
  process.exit(0);
}

try {
  mkdirSync(destDir, { recursive: true });

  for (const name of existsSync(destDir) ? readdirSync(destDir) : []) {
    if (name.startsWith("query_engine-windows.dll.node.tmp")) {
      try {
        unlinkSync(join(destDir, name));
      } catch {
        /* may be locked */
      }
    }
  }

  copyFileSync(src, dest);
  console.log("[ensure-prisma-query-engine] Copied query engine to", dest);
} catch (e) {
  console.error("[ensure-prisma-query-engine] Copy failed (non-fatal):", e?.message || e);
}
