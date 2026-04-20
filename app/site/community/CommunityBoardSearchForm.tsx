/** GET 검색만 — 자동완성·실시간 검색 없음 */

export default function CommunityBoardSearchForm({
  boardType,
  defaultQuery,
}: {
  boardType: string;
  defaultQuery: string;
}) {
  return (
    <form className="ui-community-search" method="get" action={`/site/community/${boardType}`} role="search">
      <label className="ui-community-search-label v3-muted" htmlFor={`community-q-${boardType}`}>
        제목 검색
      </label>
      <div className="ui-community-search-row">
        <input
          id={`community-q-${boardType}`}
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
