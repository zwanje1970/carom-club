import Link from "next/link";

const VENUES = [
  { id: "venue-1", name: "카롬 강남점", region: "서울 강남", type: "클럽형" },
  { id: "venue-2", name: "카롬 서초점", region: "서울 서초", type: "대회협력" },
  { id: "venue-3", name: "카롬 수원점", region: "경기 수원", type: "일반형" },
];

export default function ClientVenuesPage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">당구장 카드 발행</h1>
      <p className="v3-muted">이 화면은 당구장 카드 발행을 위한 최소 진입 화면입니다.</p>
      <p className="v3-muted">현재는 고정된 당구장 목록 기준으로 카드 발행만 지원하며, 당구장 원본 정보 관리는 포함하지 않습니다.</p>
      <section className="v3-box v3-stack">
        <ul className="v3-list">
          {VENUES.map((venue) => (
            <li key={venue.id}>
              <div className="v3-stack" style={{ gap: "0.45rem" }}>
                <strong>{venue.name}</strong>
                <p className="v3-muted" style={{ margin: 0 }}>
                  지역: {venue.region} · 유형: {venue.type}
                </p>
                <div className="v3-row">
                  <Link className="v3-btn" href={`/client/venues/${venue.id}/card-publish`}>
                    게시카드 작성
                  </Link>
                  <Link className="v3-btn" href={`/site/venues/${venue.id}`}>
                    사이트 상세 확인
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
