"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TournamentStatusBadge } from "../../../../lib/server/dev-store";

const OPTIONS: TournamentStatusBadge[] = [
  "모집중",
  "마감임박",
  "마감",
  "대기자모집",
  "예정",
  "종료",
  "초안",
];

type CardSnapshotRow = {
  title: string;
  subtitle: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  imageId: string;
  image320Url: string;
  tournamentCardTemplate?: "A" | "B";
  tournamentBackgroundType?: "image" | "theme";
  tournamentTheme?: "dark" | "light" | "natural";
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

/** 목록은 최신순 — 카드 작성에서 저장한 비활성 스냅샷이 있으면 그것을 게시 대상으로 삼음 */
function pickCardForPublish(data: {
  snapshots?: CardSnapshotRow[];
  activeSnapshot?: CardSnapshotRow | null;
}): CardSnapshotRow | null {
  const list = data.snapshots ?? [];
  const fromList = list.find((row) => isCompleteCard(row));
  if (fromList) return fromList;
  if (isCompleteCard(data.activeSnapshot)) return data.activeSnapshot;
  return null;
}

/** 대회 상세에서만 사용 — 모집중일 때만 게시 허용 */
function getDetailPublishBlockedMessage(status: string): string | null {
  const s = status.trim();
  if (s === "모집중") return null;
  if (s === "초안") return "초안은 게시할 수 없습니다.";
  if (s === "예정") return "예정은 게시할 수 없습니다.";
  return "이 상태에서는 게시할 수 없습니다.";
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
  const [busy, setBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);

  useEffect(() => {
    setValue(initialStatus);
  }, [initialStatus]);

  async function applyBadge(next: TournamentStatusBadge) {
    const prev = value;
    setValue(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusBadge: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        window.alert(data.error ?? "저장에 실패했습니다.");
        setValue(prev);
        return;
      }
      router.refresh();
    } catch {
      window.alert("저장 중 오류가 발생했습니다.");
      setValue(prev);
    } finally {
      setBusy(false);
    }
  }

  async function handleCardPublish() {
    const blocked = getDetailPublishBlockedMessage(value);
    if (blocked) {
      window.alert(blocked);
      return;
    }
    if (publishBusy) return;
    setPublishBusy(true);
    try {
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
          title: latest.title.trim(),
          textLine1: typeof latest.cardExtraLine1 === "string" ? latest.cardExtraLine1 : "",
          textLine2: typeof latest.cardExtraLine2 === "string" ? latest.cardExtraLine2 : "",
          cardTemplate: latest.tournamentCardTemplate ?? "A",
          backgroundType: latest.tournamentBackgroundType ?? "image",
          themeType: latest.tournamentTheme ?? "dark",
          imageId: latest.imageId?.trim() ?? "",
          image320Url: latest.image320Url?.trim() ?? "",
          draftOnly: false,
        }),
      });
      const postData = (await postRes.json()) as { error?: string; snapshot?: { snapshotId?: string } };
      if (!postRes.ok) {
        window.alert(postData.error ?? "게시에 실패했습니다.");
        return;
      }
      window.alert("게시되었습니다. 사이트에 반영되었습니다.");
      router.refresh();
    } catch {
      window.alert("처리 중 오류가 발생했습니다.");
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <div
      className="v3-row"
      style={{
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: "0.65rem",
        width: "100%",
      }}
    >
      <div
        className="v3-row"
        style={{
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: "0.65rem",
          flex: "1 1 auto",
          minWidth: 0,
        }}
      >
        <label className="v3-stack" style={{ gap: "0.25rem", minWidth: "10rem" }}>
          <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
            대회 상태 배지
          </span>
          <select
            value={value}
            disabled={busy}
            onChange={(e) => void applyBadge(e.target.value as TournamentStatusBadge)}
            style={{ padding: "0.45rem", border: "1px solid #bbb", borderRadius: "0.35rem" }}
          >
            {OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="v3-btn"
          disabled={busy || publishBusy}
          onClick={() => void handleCardPublish()}
          style={{ alignSelf: "flex-end" }}
        >
          {publishBusy ? "게시 중…" : "카드게시"}
        </button>
      </div>
      <Link
        className="v3-btn"
        href={`/client/tournaments/${tournamentId}/card-publish`}
        style={{ alignSelf: "flex-end", marginLeft: "auto", flexShrink: 0 }}
      >
        게시카드 작성
      </Link>
    </div>
  );
}
