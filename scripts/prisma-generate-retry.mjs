/**
 * Windows에서 `prisma generate`가 query_engine DLL rename 단계에서 EPERM이 나는 경우:
 * - 보통 `next start` / `next dev`가 `generated/prisma/query_engine-windows.dll.node`를 로드해 잠금.
 * - 각 시도 전에 `prisma-generate-premove.mjs`로 기존 파일 제거를 시도한다.
 *
 * 환경 변수:
 * - SKIP_PRISMA_GENERATE=1 — generate 생략(스키마 변경 없이 빌드만 할 때만 사용).
 * - 인자 `--skip-prisma-generate` — 위와 동일(SKIP 환경변수 없이 npm 스크립트에서 쓰기 위함).
 * - Windows: `generated/prisma` 클라이언트 + query_engine DLL 이 이미 있으면 generate 생략(EPERM 회피). `FORCE_PRISMA_GENERATE=1` 이면 무시하고 실행.
 * - PRISMA_GENERATE_RETRIES — 기본 5
 * - PRISMA_GENERATE_RETRY_MS — 기본 2000
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const premoveScript = join(root, "scripts", "prisma-generate-premove.mjs");

function runPremove() {
  spawnSync(process.execPath, [premoveScript], { cwd: root, stdio: "ignore" });
}

function runGenerate() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const r = spawnSync(npx, ["prisma", "generate"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  const status = typeof r.status === "number" ? r.status : 1;
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { status, out };
}

/** Windows: DLL 잠금으로 generate 가 자주 실패하므로, 이미 유효한 산출물이 있으면 빌드만 진행 */
function win32GeneratedPrismaLooksComplete() {
  if (process.platform !== "win32") return false;
  const gen = join(root, "generated", "prisma");
  const indexJs = join(gen, "index.js");
  if (!existsSync(indexJs)) return false;
  const engine = join(gen, "query_engine-windows.dll.node");
  try {
    return existsSync(engine) && statSync(engine).size > 1_000_000;
  } catch {
    return false;
  }
}

const skipGenerate =
  process.env.SKIP_PRISMA_GENERATE === "1" || process.argv.includes("--skip-prisma-generate");
if (skipGenerate) {
  console.log("[prisma] skipping prisma generate (--skip-prisma-generate or SKIP_PRISMA_GENERATE=1)");
  process.exit(0);
}

if (process.env.FORCE_PRISMA_GENERATE !== "1" && win32GeneratedPrismaLooksComplete()) {
  console.log(
    "[prisma] skipping prisma generate: generated/prisma client and query engine already present (Windows). " +
      "Set FORCE_PRISMA_GENERATE=1 to run generate anyway."
  );
  process.exit(0);
}

const maxAttempts = Math.max(1, Number(process.env.PRISMA_GENERATE_RETRIES || "5"));
const retryMs = Math.max(0, Number(process.env.PRISMA_GENERATE_RETRY_MS || "2000"));

for (let i = 0; i < maxAttempts; i++) {
  runPremove();
  const { status, out } = runGenerate();
  if (status === 0) {
    process.exit(0);
  }
  process.stderr.write(out);
  const eperm = /EPERM|operation not permitted/i.test(out);
  const last = i === maxAttempts - 1;
  if (!last) {
    process.stderr.write(
      `[prisma] generate failed (attempt ${i + 1}/${maxAttempts}).` +
        (retryMs > 0 ? ` Retrying in ${retryMs}ms…` : "") +
        (eperm
          ? " EPERM: stop `next start` / `next dev` (or any Node process using this app) so query_engine-windows.dll.node is not locked.\n"
          : "\n")
    );
    if (retryMs > 0) await delay(retryMs);
  } else {
    process.stderr.write(
      "[prisma] generate failed after all attempts. " +
        "If the error was EPERM: stop the dev server, then run `npx prisma generate` or `npm run build` again. " +
        "On Windows, excluding `generated/prisma` from real-time antivirus scanning can also reduce rename failures.\n"
    );
    process.exit(status || 1);
  }
}
