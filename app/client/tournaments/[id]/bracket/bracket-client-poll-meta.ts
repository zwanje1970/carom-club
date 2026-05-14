/** 클라이언트 대진표 라우트 전용 — 공개 메인 번들에 포함되지 않도록 이 폴더에서만 import */

export type ClientBracketMetaJson = {
  updatedAt: string | null;
  bracketId: string | null;
  error?: string;
};

export async function fetchClientBracketMetaJson(
  tournamentId: string,
  zonesEnabled: boolean,
  zoneId: string,
): Promise<ClientBracketMetaJson> {
  const tid = tournamentId.trim();
  if (!tid) return { updatedAt: null, bracketId: null };
  if (zonesEnabled && !zoneId.trim()) return { updatedAt: null, bracketId: null };
  try {
    const url = zonesEnabled
      ? `/api/client/tournaments/${encodeURIComponent(tid)}/bracket/zones/${encodeURIComponent(zoneId.trim())}?meta=1`
      : `/api/client/tournaments/${encodeURIComponent(tid)}/bracket?meta=1`;
    const response = await fetch(url, { credentials: "same-origin" });
    const result = (await response.json()) as ClientBracketMetaJson & { error?: string };
    if (!response.ok) return { updatedAt: null, bracketId: null, error: result.error };
    return {
      updatedAt: typeof result.updatedAt === "string" && result.updatedAt.trim() !== "" ? result.updatedAt.trim() : null,
      bracketId: typeof result.bracketId === "string" && result.bracketId.trim() !== "" ? result.bracketId.trim() : null,
    };
  } catch {
    return { updatedAt: null, bracketId: null, error: "meta" };
  }
}
