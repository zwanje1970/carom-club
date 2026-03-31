/** 클라이언트 대시보드/목록 로딩 스켈레톤 */
export default function ClientLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="h-8 w-56 animate-pulse rounded bg-site-border" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-site-border" />
        ))}
      </div>
    </div>
  );
}
