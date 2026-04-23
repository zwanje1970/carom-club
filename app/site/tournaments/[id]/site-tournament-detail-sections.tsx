import Link from "next/link";
import SiteOutlineDocumentCard from "../../components/SiteOutlineDocumentCard";
import AccountNumberCopyInline from "./account-number-copy-inline";
import {
  formatTournamentScheduleLabel,
  resolveSitePosterDisplayUrl,
  type Tournament,
  type TournamentDivisionRuleRow,
} from "../../../../lib/server/dev-store";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import { buildSiteVenueDetailPath } from "../../../../lib/site-venues-catalog";
import type { TournamentDivisionMetricType, TournamentEntryQualificationType } from "../../../../lib/tournament-rule-types";

type Props = {
  tournament: Tournament;
  /** 사이트 전용(참가신청). 클라이언트 대시보드 audience에서는 생략 */
  applyHref?: string;
  listBackHref: string;
  /** client: 요강 보기는 /client 경로만 사용 (사이트 공개 URL로 이동하는 버튼 없음) */
  audience?: "site" | "client";
  /** outlinePdfUrl이 API 문서 URL일 때 자산 메타 기준 */
  outlinePdfFileKind?: "pdf" | "docx";
  /** `site`: 공개 대회 상세 전용 레이아웃 — 미지정·`legacy`면 기존 클라이언트와 동일 UI */
  detailLayout?: "legacy" | "site";
};

/** 일반 참가자격: [기준유형] [기준값] [이하/미만] — 부자동배정과 분리 */
function eligibilityOneLine(rule: Tournament["rule"]): string | null {
  const eq = rule.entryQualificationType as TournamentEntryQualificationType;
  if (eq === "NONE") return null;
  const v = rule.eligibilityValue;
  if (v == null || !Number.isFinite(Number(v))) return null;
  const typeLabel = eq === "SCORE" ? "점수기준" : eq === "EVER" ? "에버기준" : eq === "BOTH" ? "BOTH" : eq;
  const cmp = rule.eligibilityCompare === "LT" ? "미만" : "이하";
  return `${typeLabel} ${v} ${cmp}`;
}

function divisionMetricLabel(metric: TournamentDivisionMetricType): "점수기준" | "에버기준" {
  return metric === "SCORE" ? "점수기준" : "에버기준";
}

/** 부자동배정: [부이름] [MIN]~[MAX] — 저장 순서 유지, 값만 문자열로 */
function formatDivisionRowLine(row: TournamentDivisionRuleRow): string {
  const min = row.min != null && Number.isFinite(row.min) ? String(row.min) : "";
  const max = row.max != null && Number.isFinite(row.max) ? String(row.max) : "";
  return `${row.name} ${min}~${max}`;
}

function tournamentLocationLines(location: string | null | undefined): string[] {
  const t = (location ?? "").trim();
  if (!t) return [];
  return t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}

/** prizeInfo 저장값(숫자만) 표시 시에만 "만원" 접미사 — 기존 비숫자·만원 포함 문자열은 그대로 */
function formatPrizeInfoLineForDisplay(line: string): string {
  const trimmed = line.trim();
  const m = trimmed.match(/^(우승|준우승|3위):\s*(.+)$/);
  if (!m) return line;
  const val = m[2].trim();
  if (/^\d+$/.test(val)) {
    return `${m[1]}: ${val}만원`;
  }
  return line;
}

function formatPrizeInfoForDisplay(prizeInfo: string): string {
  return prizeInfo.split("\n").map(formatPrizeInfoLineForDisplay).join("\n");
}

function tournamentStatusBadgeClassName(statusBadge: string): string {
  const s = statusBadge.trim();
  if (s === "모집중") return "badge-status";
  if (s === "마감임박") return "site-board-status-badge site-board-status-badge--urgent";
  if (s === "마감") return "site-board-status-badge site-board-status-badge--closed";
  if (s === "종료") return "site-board-status-badge site-board-status-badge--ended";
  return "site-board-status-badge site-board-status-badge--muted";
}

