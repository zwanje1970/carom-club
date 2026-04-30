/** 자동푸시(승인·전날)용 대회명·본문 길이 보조. */

export function truncateTournamentNameForAutoPush(name: string): string {
  const t = (name ?? "").trim();
  if (t.length <= 18) return t;
  return `${t.slice(0, 18)}...`;
}

export function clampAutoPushBody(body: string, maxLen = 60): string {
  const s = (body ?? "").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

export function addDaysYyyyMmDd(ymd: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const utc = Date.UTC(y, mo - 1, d + deltaDays);
  const out = new Date(utc);
  if (Number.isNaN(out.getTime())) return null;
  const yy = out.getUTCFullYear();
  const mm = String(out.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(out.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
