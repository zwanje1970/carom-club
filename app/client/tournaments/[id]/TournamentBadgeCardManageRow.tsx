"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { withPublishedCardMainReflectNotice } from "../../../../lib/client-published-card-main-reflect-notice";
import { useEffect, useRef, useState } from "react";
import type { TournamentStatusBadge } from "../../../../lib/types/entities";

const OPTIONS: TournamentStatusBadge[] = [
  "모집중",
  "마감임박",
  "마감",
  "예정",
  "종료",
  "초안",
];

function statusBadgeStyle(badge: TournamentStatusBadge): { background: string; color: string } {
  if (badge === "모집중") {
    return { background: "#fef3c7", color: "#92400e" };
  }
  if (badge === "마감" || badge === "종료") {
    return { background: "#f3f4f6", color: "#4b5563" };
  }
  return { background: "#eff6ff", color: "#1e3a5f" };
}

type CardSnapshotRow = {
  title: string;
  subtitle: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  cardExtraLine3?: string | null;
  imageId: string;
  image320Url: string;
  tournamentCardTemplate?: "A" | "B";
  tournamentBackgroundType?: "image" | "theme";
  tournamentTheme?: "dark" | "light" | "natural";
  tournamentMediaBackground?: string | null;
  tournamentImageOverlayBlend?: boolean | null;
  tournamentImageOverlayOpacity?: number | null;
  tournamentCardDisplayDate?: string | null;
  tournamentCardDisplayLocation?: string | null;
  tournamentCardTextShadowEnabled?: boolean;
  tournamentCardSurfaceLayout?: "split" | "full";
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
  cardLeadTextColor?: string | null;
  cardTitleTextColor?: string | null;
  cardDescriptionTextColor?: string | null;
  /** false면 초안(게시카드 작성 저장분). 게시 시 최신 초안을 우선한다. */
  isActive?: boolean;
};

function isCompleteCard(s: CardSnapshotRow | null | undefined): s is CardSnapshotRow {
  if (!s) return false;
  const title = typeof s.title === "string" ? s.title.trim() : "";
  if (!title) return false;
  const bg = s.tournamentBackgroundType === "theme" ? "theme" : "image";
  if (bg === "image") {
    const imageId = typeof s.imageId === "string" ? s.imageId.trim() : "";
    const image320Url = typeof s.image320Url === "string" ? s.image320Url.trim() : "";
    return Boolean(imageId && image320Url);
  }
  return true;
}

/**
 * 목록은 최신순(서버). 게시 시 본문은 마지막으로 저장한 초안(`isActive !== true`)을 우선하고,
 * 없으면 현재 메인에 올라간 카드 내용으로 다시 게시(갱신)한다.
 */
function pickCardForPublish(data: {
  snapshots?: CardSnapshotRow[];
  activeSnapshot?: CardSnapshotRow | null;
}): CardSnapshotRow | null {
  const list = data.snapshots ?? [];
  const draft = list.find((row) => row.isActive === false && isCompleteCard(row));
  if (draft) return draft;
  const fromList = list.find((row) => isCompleteCard(row));
  if (fromList) return fromList;
  if (isCompleteCard(data.activeSnapshot)) return data.activeSnapshot;
  return null;
}