function BasicInfoDivider() {
  return (
    <hr
      style={{
        border: 0,
        borderTop: "1px dashed #cbd5e1",
        margin: "0.65rem 0",
      }}
    />
  );
}

export default function SiteTournamentDetailSections({
  tournament,
  applyHref,
  listBackHref,
  audience = "site",
  outlinePdfFileKind = "pdf",
  detailLayout = "legacy",
}: Props) {
  const posterUrl = resolveSitePosterDisplayUrl(tournament.posterImageUrl ?? null);
  const scheduleLabel = formatTournamentScheduleLabel(tournament);
  const eligibilityLine = eligibilityOneLine(tournament.rule);
  const rule = tournament.rule;
  const showDivisionBlock =
    rule.divisionEnabled === true &&
    Array.isArray(rule.divisionRulesJson) &&
    rule.divisionRulesJson.length > 0;

  const outlinePdf = tournament.outlinePdfUrl?.trim();
  const outlineImg = tournament.outlineImageUrl?.trim();
  const outlineHtmlRaw = tournament.outlineHtml ?? "";
  const hasOutlineText = outlineHtmlRaw.trim() !== "" && !isEmptyOutlineHtml(outlineHtmlRaw);
  const hasOutlineData = Boolean(outlinePdf || outlineImg || hasOutlineText);

  const venueHref = tournament.venueGuideVenueId
    ? buildSiteVenueDetailPath(tournament.venueGuideVenueId)
    : null;

  const outlineBasePath =
    audience === "client" ? `/client/tournaments/${tournament.id}` : `/site/tournaments/${tournament.id}`;

  const mainLocationLines = tournamentLocationLines(tournament.location);
  const hasExtraVenues = Boolean(tournament.extraVenues && tournament.extraVenues.length > 0);
  const hasLocationBlock = mainLocationLines.length > 0 || hasExtraVenues;

  if (detailLayout === "site") {
    const firstExtraHead =
      hasExtraVenues && tournament.extraVenues?.length
        ? String(
            [tournament.extraVenues![0]!.name, tournament.extraVenues![0]!.address].find((x) => String(x ?? "").trim()) ??
              "",
          ).trim() || null
        : null;
    const heroLineParts: string[] = [];
    if (scheduleLabel.trim()) {
      heroLineParts.push(scheduleLabel.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim());
    }
    if (mainLocationLines[0]) heroLineParts.push(mainLocationLines[0]);
    else if (firstExtraHead) heroLineParts.push(firstExtraHead);
    const heroLine = heroLineParts.join(" · ");
    const statusClass = tournamentStatusBadgeClassName(tournament.statusBadge);

    return (
      <div className="site-detail-page-stack">
        <section className="card-clean site-detail-inner-stack">
          {posterUrl ? (
            <div>
              <img
                className="site-detail-poster"
                src={posterUrl}
                alt={`${tournament.title ?? "대회"} 포스터`}
                loading="lazy"
              />
            </div>
          ) : null}
          <h1 className="site-detail-hero-title">{tournament.title ?? "대회"}</h1>
          {heroLine ? <p className="site-detail-hero-meta">{heroLine}</p> : null}
          <span className={statusClass}>{tournament.statusBadge}</span>
          {tournament.summary?.trim() ? <p className="site-detail-hero-summary">{tournament.summary.trim()}</p> : null}
          {audience === "site" && applyHref ? (
            <Link className="primary-button primary-button--block" href={applyHref}>
              참가신청
            </Link>
          ) : null}
        </section>

        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-detail-section-title">기본 정보</h2>
          <div className="site-detail-info-grid">
            {scheduleLabel ? (
              <>
                <p className="site-detail-label">대회일</p>
                <p className="site-detail-value site-detail-span-cols">{scheduleLabel}</p>
              </>
            ) : null}
            {hasLocationBlock ? (
              <>
                <p className="site-detail-label">장소</p>
                <div className="site-detail-value site-detail-span-cols">
                  {mainLocationLines.map((line, i) => (
                    <p key={`main-${i}`} style={{ margin: i === 0 ? 0 : "0.35rem 0 0" }}>
                      {line}
                    </p>
                  ))}
                  {tournament.extraVenues?.map((v, i) => (
                    <div key={i} className="site-detail-inner-stack" style={{ gap: "0.2rem", marginTop: "0.5rem" }}>
                      {[v.name, v.address, v.phone].filter(Boolean).map((line, j) => (
                        <p key={j} style={{ margin: 0 }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {eligibilityLine ? (
              <>
                <p className="site-detail-label">참가자격</p>
                <p className="site-detail-value site-detail-span-cols">{eligibilityLine}</p>
              </>
            ) : null}
            <p className="site-detail-label">모집인원</p>
            <p className="site-detail-value">{tournament.maxParticipants ?? 24}명</p>
            <p className="site-detail-label">참가비</p>
            <p className="site-detail-value">{`${tournament.entryFee.toLocaleString("ko-KR")}원`}</p>
          </div>
          {tournament.prizeInfo ? (
            <div className="site-detail-inner-stack" style={{ gap: "0.35rem", marginTop: "0.35rem" }}>
              <p className="site-detail-label" style={{ paddingTop: 0 }}>
                상금
              </p>
              <p className="site-detail-value" style={{ margin: 0 }}>
                {formatPrizeInfoForDisplay(tournament.prizeInfo)}
              </p>
            </div>
          ) : null}
          {tournament.rule.accountNumber?.trim() ? (
            <div style={{ marginTop: "0.35rem" }}>
              <AccountNumberCopyInline accountNumber={tournament.rule.accountNumber.trim()} />
            </div>
          ) : null}
        </section>

        {showDivisionBlock ? (
          <section className="card-clean site-detail-inner-stack">
            <h2 className="site-detail-section-title">
              참가조건 (부자동배정 · {divisionMetricLabel(rule.divisionMetricType)})
            </h2>
            <div className="site-detail-inner-stack" style={{ gap: "0.4rem" }}>
              {rule.divisionRulesJson!.map((row, i) => (
                <p key={i} className="site-detail-body-text" style={{ margin: 0 }}>
                  {formatDivisionRowLine(row)}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-detail-section-title">요강 · 안내</h2>
          <div className="site-detail-actions-row">
            {hasOutlineData ? (
              outlinePdf ? (
                <SiteOutlineDocumentCard url={outlinePdf} fileKind={outlinePdfFileKind} caption="요강 보기" />
              ) : (
                <Link className="secondary-button" href={`${outlineBasePath}/outline`}>
                  대회요강 보기
                </Link>
              )
            ) : null}
            {venueHref && audience === "site" ? (
              <Link className="secondary-button" href={venueHref}>
                시합장 보기
              </Link>
            ) : null}
          </div>
        </section>

        <div className="site-detail-actions-row">
          <Link className="secondary-button" href={listBackHref} style={{ flex: "1 1 100%", maxWidth: "100%" }}>
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="v3-box v3-stack">
        {posterUrl ? (
          <div style={{ marginBottom: "0.75rem" }}>
            <img
              src={posterUrl}
              alt={`${tournament.title ?? "대회"} 포스터`}
              loading="lazy"
              style={{
                width: "320px",
                maxWidth: "100%",
                height: "auto",
                display: "block",
                borderRadius: "0.35rem",
              }}
            />
          </div>
        ) : null}
        <h1 className="v3-h1" style={{ marginBottom: 0 }}>
          {tournament.title ?? "대회"}
        </h1>
        {tournament.summary ? (
          <p style={{ whiteSpace: "pre-wrap", marginTop: "0.5rem" }}>{tournament.summary}</p>
        ) : null}
        {audience === "site" && applyHref ? (
          <Link className="v3-btn" href={applyHref} style={{ padding: "0.5rem 0.9rem" }}>
            참가신청
          </Link>
        ) : null}
      </section>

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">기본 정보</h2>
        {scheduleLabel ? (
          <>
            <p style={{ margin: 0, fontWeight: 600 }}>대회일</p>
            <p style={{ margin: "0.15rem 0 0.65rem", whiteSpace: "pre-wrap" }}>{scheduleLabel}</p>
          </>
        ) : null}
        {hasLocationBlock ? (
          <>
            {scheduleLabel ? <BasicInfoDivider /> : null}
            <p style={{ margin: 0, fontWeight: 600 }}>장소</p>
            <div className="v3-stack" style={{ margin: "0.15rem 0 0.65rem", gap: "0.2rem" }}>
              {mainLocationLines.map((line, i) => (
                <p key={`main-${i}`} style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {line}
                </p>
              ))}
              {tournament.extraVenues?.map((v, i) => (
                <div key={i} className="v3-stack" style={{ gap: "0.15rem", marginTop: i === 0 && mainLocationLines.length === 0 ? 0 : "0.5rem" }}>
                  {[v.name, v.address, v.phone].filter(Boolean).map((line, j) => (
                    <p key={j} style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : null}
        {eligibilityLine ? (
          <>
            {scheduleLabel || hasLocationBlock ? <BasicInfoDivider /> : null}
            <h2 className="v3-h2">참가자격</h2>
            <p style={{ margin: 0 }}>{eligibilityLine}</p>
          </>
        ) : null}
        {scheduleLabel || hasLocationBlock || eligibilityLine ? <BasicInfoDivider /> : null}
        <p style={{ margin: 0 }}>
          <span style={{ fontWeight: 600 }}>모집인원</span> {tournament.maxParticipants ?? 24}명
        </p>
        {tournament.prizeInfo ? (
          <>
            <BasicInfoDivider />
            <p style={{ margin: 0, fontWeight: 600 }}>상금</p>
            <p style={{ margin: "0.15rem 0 0", whiteSpace: "pre-wrap" }}>
              {formatPrizeInfoForDisplay(tournament.prizeInfo)}
            </p>
          </>
        ) : null}
        <BasicInfoDivider />
        <p style={{ margin: 0 }}>
          <span style={{ fontWeight: 600 }}>참가비</span> {`${tournament.entryFee.toLocaleString("ko-KR")}원`}
        </p>
        {tournament.rule.accountNumber?.trim() ? (
          <div style={{ marginTop: "0.35rem" }}>
            <AccountNumberCopyInline accountNumber={tournament.rule.accountNumber.trim()} />
          </div>
        ) : null}
      </section>

      {showDivisionBlock ? (
        <section className="v3-box v3-stack">
          <h2 className="v3-h2">
            참가조건(부자동배정 : {divisionMetricLabel(rule.divisionMetricType)})
          </h2>
          <div className="v3-stack" style={{ gap: "0.35rem" }}>
            {rule.divisionRulesJson!.map((row, i) => (
              <p key={i} style={{ margin: 0 }}>
                {formatDivisionRowLine(row)}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="v3-box v3-stack">
        <div
          className="v3-row"
          style={{
            flexWrap: "wrap",
            gap: "0.65rem",
            alignItems: "center",
          }}
        >
          {hasOutlineData ? (
            outlinePdf ? (
              <SiteOutlineDocumentCard url={outlinePdf} fileKind={outlinePdfFileKind} caption="요강 보기" />
            ) : (
              <Link
                className="v3-btn"
                href={`${outlineBasePath}/outline`}
                style={{ padding: "0.55rem 1rem", fontWeight: 600, display: "inline-flex" }}
              >
                대회요강 보기
              </Link>
            )
          ) : null}
          {venueHref && audience === "site" ? (
            <Link
              className="v3-btn"
              href={venueHref}
              style={{ padding: "0.55rem 1rem", fontWeight: 600, display: "inline-flex" }}
            >
              시합장 보기
            </Link>
          ) : null}
        </div>
      </section>

      <div className="v3-row">
        <Link className="v3-btn" href={listBackHref}>
          목록으로
        </Link>
      </div>
    </>
  );
}
