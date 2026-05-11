"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [deleteBusy, setDeleteBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuFixed, setMenuFixed] = useState<{ top: number; right: number } | null>(null);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuFixed({ top: rect.bottom + 4, right: typeof window !== "undefined" ? window.innerWidth - rect.right : 0 });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuFixed(null);
      return;
    }
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    const onScrollOrResize = () => setOpen(false);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  async function onDuplicate() {
    setDupBusy(true);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/duplicate`, {
        method: "POST",
      });
      let data: { error?: string; tournament?: { id: string } };
      try {
        data = (await res.json()) as { error?: string; tournament?: { id: string } };
      } catch {
        window.alert("복제 응답을 처리하지 못했습니다.");
        return;
      }
      if (!res.ok) {
        window.alert(data.error ?? "복제에 실패했습니다.");
        return;
      }
      const newId = data.tournament?.id?.trim();
      setOpen(false);
      if (newId) {
        router.push(`/client/tournaments/${encodeURIComponent(newId)}/edit`);
      }
      router.refresh();
    } catch {
      window.alert("복제 요청에 실패했습니다.");
    } finally {
      setDupBusy(false);
    }
  }

  async function onDelete() {
    if (
      !window.confirm(
        `「${title}」 대회를 삭제할까요?\n신청자가 없을 때만 삭제할 수 있습니다.`
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}`, {
        method: "DELETE",
      });
      let data: { error?: string };
      try {
        data = (await res.json()) as { error?: string };
      } catch {
        window.alert("삭제 응답을 처리하지 못했습니다.");
        return;
      }
      if (!res.ok) {
        window.alert(data.error ?? "삭제에 실패했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      window.alert("삭제 요청에 실패했습니다.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const menuPanel =
    open && menuFixed && typeof document !== "undefined" ? (
      <div
        ref={menuPanelRef}
        role="presentation"
        style={{
          position: "fixed",
          top: menuFixed.top,
          right: menuFixed.right,
          zIndex: 10000,
          margin: 0,
          padding: 0,
        }}
      >
        <ul
          role="menu"
          className="v3-stack"
          style={{
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
              href={`/client/tournaments/${encodeURIComponent(tournamentId)}/edit`}
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
              disabled={deleteBusy}
              onClick={() => void onDelete()}
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
                cursor: deleteBusy ? "wait" : "pointer",
              }}
            >
              {deleteBusy ? "삭제 중…" : "삭제"}
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
      </div>
    ) : null;

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={triggerRef}
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
      {menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
