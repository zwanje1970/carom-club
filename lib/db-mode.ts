/**
 * DB 사용 여부: 환경변수 DATABASE_URL 기준.
 * - DATABASE_URL 이 있으면 → 실제 DB(Neon PostgreSQL 등) 사용
 * - 없으면 → mock/503
 *
 * Neon 사용 시 .env 에 DATABASE_URL, DIRECT_URL 설정.
 */

/** 개발 시에만: 값 존재 여부와 프로토콜/호스트(비밀번호 미노출) 로그 */
function logDatabaseUrlDiagnosticOnce(): void {
  if (process.env.NODE_ENV !== "development") return;
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    console.warn("[db-mode] DATABASE_URL: missing or empty string");
    return;
  }
  const trimmed = raw.trim();
  try {
    const normalized = trimmed.startsWith("prisma://")
      ? `postgresql://${trimmed.slice("prisma://".length)}`
      : trimmed;
    const u = new URL(normalized);
    console.log("[db-mode] DATABASE_URL: present", {
      protocol: u.protocol,
      host: u.hostname,
      pathname: u.pathname || "/",
    });
  } catch {
    console.log("[db-mode] DATABASE_URL: present (unparseable URL, length)", trimmed.length);
  }
}

logDatabaseUrlDiagnosticOnce();

function getEffectiveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (typeof url === "string" && url.trim().length > 0) return url.trim();
  return "";
}

/** 개발 시 DATABASE_URL 없을 때 호출되는 곳에서 안내용 (기본값 주입 없음) */
export function ensureDatabaseUrlForDevelopment(): void {
  if (process.env.NODE_ENV !== "development") return;
  const url = process.env.DATABASE_URL;
  if (typeof url !== "string" || url.trim().length === 0) {
    console.warn(
      "[db-mode] DATABASE_URL이 없습니다. .env에 Neon PostgreSQL DATABASE_URL, DIRECT_URL을 설정한 뒤 npx prisma migrate dev 를 실행하세요."
    );
  }
}

export function isDatabaseConfigured(): boolean {
  return getEffectiveDatabaseUrl().length > 0;
}
