import Link from "next/link";

const ITEMS: {
  key: string;
  href: string;
  title: string;
  description: string;
}[] = [
  {
    key: "org",
    href: "/client/setup",
    title: "업체설정",
    description: "업체 기본 정보와 운영 설정",
  },
  {
    key: "venue-intro",
    href: "/client/setup/venue-intro",
    title: "당구장 소개",
    description: "회원에게 보여줄 소개 내용 작성",
  },
  {
    key: "inquiries",
    href: "/client/settings/inquiries",
    title: "문의 내역",
    description: "오류 제보·기능 제안 작성 및 내 글·댓글 확인",
  },
  {
    key: "blank-bracket-print",
    href: "/client/settings/blank-bracket-print",
    title: "빈 대진표 출력",
    description: "강수와 스타일을 지정해 인쇄용 대진표 출력",
  },
];

export default function ClientSettingsHubPage() {
  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ gap: "0.85rem" }}>
      <div
        className="v3-row ui-client-dashboard-header"
        style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}
      >
        <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
            부가기능
          </h1>
        </div>
      </div>

      <ul className="v3-stack" style={{ gap: "0.65rem", listStyle: "none", margin: 0, padding: 0, maxWidth: "40rem" }}>
        {ITEMS.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <section
                className="v3-box v3-stack"
                style={{
                  gap: "0.35rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  padding: "0.85rem 1rem",
                  transition: "background 0.12s ease",
                }}
              >
                <h2 className="v3-h2" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.35 }}>
                  {item.title}
                </h2>
                <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.4 }}>
                  {item.description}
                </p>
              </section>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
