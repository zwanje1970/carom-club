import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import {
  getOutlinePdfAssetById,
  getSiteVenueDetailById,
  outlineFileKindFromAsset,
  outlinePdfIdFromPublicUrl,
} from "../../../../lib/server/dev-store";
import SiteOutlineDocumentCard from "../../components/SiteOutlineDocumentCard";
import SiteShellFrame from "../../components/SiteShellFrame";

export const dynamic = "force-dynamic";

function IconPhone({ className = "site-venue-action-icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3a1 1 0 0 0-1 1v1c0 4.97 4.03 9 9 9h1a1 1 0 0 0 1-1v-1.5a1 1 0 0 0-.8-.98l-2-.4a1 1 0 0 0-1.17.49l-.3.6a7 7 0 0 1-3.12-3.12l.6-.3a1 1 0 0 0 .49-1.17l-.4-2A1 1 0 0 0 9.5 3H8z"
      />
    </svg>
  );
}

function IconDirections() {
  return (
    <svg className="site-venue-action-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10z"
      />
      <circle cx="12" cy="11" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg className="site-venue-kv__icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10z"
      />
      <circle cx="12" cy="11" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="site-venue-kv__icon" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 7v6l3 2" />
    </svg>
  );
}

function IconWon() {
  return (
    <svg className="site-venue-kv__icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M7 10h10M7 14h10M9 6v12M15 6v12"
      />
    </svg>
  );
}

function IconScore() {
  return (
    <svg className="site-venue-kv__icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M7 17V7M12 17v-5M17 17V9"
      />
    </svg>
  );
}

function normalizeExternalUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

type ExternalLinkTone = "naver" | "daum" | "band" | "neutral";

/** URL만으로 배지 + 서비스명 분류 (외부 호출·이미지 없음) */
function classifyExternalLink(raw: string): { badge: string; service: string; tone: ExternalLinkTone } | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const url = normalizeExternalUrl(t);
    const u = new URL(url);
    const h = u.hostname.toLowerCase();

    if (h.includes("cafe.naver.com")) return { badge: "N", service: "카페", tone: "naver" };
    if (h.includes("blog.naver.com")) return { badge: "N", service: "블로그", tone: "naver" };
    if (
      h.includes("map.naver.com") ||
      h === "naver.me" ||
      h.endsWith(".naver.me") ||
      h.includes("place.naver.com") ||
      h.includes("smartplace.naver.com")
    ) {
      return { badge: "N", service: "플레이스", tone: "naver" };
    }
    if (h.includes("band.us")) return { badge: "BAND", service: "", tone: "band" };
    if (h.includes("cafe.daum.net")) return { badge: "다음", service: "카페", tone: "daum" };
    if (h.includes("blog.daum.net")) return { badge: "다음", service: "블로그", tone: "daum" };
    return { badge: "링크", service: "", tone: "neutral" };
  } catch {
    return { badge: "링크", service: "", tone: "neutral" };
  }
}

function externalLinkBadgeStyle(tone: ExternalLinkTone): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "0.72rem",
    lineHeight: 1.2,
    padding: "0.22rem 0.5rem",
    borderRadius: "5px",
    flexShrink: 0,
  };
  if (tone === "naver") return { ...base, background: "#03c75a", color: "#fff" };
  if (tone === "daum") return { ...base, background: "#328fde", color: "#fff", fontSize: "0.68rem", padding: "0.22rem 0.42rem" };
  if (tone === "band") return { ...base, background: "#334155", color: "#fff", fontSize: "0.68rem", letterSpacing: "0.04em", padding: "0.28rem 0.55rem" };
  return { ...base, background: "#64748b", color: "#fff", fontWeight: 600, fontSize: "0.75rem" };
}

function formatFeeAmount(value: string): string {
  const t = value.trim();
  return t.includes("원") ? t : `${t}원`;
}

