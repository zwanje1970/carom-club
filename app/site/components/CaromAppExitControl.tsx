"use client";

import { useState } from "react";

type CaromAppBridgeWindow = Window & {
  CaromAppBridge?: {
    exitApp?: () => void;
  };
};

export default function CaromAppExitControl() {
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    const w = window as CaromAppBridgeWindow;
    try {
      w.CaromAppBridge?.exitApp?.();
    } catch {
      // ignore bridge failures in non-app environments
    } finally {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="앱 종료"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          left: "10px",
          zIndex: 80,
          width: "32px",
          height: "32px",
          border: "none",
          borderRadius: "999px",
          background: "rgba(17, 24, 39, 0.74)",
          color: "#ffffff",
          fontSize: "24px",
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        ×
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="캐롬클럽 종료"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(0, 0, 0, 0.48)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "min(320px, 100%)",
              background: "#ffffff",
              borderRadius: "14px",
              padding: "18px 16px 14px",
              boxSizing: "border-box",
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>캐롬클럽 종료</h2>
            <p style={{ margin: "10px 0 0", fontSize: "0.93rem", color: "#374151" }}>캐롬클럽을 종료하시겠습니까?</p>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: "10px",
                  height: "40px",
                  background: "#e5e7eb",
                  color: "#111827",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: "10px",
                  height: "40px",
                  background: "#1e3a8a",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