export default function TournamentBadgeCardManageRow({
  tournamentId,
  initialStatus,
}: {
  tournamentId: string;
  initialStatus: TournamentStatusBadge;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialStatus);
  const [expanded, setExpanded] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const publishRunningRef = useRef(false);
  const badgePillStyle = statusBadgeStyle(value);

  useEffect(() => {
    setValue(initialStatus);
  }, [initialStatus]);

  /** 기존 PATCH `/status-badge` 요청과 동일한 본문·응답 처리(호출 위치만 「저장/게시」로 이동). */
  async function persistCurrentBadgeToServer(): Promise<boolean> {
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusBadge: value }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        window.alert(data.error ?? "저장에 실패했습니다.");
        return false;
      }
      return true;
    } catch {
      window.alert("저장 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * 작성화면(card-publish-v2)에서 쓰던 게시 POST와 동일한 페이로드·검증·안내(함수 위치만 대회 관리로 이동).
   * `draftOnly: false` — 서버 검증·에러 문구는 변경하지 않음.
   */
  async function requestCardPublish(): Promise<void> {
    const res = await fetch(`/api/client/card-snapshots?tournamentId=${encodeURIComponent(tournamentId)}`);
    const data = (await res.json()) as {
      snapshots?: CardSnapshotRow[];
      activeSnapshot?: CardSnapshotRow | null;
      error?: string;
    };
    if (!res.ok) {
      window.alert(data.error ?? "카드 정보를 불러오지 못했습니다.");
      return;
    }
    const hadPublishedBefore = Boolean(data.activeSnapshot);
    const latest = pickCardForPublish(data);
    if (!latest) {
      window.alert("저장된 카드를 찾을 수 없습니다. 게시카드 작성에서 저장해 주세요.");
      return;
    }
    const postRes = await fetch("/api/client/card-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId,
        title: typeof latest.title === "string" ? latest.title : "",
        textLine1: typeof latest.cardExtraLine1 === "string" ? latest.cardExtraLine1 : "",
        textLine2: typeof latest.cardExtraLine2 === "string" ? latest.cardExtraLine2 : "",
        textLine3: typeof latest.cardExtraLine3 === "string" ? latest.cardExtraLine3 : "",
        cardTemplate: latest.tournamentCardTemplate ?? "A",
        backgroundType: latest.tournamentBackgroundType ?? "image",
        themeType: latest.tournamentTheme ?? "dark",
        imageId: latest.imageId?.trim() ?? "",
        image320Url: latest.image320Url?.trim() ?? "",
        draftOnly: false,
        cardTextShadowEnabled: latest.tournamentCardTextShadowEnabled === true,
        cardSurfaceLayout: latest.tournamentCardSurfaceLayout === "full" ? "full" : "split",
        ...(latest.tournamentCardSurfaceLayout === "full"
          ? {
              cardFooterDateTextColor:
                typeof latest.cardFooterDateTextColor === "string" && latest.cardFooterDateTextColor.trim()
                  ? latest.cardFooterDateTextColor.trim()
                  : null,
              cardFooterPlaceTextColor:
                typeof latest.cardFooterPlaceTextColor === "string" && latest.cardFooterPlaceTextColor.trim()
                  ? latest.cardFooterPlaceTextColor.trim()
                  : null,
            }
          : {
              cardFooterDateTextColor: null,
              cardFooterPlaceTextColor: null,
            }),
        ...(typeof latest.tournamentMediaBackground === "string"
          ? { mediaBackground: latest.tournamentMediaBackground }
          : {}),
        ...(typeof latest.tournamentImageOverlayBlend === "boolean"
          ? { imageOverlayBlend: latest.tournamentImageOverlayBlend }
          : {}),
        ...(typeof latest.tournamentImageOverlayOpacity === "number"
          ? { imageOverlayOpacity: latest.tournamentImageOverlayOpacity }
          : {}),
        ...(typeof latest.tournamentCardDisplayDate === "string"
          ? { cardDisplayDate: latest.tournamentCardDisplayDate }
          : {}),
        ...(typeof latest.tournamentCardDisplayLocation === "string"
          ? { cardDisplayLocation: latest.tournamentCardDisplayLocation }
          : {}),
        ...(typeof latest.cardLeadTextColor === "string" && latest.cardLeadTextColor.trim()
          ? { cardLeadTextColor: latest.cardLeadTextColor.trim() }
          : {}),
        ...(typeof latest.cardTitleTextColor === "string" && latest.cardTitleTextColor.trim()
          ? { cardTitleTextColor: latest.cardTitleTextColor.trim() }
          : {}),
        ...(typeof latest.cardDescriptionTextColor === "string" && latest.cardDescriptionTextColor.trim()
          ? { cardDescriptionTextColor: latest.cardDescriptionTextColor.trim() }
          : {}),
      }),
    });
    const postData = (await postRes.json()) as {
      ok?: boolean;
      code?: string;
      message?: string;
      error?: string;
      snapshot?: { snapshotId?: string };
    };
    if (!postRes.ok) {
      window.alert(postData.error ?? "게시에 실패했습니다.");
      return;
    }
    window.alert(
      withPublishedCardMainReflectNotice(
        hadPublishedBefore
          ? "게시카드가 갱신되어 메인에 반영되었습니다."
          : "메인에 게시되었습니다. 사이트에 반영되었습니다.",
      ),
    );
    router.refresh();
  }

  async function onSaveBadgeAndPublish() {
    if (publishRunningRef.current) return;
    publishRunningRef.current = true;
    setPublishBusy(true);
    try {
      if (!(await persistCurrentBadgeToServer())) return;
      await router.refresh();
      await requestCardPublish();
    } catch {
      window.alert("처리 중 오류가 발생했습니다.");
    } finally {
      setPublishBusy(false);
      publishRunningRef.current = false;
    }
  }

  return (
    <div
      id="tournament-status-badge"
      className="v3-stack"
      style={{ scrollMarginTop: "4.5rem", alignItems: "flex-end", flex: "0 1 auto", minWidth: "min(100%, 22rem)", gap: "0.35rem" }}
    >
      <span
        style={{
          ...badgePillStyle,
          fontSize: "0.78rem",
          fontWeight: 800,
          padding: "0.2rem 0.55rem",
          borderRadius: "999px",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      <button
        type="button"
        className="v3-btn"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        style={{ padding: "0.35rem 0.6rem", fontSize: "0.82rem", fontWeight: 700, width: "100%", maxWidth: "14rem" }}
      >
        상태배지 변경
      </button>
      {expanded ? (
        <div
          className="v3-stack"
          style={{
            width: "100%",
            maxWidth: "22rem",
            alignItems: "stretch",
            gap: "0.45rem",
            padding: "0.5rem 0.55rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.4rem",
            background: "#fff",
            boxSizing: "border-box",
          }}
        >
          <select
            value={value}
            disabled={publishBusy}
            onChange={(e) => setValue(e.target.value as TournamentStatusBadge)}
            style={{ padding: "0.45rem", border: "1px solid #bbb", borderRadius: "0.35rem", fontSize: "0.88rem" }}
            aria-label="대회 상태 배지"
          >
            {OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.45 }}>
            이미 게시된 카드가 있으면 새로 만들지 않고 기존 카드에 반영됩니다. 대회당 메인 게시카드는 1개입니다.
          </p>
          <button
            type="button"
            className="v3-btn"
            disabled={publishBusy}
            onClick={() => void onSaveBadgeAndPublish()}
            style={{ alignSelf: "flex-start" }}
          >
            {publishBusy ? "처리 중…" : "저장/게시"}
          </button>
          <Link
            className="v3-btn"
            href={`/client/tournaments/${tournamentId}/card-publish-v2`}
            prefetch={false}
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            게시카드 작성·수정
          </Link>
        </div>
      ) : null}
    </div>
  );
}
