"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TournamentStatusBadge } from "../../../../lib/types/entities";

/** API `/status-badge` 와 동일 옵션(대회 운영 상태) */
const OPTIONS: TournamentStatusBadge[] = ["모집중", "마감임박", "마감", "진행중", "예정", "종료", "초안"];

function statusBadgeStyle(badge: TournamentStatusBadge): { background: string; color: string } {
  if (badge === "모집중") {
    return { background: "#fef3c7", color: "#92400e" };
  }
  if (badge === "마감" || badge === "종료") {
    return { background: "#f3f4f6", color: "#4b5563" };
  }
  if (badge === "진행중") {
    return { background: "#dbeafe", color: "#1e40af" };
  }
  return { background: "#eff6ff", color: "#1e3a5f" };
}

export type TournamentManageInfoCardFields = {
  title: string;
  scheduleLine: string | null;
  divisionLabel: string;
  maxParticipants: number;
  applicationTotal: number;
};

export default function TournamentBadgeCardManageRow({
  tournamentId,
  initialStatus,
  infoCard,
  hasDraftCardSnapshot,
}: {
  tournamentId: string;
  initialStatus: TournamentStatusBadge;
  infoCard?: TournamentManageInfoCardFields;
  /** 게시카드 임시저장 스냅샷 존재(공개본과 별도) */
  hasDraftCardSnapshot?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialStatus);
  const [applyBusy, setApplyBusy] = useState(false);

  useEffect(() => {
    setValue(initialStatus);
  }, [initialStatus]);

  async function onApplyStatus(): Promise<void> {
    if (!tournamentId.trim() || applyBusy) return;
    setApplyBusy(true);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusBadge: value }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        window.alert(data.error ?? "저장에 실패했습니다.");
        return;
      }
      void router.refresh();
    } catch {
      window.alert("저장 중 오류가 발생했습니다.");
    } finally {
      setApplyBusy(false);
    }
  }

  const pill = (
    <span
      style={{
        ...statusBadgeStyle(value),
        fontSize: "0.78rem",
        fontWeight: 800,
        padding: "0.2rem 0.55rem",
        borderRadius: "999px",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </span>
  );

  const draftPill =
    hasDraftCardSnapshot === true ? (
      <span
        style={{
          background: "#e0e7ff",
          color: "#3730a3",
          fontSize: "0.72rem",
          fontWeight: 800,
          padding: "0.2rem 0.5rem",
          borderRadius: "999px",
          whiteSpace: "nowrap",
        }}
      >
        게시카드 임시저장
      </span>
    ) : null;

  const cardPublishHref = `/client/tournaments/${encodeURIComponent(tournamentId)}/card-publish-v2`;
  const editHref = `/client/tournaments/${encodeURIComponent(tournamentId)}/edit`;

  const statusRow = (
    <div
      className="client-tournament-manage__badgeSimpleRow"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.45rem",
        width: "100%",
      }}
    >
      <select
        value={value}
        disabled={applyBusy}
        onChange={(e) => setValue(e.target.value as TournamentStatusBadge)}
        style={{
          flex: "1 1 10rem",
          minWidth: "min(100%, 11rem)",
          padding: "0.45rem",
          border: "1px solid #bbb",
          borderRadius: "0.35rem",
          fontSize: "0.88rem",
        }}
        aria-label="대회 상태"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <button type="button" className="v3-btn" disabled={applyBusy} onClick={() => void onApplyStatus()}>
        {applyBusy ? "적용 중…" : "상태 적용"}
      </button>
    </div>
  );

  const linksRow = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", width: "100%" }}>
      <Link
        prefetch={false}
        href={cardPublishHref}
        className="v3-btn"
        style={{ flex: "1 1 auto", minWidth: "min(100%, 10rem)", textAlign: "center", textDecoration: "none" }}
      >
        게시카드 수정
      </Link>
      <Link
        prefetch={false}
        href={editHref}
        className="v3-btn"
        style={{ flex: "1 1 auto", minWidth: "min(100%, 10rem)", textAlign: "center", textDecoration: "none" }}
      >
        대회정보 수정
      </Link>
    </div>
  );

  if (infoCard) {
    return (
      <div id="tournament-status-badge" className="client-tournament-manage__card client-tournament-manage__card--info" style={{ scrollMarginTop: "4.5rem" }}>
        <div className="client-tournament-manage__infoHead">
          <div className="client-tournament-manage__infoText">
            <h1 className="client-tournament-manage__infoTitle">{infoCard.title}</h1>
            <p className="client-tournament-manage__infoMeta">
              {infoCard.scheduleLine ? (
                <>대회일: {infoCard.scheduleLine}</>
              ) : (
                <span className="v3-muted">대회일: —</span>
              )}
              {" · "}
              강수(부): <strong>{infoCard.divisionLabel}</strong>
              {" · "}
              모집인원: <strong>{infoCard.maxParticipants}명</strong>
            </p>
            <p className="client-tournament-manage__infoSub">
              참가신청 <strong>{infoCard.applicationTotal}</strong>건 / 모집 {infoCard.maxParticipants}명
            </p>
          </div>
        </div>
        <div className="client-tournament-manage__infoBadgeActions v3-stack" style={{ gap: "0.45rem", alignItems: "stretch" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
            <span className="client-tournament-manage__infoPill">{pill}</span>
            {draftPill}
          </div>
          {statusRow}
          {linksRow}
        </div>
      </div>
    );
  }

  return (
    <div
      id="tournament-status-badge"
      className="v3-stack"
      style={{ scrollMarginTop: "4.5rem", alignItems: "flex-end", flex: "0 1 auto", minWidth: "min(100%, 22rem)", gap: "0.35rem" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
        {pill}
        {draftPill}
      </div>
      {statusRow}
      {linksRow}
    </div>
  );
}
