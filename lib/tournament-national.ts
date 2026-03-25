/**
 * region 텍스트로부터 전국대회 플래그 — DB nationalTournament 컬럼과 동기화할 때 사용.
 */
export function inferNationalTournamentFromRegion(region: string | null | undefined): boolean {
  if (region == null || typeof region !== "string") return false;
  const t = region.trim();
  if (t === "") return false;
  return t === "전국" || t.includes("전국");
}
