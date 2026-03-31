/**
 * Windows에서 `prisma generate` 시 query_engine DLL rename EPERM이 나는 경우,
 * 기존 엔진 바이너리를 먼저 제거해 rename 충돌을 줄인다.
 * next dev / next start 가 같은 DLL을 잡고 있으면 여전히 실패할 수 있으므로 빌드 전 프로세스 종료가 필요하다.
 */
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const candidates = [
  join(root, "generated", "prisma", "query_engine-windows.dll.node"),
  join(root, "generated", "prisma", "query_engine-windows.dll.node.tmp"),
];

for (const p of candidates) {
  try {
    if (existsSync(p)) unlinkSync(p);
  } catch {
    /* 잠금 중이면 generate 단계에서 재시도 */
  }
}
