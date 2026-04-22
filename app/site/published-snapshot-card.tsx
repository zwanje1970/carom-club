import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

const KO_WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"] as const;

function formatSnapshotPublishedDateYmdWeekday(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}.${mo}.${da} (${KO_WEEKDAY_SHORT[d.getDay()]})`;
}

function SnapshotCardOuter({
  previewOnly,
  href,
  style,
  children,
}: {
  previewOnly?: boolean;
  href: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  if (previewOnly) {
    return <div style={{ ...style, cursor: "default" }}>{children}</div>;
  }
  return (
    <Link href={href} style={style}>
      {children}
    </Link>
  );
}

type BlockAlignment = "LEFT" | "CENTER" | "RIGHT";
type CardLayout = "vertical" | "horizontal";
type TemplateCardType = "tournament" | "venue";

type SnapshotCardItem = {
  snapshotId: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  targetDetailUrl: string;
  image320Url?: string;
  /** 대회 카드: 스냅샷에 저장된 상태 배지(없으면 제목 첫 단어로 추정) */
  statusBadge?: string;
  /** 대회 카드: 제목과 날짜 사이 자유 문구(각 1줄) */
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
};

const TOURNAMENT_BADGE_HIDDEN = new Set(["종료", "초안"]);

function resolveTournamentHeadlineForCard(item: SnapshotCardItem): {
  showBadge: boolean;
  badgeText: string;
  name: string;
} {
  const raw = item.statusBadge?.trim();
  if (raw) {
    const name = item.title.trim();
    if (TOURNAMENT_BADGE_HIDDEN.has(raw)) return { showBadge: false, badgeText: "", name };
    return { showBadge: true, badgeText: raw, name };
  }
  const parsed = parseTournamentTitle(item.title);
  if (TOURNAMENT_BADGE_HIDDEN.has(parsed.status)) {
    return { showBadge: false, badgeText: "", name: parsed.name || item.title };
  }
  return { showBadge: true, badgeText: parsed.status || "대회", name: parsed.name || item.title };
}

function parseTournamentTitle(title: string): { status: string; name: string } {
  const normalized = title.trim();
  if (!normalized) return { status: "대회", name: "" };
  const firstSpaceIndex = normalized.indexOf(" ");
  if (firstSpaceIndex < 0) return { status: "대회", name: normalized };
  const statusCandidate = normalized.slice(0, firstSpaceIndex).trim();
  const nameCandidate = normalized.slice(firstSpaceIndex + 1).trim();
  if (!nameCandidate) return { status: "대회", name: normalized };
  return { status: statusCandidate, name: nameCandidate };
}

function parseTournamentSubtitle(subtitle: string): { dateText: string; placeText: string } {
  const normalized = subtitle.trim();
  if (!normalized) return { dateText: "", placeText: "" };
  const pieces = normalized.split("·").map((item) => item.trim()).filter((item) => item.length > 0);
  if (pieces.length === 0) return { dateText: "", placeText: "" };
  if (pieces.length === 1) return { dateText: pieces[0], placeText: "" };
  return { dateText: pieces[0], placeText: pieces.slice(1).join(" · ") };
}

function toCssTextAlign(alignment: BlockAlignment): "left" | "center" | "right" {
  if (alignment === "CENTER") return "center";
  if (alignment === "RIGHT") return "right";
  return "left";
}

export default function PublishedSnapshotCard({
  item,
  alignment,
  layout,
  templateType,
  previewOnly,
}: {
  item: SnapshotCardItem;
  alignment: BlockAlignment;
  layout?: CardLayout;
  templateType?: TemplateCardType;
  /** 클라이언트 게시카드 작성 화면 미리보기 전용: 링크·클릭 없음 */
  previewOnly?: boolean;
}) {
  if (templateType === "venue" && layout === "horizontal") {
    return (
      <SnapshotCardOuter
        previewOnly={previewOnly}
        href={item.targetDetailUrl}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          alignItems: "stretch",
          gap: "0.6rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.55rem",
          background: "#fcfcfd",
          minHeight: "7.8rem",
          overflow: "hidden",
          width: "100%",
          padding: "0.5rem",
        }}
      >
        <div style={{ flex: "0 0 42%" }}>
          {item.image320Url ? (
            <img
              src={item.image320Url}
              alt={item.title}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.4rem", display: "block" }}
            />
          ) : (
            <div
              className="v3-muted"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "0.4rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f3f4f6",
                fontSize: "0.78rem",
              }}
            >
              이미지 없음
            </div>
          )}
        </div>
        <div style={{ flex: "1 1 0", alignSelf: "center", textAlign: toCssTextAlign(alignment) }}>
          <strong
            style={{
              display: "block",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              lineHeight: 1.4,
              fontSize: "1rem",
            }}
          >
            {item.title}
          </strong>
          <span
            className="v3-muted"
            style={{
              display: "block",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              marginTop: "0.18rem",
              lineHeight: 1.35,
              fontSize: "0.86rem",
            }}
          >
            {item.subtitle}
          </span>
        </div>
      </SnapshotCardOuter>
    );
  }

  if (templateType === "tournament" && layout === "horizontal") {
    const headline = resolveTournamentHeadlineForCard(item);
    const parsedSubtitle = parseTournamentSubtitle(item.subtitle);
    const extra1 = (item.cardExtraLine1 ?? "").trim();
    const extra2 = (item.cardExtraLine2 ?? "").trim();
    const extraLineStyle = {
      display: "-webkit-box" as const,
      WebkitLineClamp: 1,
      WebkitBoxOrient: "vertical" as const,
      overflow: "hidden",
      lineHeight: 1.35,
      fontSize: "0.82rem",
    };
    return (
      <SnapshotCardOuter
        previewOnly={previewOnly}
        href={item.targetDetailUrl}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          alignItems: "stretch",
          gap: "0.7rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.72rem",
          background: "#fcfcfd",
          minHeight: "10.2rem",
          overflow: "hidden",
          width: "100%",
          padding: "0.65rem",
        }}
      >
        <div
          style={{
            flex: "1 1 0",
            minWidth: 0,
            textAlign: toCssTextAlign(alignment),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignSelf: "stretch",
            minHeight: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.22rem", minWidth: 0 }}>
            {headline.showBadge ? (
              <span
                style={{
                  display: "inline-flex",
                  alignSelf:
                    toCssTextAlign(alignment) === "center"
                      ? "center"
                      : toCssTextAlign(alignment) === "right"
                        ? "flex-end"
                        : "flex-start",
                  maxWidth: "100%",
                  padding: "0.12rem 0.5rem",
                  borderRadius: "999px",
                  background: "#eef2ff",
                  color: "#1e3a8a",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  lineHeight: 1.3,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {headline.badgeText || "대회"}
              </span>
            ) : null}
            <strong
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.35,
                fontSize: "1.06rem",
                marginTop: headline.showBadge ? "0.23rem" : 0,
              }}
            >
              {headline.name || "(대회명)"}
            </strong>
            {extra1 ? (
              <span className="v3-muted" style={extraLineStyle}>
                {extra1}
              </span>
            ) : null}
            {extra2 ? (
              <span className="v3-muted" style={extraLineStyle}>
                {extra2}
              </span>
            ) : null}
          </div>
          <div
            style={{
              flexShrink: 0,
              marginTop: "0.55rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.16rem",
            }}
          >
            <span
              className="v3-muted"
              style={{
                display: "block",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                lineHeight: 1.35,
                fontSize: "0.84rem",
              }}
            >
              {parsedSubtitle.dateText || "-"}
            </span>
            <span
              className="v3-muted"
              style={{
                display: "block",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                lineHeight: 1.35,
                fontSize: "0.84rem",
              }}
            >
              {parsedSubtitle.placeText || "-"}
            </span>
          </div>
        </div>
        <div style={{ flex: "0 0 35%", minWidth: "6.5rem" }}>
          {item.image320Url ? (
            <img
              src={item.image320Url}
              alt={item.title}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.55rem", display: "block" }}
            />
          ) : (
            <div
              className="v3-muted"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "0.55rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f3f4f6",
                fontSize: "0.78rem",
              }}
            >
              이미지 없음
            </div>
          )}
        </div>
      </SnapshotCardOuter>
    );
  }

  if (layout === "horizontal") {
    return (
      <SnapshotCardOuter
        previewOnly={previewOnly}
        href={item.targetDetailUrl}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          alignItems: "stretch",
          gap: "0.7rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.55rem",
          background: "#fcfcfd",
          minHeight: "8.8rem",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div style={{ flex: "0 0 64%", padding: "0.62rem 0.72rem", textAlign: toCssTextAlign(alignment) }}>
          <strong
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.35,
            }}
          >
            {item.title}
          </strong>
          <span
            className="v3-muted"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              marginTop: "0.18rem",
              lineHeight: 1.35,
            }}
          >
            {item.subtitle}
          </span>
          <span
            className="v3-muted"
            style={{
              display: "inline-block",
              marginTop: "0.42rem",
              fontSize: "0.78rem",
              padding: "0.08rem 0.4rem",
              borderRadius: "999px",
              background: "#eef2ff",
            }}
          >
            {formatSnapshotPublishedDateYmdWeekday(item.publishedAt)}
          </span>
        </div>
        <div style={{ flex: "0 0 36%" }}>
          {item.image320Url ? (
            <img
              src={item.image320Url}
              alt={item.title}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              className="v3-muted"
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f3f4f6",
                fontSize: "0.78rem",
              }}
            >
              이미지 없음
            </div>
          )}
        </div>
      </SnapshotCardOuter>
    );
  }

  return (
    <SnapshotCardOuter
      previewOnly={previewOnly}
      href={item.targetDetailUrl}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        border: "1px solid #e5e7eb",
        borderRadius: "0.55rem",
        background: "#fcfcfd",
        padding: "0.62rem 0.72rem",
        textAlign: toCssTextAlign(alignment),
      }}
    >
      <strong style={{ display: "block", lineHeight: 1.35 }}>{item.title}</strong>
      <span className="v3-muted" style={{ display: "block", marginTop: "0.18rem", lineHeight: 1.35 }}>
        {item.subtitle}
      </span>
      <span
        className="v3-muted"
        style={{
          display: "inline-block",
          marginTop: "0.42rem",
          fontSize: "0.78rem",
          padding: "0.08rem 0.4rem",
          borderRadius: "999px",
          background: "#eef2ff",
        }}
      >
        {formatSnapshotPublishedDateYmdWeekday(item.publishedAt)}
      </span>
    </SnapshotCardOuter>
  );
}
