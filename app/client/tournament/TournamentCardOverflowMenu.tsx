"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function TournamentCardOverflowMenu({
  tournamentId,
  title,
}: {
  tournamentId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dupBusy, setDupBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  async function onDuplicate() {
    setDupBusy(true);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/duplicate`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; tournament?: { id: string } };
      if (!res.ok) {
        window.alert(data.error ?? "복제에 실패했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setDupBusy(false);
    }
  }

  function onDelete() {
    if (
      !window.confirm(
        `「${title}」 대회를 삭제할까요?\n참가 신청·대진·정산 등 이 대회에 연결된 데이터도 함께 제거됩니다.`
      )
    ) {
      return;
    }
    void (async () => {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "삭제에 실패했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    })();
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        className="v3-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="대회 메뉴"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "0.35rem 0.55rem",
          minWidth: "2.25rem",
          fontSize: "1.1rem",
          lineHeight: 1,
        }}
      >
        ⋮
      </button>
      {open ? (
        <ul
          role="menu"
          className="v3-stack"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 20,
            margin: 0,
            padding: "0.35rem 0",
            listStyle: "none",
            minWidth: "8.5rem",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.4rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <li role="none">
            <Link
              role="menuitem"
              className="v3-btn"
              href={`/client/tournaments/new?edit=${encodeURIComponent(tournamentId)}`}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                width: "100%",
                border: "none",
                borderRadius: 0,
                background: "transparent",
                textAlign: "left",
                padding: "0.45rem 0.85rem",
                fontSize: "0.92rem",
                fontWeight: 500,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              수정
            </Link>
          </li>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              className="v3-btn"
              onClick={() => {
                onDelete();
              }}
              style={{
                display: "block",
                width: "100%",
                border: "none",
                borderRadius: 0,
                background: "transparent",
                textAlign: "left",
                padding: "0.45rem 0.85rem",
                fontSize: "0.92rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              삭제
            </button>
          </li>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              className="v3-btn"
              disabled={dupBusy}
              onClick={() => void onDuplicate()}
              style={{
                display: "block",
                width: "100%",
                border: "none",
                borderRadius: 0,
                background: "transparent",
                textAlign: "left",
                padding: "0.45rem 0.85rem",
                fontSize: "0.92rem",
                fontWeight: 500,
                cursor: dupBusy ? "wait" : "pointer",
              }}
            >
              {dupBusy ? "복제 중…" : "복제"}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
