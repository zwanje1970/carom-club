import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { isEmptyOutlineHtml } from "../../../../lib/outline-content-helpers";
import { getSiteVenueDetailById } from "../../../../lib/server/dev-store";

export const dynamic = "force-dynamic";

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

  return (
    <main className="v3-page v3-stack" style={{ gap: "1rem" }}>
      <section className="v3-box v3-stack" style={{ gap: "0.65rem" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>기본정보</p>
        <div className="v3-row" style={{ alignItems: "center", gap: "0.65rem", flexWrap: "wrap", justifyContent: "space-between" }}>
          <h1 className="v3-h1" style={{ fontSize: "1.4rem", margin: 0 }}>
            {venue.name}
          </h1>
          {showWebsiteBtn && linkParts ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                flexShrink: 0,
                minHeight: "2.25rem",
                padding: "0.35rem 0.65rem",
                borderRadius: "8px",
                border: "1px solid var(--v3-border, #e5e7eb)",
                background: "var(--v3-surface, #fff)",
                textDecoration: "none",
                color: "var(--v3-fg, #111)",
                boxSizing: "border-box",
              }}
            >
              <span style={externalLinkBadgeStyle(linkParts.tone)}>{linkParts.badge}</span>
              {linkParts.service ? (
                <span style={{ fontSize: "0.88rem", fontWeight: 600, whiteSpace: "nowrap" }}>{linkParts.service}</span>
              ) : null}
            </a>
          ) : null}
        </div>
        {venue.addressLine ? (
          <p style={{ margin: 0 }}>
            <strong>주소:</strong> {venue.addressLine}
          </p>
        ) : null}
        {venue.phone ? (
          <p style={{ margin: 0 }}>
            <strong>전화번호:</strong> {venue.phone}
          </p>
        ) : null}
        {venue.businessHours ? (
          <p style={{ margin: 0 }}>
            <strong>영업시간</strong> {venue.businessHours}
          </p>
        ) : null}
        {combinedLines.map((line, i) => (
          <p key={`cf-${i}`} style={{ margin: 0 }}>
            {line}
          </p>
        ))}
        {showFlatFees ? (
          <div className="v3-stack" style={{ gap: "0.35rem" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>정액제 요금</p>
            <div style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{flatText}</div>
          </div>
        ) : null}
        {scoreText ? (
          <p style={{ margin: 0 }}>
            <strong>운영 점수판:</strong> {scoreText}
          </p>
        ) : null}
      </section>

      {showIntroSection ? (
        <section className="v3-box v3-stack" style={{ gap: "0.75rem" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>당구장 소개</p>
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
                    borderRadius: "6px",
                    objectFit: "cover",
                    aspectRatio: "1",
                  }}
                />
              ))}
            </div>
          ) : null}
          {introTextBlocks.map((block, i) => (
            <p key={`intro-${i}`} style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
              {block}
            </p>
          ))}
          {showPdf ? (
            <p style={{ margin: 0 }}>
              <a href={venue.introPdfUrl!} target="_blank" rel="noopener noreferrer">
                소개 PDF 보기
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      {venue.naverMapUrl ? (
        <section className="v3-box v3-stack" style={{ gap: "0.5rem" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>위치 안내</p>
          <a
            className="v3-btn"
            href={venue.naverMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", width: "fit-content" }}
          >
            네이버 지도에서 위치 보기
          </a>
        </section>
      ) : null}

      <Link className="v3-btn" href="/site/venues">
        당구장안내 목록으로
      </Link>
    </main>
  );
}
