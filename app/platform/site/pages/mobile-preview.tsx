"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";

function MobilePreview({
  draftId,
  refreshToken,
  selectedSectionId,
  selectedBlockId,
  onPreviewSelect,
}: {
  draftId: string;
  refreshToken: number;
  selectedSectionId: string | null;
  selectedBlockId: string | null;
  onPreviewSelect: (payload: { sectionId: string | null; blockId: string | null }) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const src = `/site/preview?draftId=${encodeURIComponent(draftId)}&refresh=${refreshToken}`;

  const postSelectionToPreview = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      {
        type: "site-preview-highlight",
        sectionId: selectedSectionId ?? null,
        blockId: selectedBlockId ?? null,
      },
      window.location.origin
    );
  }, [selectedBlockId, selectedSectionId]);

  useEffect(() => {
    postSelectionToPreview();
  }, [postSelectionToPreview, refreshToken]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown; sectionId?: unknown; blockId?: unknown } | null;
      if (!data || data.type !== "site-preview-select") return;
      const sectionId = typeof data.sectionId === "string" && data.sectionId.trim() ? data.sectionId : null;
      const blockId = typeof data.blockId === "string" && data.blockId.trim() ? data.blockId : null;
      if (!sectionId && !blockId) return;
      onPreviewSelect({ sectionId, blockId });
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onPreviewSelect]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const baseWidth = 430;
    const baseHeight = 932;
    const fitPaddingRatio = 0.92;
    const updateScale = () => {
      const nextScale = Math.min(stage.clientWidth / baseWidth, stage.clientHeight / baseHeight, 1) * fitPaddingRatio;
      setPreviewScale((prev) => (Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
    };
    updateScale();
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(stage);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  return (
    <aside className="v3-box v3-stack mobile-preview-shell">
      <div ref={stageRef} className="mobile-preview-stage">
        <div className="mobile-device-fit" style={{ transform: `scale(${previewScale})` }}>
          <div className="mobile-device-frame">
            <div className="mobile-device-notch" />
            <div className="mobile-device-screen">
              <iframe
                ref={iframeRef}
                key={src}
                title="모바일 실제 렌더 미리보기"
                src={src}
                onLoad={postSelectionToPreview}
                style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
              />
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .mobile-preview-shell {
          position: sticky;
          top: 1rem;
          align-self: start;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .mobile-preview-stage {
          width: 100%;
          height: min(900px, calc(100vh - 8.5rem));
          min-height: 560px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .mobile-device-fit {
          width: 430px;
          height: 932px;
          transform-origin: center center;
          will-change: transform;
        }

        .mobile-device-frame {
          width: 100%;
          height: 100%;
          border-radius: 54px;
          border: 1px solid #374151;
          background: linear-gradient(160deg, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 100%);
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.2);
          padding: 18px 14px 20px;
          position: relative;
          overflow: hidden;
        }

        .mobile-device-notch {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 130px;
          height: 18px;
          border-radius: 0 0 12px 12px;
          background: #111827;
          z-index: 3;
        }

        .mobile-device-screen {
          width: 100%;
          height: 100%;
          border-radius: 38px;
          background: #ffffff;
          overflow: hidden;
          border: 1px solid #1f2937;
        }

        @media (max-width: 1320px) {
          .mobile-preview-stage {
            min-height: 520px;
          }
        }

        @media (max-width: 1120px) {
          .mobile-preview-shell {
            position: static;
            top: auto;
          }

          .mobile-preview-stage {
            height: min(880px, calc(100vh - 6rem));
            min-height: 500px;
          }
        }
      `}</style>
    </aside>
  );
}

export default memo(MobilePreview);
