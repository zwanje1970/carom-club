import Link from "next/link";
import TournamentsListBackLink from "../TournamentsListBackLink";
import SiteOutlineDocumentCard from "../../components/SiteOutlineDocumentCard";
import AccountNumberCopyInline from "./account-number-copy-inline";
import { formatTournamentScheduleLabel } from "../../../../lib/tournament-schedule";
import { resolveSitePosterDisplayUrl } from "../../../../lib/site-poster-urls";
import type { Tournament, TournamentDivisionRuleRow } from "../../../../lib/types/entities";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import { buildSiteVenueDetailPath } from "../../../../lib/site-venues-catalog";
import type { TournamentDivisionMetricType, TournamentEntryQualificationType } from "../../../../lib/tournament-rule-types";
import SiteTournamentBracketEmbedDynamic from "./site-tournament-bracket-embed-dynamic";
import SiteTournamentDetailResultsEmbedDynamic from "./site-tournament-detail-results-embed-dynamic";

type Props = {
  tournament: Tournament;
  /** 참가신청 링크(사이트·클라이언트 대회 상세 공통, 없으면 버튼 미표시) */
  applyHref?: string;
  listBackHref: string;
  /** client: 요강 보기는 /client 경로만 사용 (사이트 공개 URL로 이동하는 버튼 없음) */
  audience?: "site" | "client";
  /** outlinePdfUrl이 API 문서 URL일 때 자산 메타 기준 */
  outlinePdfFileKind?: "pdf" | "docx";
  /** `site`: 공개 대회 상세 전용 레이아웃 — 미지정·`legacy`면 기존 클라이언트와 동일 UI */
  detailLayout?: "legacy" | "site";
  /** 마감·진행중일 때 공개 대진표 임베드(클라이언트 동적 로드) */
  showLiveBracketEmbed?: boolean;
  /** 관리자 승인 확정(APPROVED) 인원 — 공개 상세 페이지 등에서만 전달 (목록·메인에서는 조회하지 않음) */
  confirmedParticipantCount?: number;
  /** `true`면 첫 화면 필수 정보만 우선 표시하고 무거운 부가 섹션은 숨김 */
  deferHeavy?: boolean;
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

type DetailHeroCta = { kind: "link"; label: string; href: string } | { kind: "closed-note" };

function resolveDetailHeroCta(params: {
  statusBadge: string;
  tournamentId: string;
  applyHref?: string;
  audience: "site" | "client";
}): DetailHeroCta | null {
  const badge = params.statusBadge.trim();
  const base =
    params.audience === "client"
      ? `/client/tournaments/${encodeURIComponent(params.tournamentId)}`
      : `/site/tournaments/${encodeURIComponent(params.tournamentId)}`;

  if ((badge === "모집중" || badge === "마감임박") && params.applyHref) {
    return { kind: "link", label: "참가신청", href: params.applyHref };
  }
  if (badge === "진행중") {
    return { kind: "link", label: "대회현황", href: `${base}#tournament-live-status` };
  }
  if (badge === "종료") {
    return { kind: "link", label: "대회결과", href: `${base}#tournament-results` };
  }
  if (params.applyHref && badge === "마감") {
    return { kind: "closed-note" };
  }
  return null;
}

function DetailHeroCtaBlock({ cta }: { cta: DetailHeroCta }) {
  if (cta.kind === "closed-note") {
    return (
      <p className="site-detail-body-text site-tournament-detail-apply-closed-note">신청이 마감된 대회입니다.</p>
    );
  }
  return (
    <Link prefetch={false} className="primary-button primary-button--block site-tournament-detail-apply-cta" href={cta.href}>
      {cta.label}
    </Link>
  );
}

function tournamentStatusBadgeClassName(statusBadge: string): string {
  const s = statusBadge.trim();
  if (s === "모집중") return "badge-status";
  if (s === "마감임박") return "site-board-status-badge site-board-status-badge--urgent";
  if (s === "마감") return "site-board-status-badge site-board-status-badge--closed";
  if (s === "진행중") return "site-board-status-badge site-board-status-badge--live";
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
  showLiveBracketEmbed = false,
  confirmedParticipantCount,
  deferHeavy = false,
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

  const heroCta = resolveDetailHeroCta({
    statusBadge: tournament.statusBadge,
    tournamentId: tournament.id,
    applyHref,
    audience,
  });

  if (detailLayout === "site") {
    const firstExtraHead =
      hasExtraVenues && tournament.extraVenues?.length
        ? String(
            [tournament.extraVenues![0]!.name, tournament.extraVenues![0]!.address].find((x) => String(x ?? "").trim()) ??
              "",
          ).trim() || null
        : null;
    const scheduleMetaLine = scheduleLabel.trim()
      ? scheduleLabel.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim()
      : "";
    const venueHeroLine = mainLocationLines[0]?.trim() || firstExtraHead?.trim() || "";
    const statusClass = tournamentStatusBadgeClassName(tournament.statusBadge);
    const recruitmentParts: string[] = [`정원 ${tournament.maxParticipants ?? 24}명`];
    if (!deferHeavy && typeof confirmedParticipantCount === "number") {
      recruitmentParts.push(`확정 ${confirmedParticipantCount}명`);
    }

    return (
      <div className="site-detail-page-stack site-tournament-detail-site">
        <section className="card-clean site-detail-inner-stack site-tournament-detail-hero">
          <span className={`site-tournament-detail-hero-badge ${statusClass}`}>{tournament.statusBadge}</span>
          <h1 className="site-detail-hero-title">{tournament.title ?? "대회"}</h1>
          {scheduleMetaLine || venueHeroLine ? (
            <div className="site-tournament-detail-hero-meta">
              {scheduleMetaLine ? (
                <p className="site-tournament-detail-hero-meta-line">{scheduleMetaLine}</p>
              ) : null}
              {venueHeroLine ? <p className="site-tournament-detail-hero-meta-line">{venueHeroLine}</p> : null}
            </div>
          ) : null}
          <p className="site-tournament-detail-hero-recruitment">{recruitmentParts.join(" · ")}</p>
          {tournament.summary?.trim() ? <p className="site-detail-hero-summary">{tournament.summary.trim()}</p> : null}
          {posterUrl ? (
            <div className="site-tournament-detail-hero-poster-wrap">
              <img
                className="site-detail-poster site-tournament-detail-hero-poster"
                src={posterUrl}
                alt={`${tournament.title ?? "대회"} 포스터`}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          ) : null}
          {heroCta ? <DetailHeroCtaBlock cta={heroCta} /> : null}
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
            <p className="site-detail-value" style={{ fontVariantNumeric: "tabular-nums" }}>
              {tournament.maxParticipants ?? 24}명
            </p>
            {!deferHeavy && typeof confirmedParticipantCount === "number" ? (
              <>
                <p className="site-detail-label">확정인원</p>
                <p className="site-detail-value" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {confirmedParticipantCount}명
                </p>
              </>
            ) : null}
            <p className="site-detail-label">참가비</p>
            <p className="site-detail-value" style={{ fontVariantNumeric: "tabular-nums" }}>
              {`${tournament.entryFee.toLocaleString("ko-KR")}원`}
            </p>
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

        {!deferHeavy && showDivisionBlock ? (
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

        {!deferHeavy ? (
          <section className="card-clean site-detail-inner-stack">
            <h2 className="site-detail-section-title">요강 · 안내</h2>
            <div className="site-detail-actions-row">
              {hasOutlineData ? (
                outlinePdf ? (
                  <SiteOutlineDocumentCard url={outlinePdf} fileKind={outlinePdfFileKind} caption="요강 보기" />
                ) : (
                  <Link prefetch={false} className="secondary-button" href={`${outlineBasePath}/outline`}>
                    대회요강 보기
                  </Link>
                )
              ) : null}
              {venueHref && audience === "site" ? (
                <Link prefetch={false} className="secondary-button" href={venueHref}>
                  시합장 보기
                </Link>
              ) : null}
              {tournament.statusBadge === "종료" ? (
                <Link
                  prefetch={false}
                  className="secondary-button"
                  href={`${audience === "client" ? "/client" : "/site"}/tournaments/${encodeURIComponent(tournament.id)}/results`}
                >
                  대회결과
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {!deferHeavy && showLiveBracketEmbed ? (
          <section id="tournament-live-status" className="site-tournament-detail-anchor-section">
            <SiteTournamentBracketEmbedDynamic
              tournamentId={tournament.id}
              fastPoll={tournament.statusBadge === "진행중"}
              statusBadge={tournament.statusBadge}
              schedule={{ date: tournament.date, eventDates: tournament.eventDates }}
            />
          </section>
        ) : null}

        {!deferHeavy && tournament.statusBadge === "종료" ? (
          <section
            id="tournament-results"
            className="card-clean site-detail-inner-stack site-tournament-detail-anchor-section"
          >
            <SiteTournamentDetailResultsEmbedDynamic tournamentId={tournament.id} />
          </section>
        ) : null}

        <div className="site-detail-actions-row">
          <TournamentsListBackLink className="secondary-button" href={listBackHref} style={{ flex: "1 1 100%", maxWidth: "100%" }}>
            목록으로
          </TournamentsListBackLink>
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
        {heroCta ? (
          heroCta.kind === "closed-note" ? (
            <p className="v3-muted" style={{ margin: 0 }}>
              신청이 마감된 대회입니다.
            </p>
          ) : (
            <Link prefetch={false} className="v3-btn" href={heroCta.href} style={{ padding: "0.5rem 0.9rem" }}>
              {heroCta.label}
            </Link>
          )
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
        <p style={{ margin: 0, fontVariantNumeric: "tabular-nums", wordBreak: "keep-all" }}>
          <span style={{ fontWeight: 600 }}>모집인원</span> {tournament.maxParticipants ?? 24}명
        </p>
        {!deferHeavy && typeof confirmedParticipantCount === "number" ? (
          <p style={{ margin: "0.35rem 0 0", fontVariantNumeric: "tabular-nums", wordBreak: "keep-all" }}>
            <span style={{ fontWeight: 600 }}>확정인원</span> {confirmedParticipantCount}명
          </p>
        ) : null}
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

      {!deferHeavy && showDivisionBlock ? (
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

      {!deferHeavy ? (
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
                  prefetch={false}
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
                prefetch={false}
                className="v3-btn"
                href={venueHref}
                style={{ padding: "0.55rem 1rem", fontWeight: 600, display: "inline-flex" }}
              >
                시합장 보기
              </Link>
            ) : null}
            {tournament.statusBadge === "종료" ? (
              <Link
                prefetch={false}
                className="v3-btn"
                href={`${audience === "client" ? "/client" : "/site"}/tournaments/${encodeURIComponent(tournament.id)}/results`}
                style={{ padding: "0.55rem 1rem", fontWeight: 600, display: "inline-flex" }}
              >
                대회결과
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="v3-row">
        <TournamentsListBackLink className="v3-btn" href={listBackHref}>
          목록으로
        </TournamentsListBackLink>
      </div>
    </>
  );
}
