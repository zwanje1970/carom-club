/** 전역 로딩: 페이지 이동 시 전체 리로드처럼 보이지 않도록 스켈레톤 표시 */
export default function GlobalLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-site-bg" aria-busy="true" aria-label="로딩 중">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-site-primary border-t-transparent" />
        <span className="text-sm text-site-text-muted">불러오는 중…</span>
      </div>
    </div>
  );
}
