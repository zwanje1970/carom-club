/** KST 기준 YYYY-MM-DD (대시보드·일정 필터용) */
export function getKstYmd(d: Date): string {
  return d
    .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
    .slice(0, 10);
}
