/** GET 검색만 — 엔터/버튼 제출 시에만 (자동 검색 없음) */

export default function CommunityBoardSearchForm({
  actionPath,
  inputId,
  defaultQuery,
}: {
  actionPath: string;
  inputId: string;
  defaultQuery: string;
}) {
  return (
    <form className="ui-community-search" method="get" action={actionPath} role="search">
      <label className="ui-community-search-label v3-muted" htmlFor={inputId}>
        제목 검색
      </label>
      <div className="ui-community-search-row">
        <input
          id={inputId}
          className="ui-community-search-input"
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="검색어"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" className="ui-community-search-btn v3-btn">
          검색
        </button>
      </div>
    </form>
  );
}