/** 일반요금 구간: 브랜드(종류)·대수·요금 한 줄 (값 있는 항목만) */
function formatTableFeeCombined(
  label: string,
  kind: string | null,
  count: string | null,
  fee: string | null
): string | null {
  const k = kind?.trim();
  const c = count?.trim();
  const f = fee?.trim();
  if (!c && !f) return null;
  const brandPart = k ? ` (${k})` : "";
  const parts: string[] = [];
  if (c) parts.push(`${label}${brandPart} ${c}대`);
  if (f) parts.push(`요금 ${formatFeeAmount(f)}`);
  return parts.join(" · ");
}

function formatScoreDisplay(raw: string): string {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return withBreaks
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
}

export default async function SiteVenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await getSiteVenueDetailById(id);
  if (!venue) notFound();

  const introPdfId = outlinePdfIdFromPublicUrl(venue.introPdfUrl);
  const introPdfAsset = introPdfId ? await getOutlinePdfAssetById(introPdfId) : null;
  const introPdfFileKind = outlineFileKindFromAsset(introPdfAsset);

  const images = venue.galleryImageUrls;
  const pt = venue.pricingType;
  const showGeneralFees = pt === "GENERAL" || pt === "MIXED";
  const combinedLines = showGeneralFees
    ? (
        [
          formatTableFeeCombined("대대", venue.daedaeKind, venue.daedaeTableCount, venue.daedaeFee),
          formatTableFeeCombined("중대", venue.jungdaeKind, venue.jungdaeTableCount, venue.jungdaeFee),
          formatTableFeeCombined("포켓", venue.pocketKind, venue.pocketTableCount, venue.pocketFee),
        ].filter(Boolean) as string[]
      )
    : [];

  const flatText = venue.flatRateInfo?.trim() ?? "";
  const showFlatFees = (pt === "FLAT" || pt === "MIXED") && flatText.length > 0;

  const scoreText = venue.scoreSystem ? formatScoreDisplay(venue.scoreSystem) : "";

  const introHtmlPlain =
    venue.introDisplayMode === "TEXT" && venue.introHtml && !isEmptyOutlineHtml(venue.introHtml)
      ? htmlToPlainText(venue.introHtml)
      : "";

  const introTextBlocks = [venue.shortDescription?.trim(), venue.description?.trim(), introHtmlPlain].filter(
    (s): s is string => Boolean(s && s.length)
  );

  const showPdf = Boolean(venue.introPdfUrl?.trim());
  const websiteUrl = venue.website ? normalizeExternalUrl(venue.website) : "";
  const showWebsiteBtn = websiteUrl.length > 0;
  const linkParts = venue.website ? classifyExternalLink(venue.website) : null;

  const showIntroSection =
    images.length > 0 || introTextBlocks.length > 0 || showPdf;

  const regionTrim = venue.region?.trim() ?? "";
  const addressTrim = venue.addressLine?.trim() ?? "";
  /** 상단은 짧게: 지역만 또는 주소 앞부분만(지역 없을 때). 전체 주소는 기본 정보 카드 */
  const heroMetaAddressOnly = !regionTrim && Boolean(addressTrim);
  const heroMetaLine = regionTrim
    ? regionTrim
    : addressTrim.length > 30
      ? `${addressTrim.slice(0, 26)}…`
      : addressTrim;
  const telDigits = venue.phone ? venue.phone.replace(/[^\d+]/g, "") : "";
  const telHref = telDigits.length > 0 ? `tel:${telDigits}` : "";

  return (
    <SiteShellFrame brandTitle={<span className="site-home-brand-ellipsis">{venue.name}</span>}>
      <section className="site-site-gray-main v3-stack site-detail-page-stack">
        <section className="card-clean site-detail-inner-stack">
          <h1 className="site-venue-detail-title">{venue.name}</h1>
          {heroMetaLine ? (
            <p
              className={`site-venue-detail-meta${heroMetaAddressOnly ? " site-venue-detail-meta--address-preview" : ""}`}
            >
              {heroMetaLine}
            </p>
          ) : null}
          <div className="site-detail-actions-row">
            {venue.phone && telHref ? (
              <a className="secondary-button site-venue-action-btn" href={telHref}>
                <IconPhone />
                전화
              </a>
            ) : null}
            {venue.naverMapUrl ? (
              <a
                className="secondary-button site-venue-action-btn"
                href={venue.naverMapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconDirections />
                길찾기
              </a>
            ) : null}
          </div>
        </section>

        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-detail-section-title">기본 정보</h2>
          {showWebsiteBtn && linkParts ? (
            <a
              className="secondary-button site-venue-website-btn"
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span style={externalLinkBadgeStyle(linkParts.tone)}>{linkParts.badge}</span>
              {linkParts.service ? (
                <span style={{ fontSize: "0.88rem", fontWeight: 600, whiteSpace: "nowrap" }}>{linkParts.service}</span>
              ) : (
                <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>웹사이트</span>
              )}
            </a>
          ) : null}
          {venue.addressLine ? (
            <div className="site-venue-kv">
              <IconPin />
              <div className="site-venue-kv__body">
                <p className="site-venue-kv__label">주소</p>
                <p className="site-venue-kv__value">{venue.addressLine}</p>
              </div>
            </div>
          ) : null}
          {venue.phone ? (
            <div className="site-venue-kv">
              <IconPhone className="site-venue-kv__icon" />
              <div className="site-venue-kv__body">
                <p className="site-venue-kv__label">전화번호</p>
                <p className="site-venue-kv__value">{venue.phone}</p>
              </div>
            </div>
          ) : null}
          {venue.businessHours ? (
            <div className="site-venue-kv">
              <IconClock />
              <div className="site-venue-kv__body">
                <p className="site-venue-kv__label">영업시간</p>
                <p className="site-venue-kv__value">{venue.businessHours}</p>
              </div>
            </div>
          ) : null}
          {combinedLines.length > 0 ? (
            <div className="site-venue-kv">
              <IconWon />
              <div className="site-venue-kv__body">
                <p className="site-venue-kv__label">요금</p>
                <div className="site-detail-inner-stack" style={{ gap: "0.25rem", marginTop: "0.12rem" }}>
                  {combinedLines.map((line, i) => (
                    <p key={`cf-${i}`} className="site-venue-kv__value" style={{ margin: 0 }}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {showFlatFees ? (
            <div className="site-venue-kv">
              <IconWon />
              <div className="site-venue-kv__body">
                <p className="site-venue-kv__label">정액제 요금</p>
                <p className="site-venue-kv__value">{flatText}</p>
              </div>
            </div>
          ) : null}
          {scoreText ? (
            <div className="site-venue-kv">
              <IconScore />
              <div className="site-venue-kv__body">
                <p className="site-venue-kv__label">운영 점수판</p>
                <p className="site-venue-kv__value">{scoreText}</p>
              </div>
            </div>
          ) : null}
        </section>

        {showIntroSection ? (
          <section className="card-clean site-detail-inner-stack">
            <h2 className="site-detail-section-title">소개</h2>
            {images.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.5rem",
                  width: "100%",
                  maxWidth: "40rem",
                }}
              >
                {images.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    width={800}
                    height={600}
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: "10px",
                      objectFit: "cover",
                      aspectRatio: "1",
                    }}
                  />
                ))}
              </div>
            ) : null}
            {introTextBlocks.map((block, i) => (
              <p key={`intro-${i}`} className="site-detail-body-text">
                {block}
              </p>
            ))}
            {showPdf ? (
              <SiteOutlineDocumentCard
                url={venue.introPdfUrl!}
                fileKind={introPdfFileKind}
                caption="소개 보기"
              />
            ) : null}
          </section>
        ) : null}

        {venue.naverMapUrl ? (
          <section className="card-clean site-detail-inner-stack">
            <h2 className="site-detail-section-title">위치 안내</h2>
            <a
              className="secondary-button"
              href={venue.naverMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ alignSelf: "flex-start" }}
            >
              네이버 지도에서 위치 보기
            </a>
          </section>
        ) : null}

        <Link className="secondary-button" href="/site/venues" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          당구장안내 목록으로
        </Link>
      </section>
    </SiteShellFrame>
  );
}
