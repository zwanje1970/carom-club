import Link from "next/link";
import { listApprovedClientOrganizations } from "../../../../../lib/surface-read";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) return v[0] ?? null;
  return null;
}

export default async function PlatformClientsListPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = searchParams ? await searchParams : {};
  const statusRaw = firstValue(sp.status);
  const typeRaw = firstValue(sp.type);
  const status = statusRaw === "ACTIVE" || statusRaw === "SUSPENDED" || statusRaw === "EXPELLED" ? statusRaw : "all";
  const type = typeRaw === "GENERAL" || typeRaw === "REGISTERED" ? typeRaw : "all";
  const rows = await listApprovedClientOrganizations({
    status,
    clientType: type,
  });

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <form className="v3-box v3-row" style={{ flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
        <label className="v3-stack" style={{ gap: "0.3rem" }}>
          <span style={{ fontWeight: 600 }}>상태</span>
          <select name="status" defaultValue={status} className="v3-input" style={{ padding: "0.45rem 0.5rem" }}>
            <option value="all">전체</option>
            <option value="ACTIVE">정상</option>
            <option value="SUSPENDED">정지</option>
            <option value="EXPELLED">제명</option>
          </select>
        </label>
        <label className="v3-stack" style={{ gap: "0.3rem" }}>
          <span style={{ fontWeight: 600 }}>유형</span>
          <select name="type" defaultValue={type} className="v3-input" style={{ padding: "0.45rem 0.5rem" }}>
            <option value="all">전체</option>
            <option value="GENERAL">일반</option>
            <option value="REGISTERED">연회원</option>
          </select>
        </label>
        <button className="v3-btn" type="submit">
          필터 적용
        </button>
      </form>

      <section className="v3-box v3-stack">
        {rows.length === 0 ? (
          <p className="v3-muted">조건에 맞는 승인 클라이언트가 없습니다.</p>
        ) : (
          <ul className="v3-list">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/platform/operations/clients/${row.id}`} prefetch={false}>
                  {row.name} / 상태:{" "}
                  {row.status === "ACTIVE" ? "정상" : row.status === "SUSPENDED" ? "정지" : "제명"} / 유형:{" "}
                  {row.clientType === "REGISTERED" ? "연회원" : "일반"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
