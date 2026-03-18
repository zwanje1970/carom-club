"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BilliardNoteFormScreen } from "@/components/community/BilliardNoteFormScreen";
import { MobileBallPlacementFullscreen } from "@/components/community/MobileBallPlacementFullscreen";
import type { PlacementPayload } from "@/components/community/BilliardNoteFormScreen";

function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

const MOBILE_MAX_WIDTH = 768;

const BALL_LAYOUT_IMAGE_KEY = "ballLayoutImage";
const BALL_LAYOUT_PLACEMENT_KEY = "billiardNotePlacement";
const DRAFT_STORAGE_KEY = "billiardNoteDraft";

function getInitialPreviewFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(BALL_LAYOUT_IMAGE_KEY);
  } catch {
    return null;
  }
}

function buildPlacementPayloadFromStorage(): PlacementPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const imageData = sessionStorage.getItem(BALL_LAYOUT_IMAGE_KEY);
    const placementRaw = sessionStorage.getItem(BALL_LAYOUT_PLACEMENT_KEY);
    if (!imageData || !placementRaw) return null;
    const placement = JSON.parse(placementRaw) as {
      redBall: { x: number; y: number };
      yellowBall: { x: number; y: number };
      whiteBall: { x: number; y: number };
      cueBall: "white" | "yellow";
    };
    if (
      !placement.redBall || !placement.yellowBall || !placement.whiteBall ||
      typeof placement.redBall.x !== "number" || typeof placement.redBall.y !== "number" ||
      typeof placement.yellowBall.x !== "number" || typeof placement.yellowBall.y !== "number" ||
      typeof placement.whiteBall.x !== "number" || typeof placement.whiteBall.y !== "number"
    ) {
      return null;
    }
    return {
      redBall: placement.redBall,
      yellowBall: placement.yellowBall,
      whiteBall: placement.whiteBall,
      cueBall: placement.cueBall ?? "white",
      getImageDataURL: () => imageData,
    };
  } catch {
    return null;
  }
}

export default function MypageNewNotePage() {
  const [isMobile, setIsMobile] = useState(false);
  const [showPlacement, setShowPlacement] = useState(false);
  const [placementPayload, setPlacementPayload] = useState<PlacementPayload | null>(null);
  const [previewDataURL, setPreviewDataURL] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewHydrated, setPreviewHydrated] = useState(false);
  const [layoutInvalid, setLayoutInvalid] = useState(false);
  const [ballLayoutError, setBallLayoutError] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_MAX_WIDTH);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (previewHydrated) return;
    const saved = getInitialPreviewFromStorage();
    if (saved) setPreviewDataURL(saved);
    const restored = buildPlacementPayloadFromStorage();
    if (restored) setPlacementPayload((prev) => prev ?? restored);
    setPreviewHydrated(true);
  }, [previewHydrated]);

  useEffect(() => {
    if (!showPlacement) {
      setImageError(null);
      setLayoutInvalid(false);
      setBallLayoutError(null);
      const saved = typeof window !== "undefined" ? sessionStorage.getItem(BALL_LAYOUT_IMAGE_KEY) : null;
      if (saved) setPreviewDataURL((prev) => prev || saved);
      const restored = buildPlacementPayloadFromStorage();
      if (restored) setPlacementPayload((prev) => prev ?? restored);
    }
  }, [showPlacement]);

  const handlePlacementComplete = (payload: PlacementPayload) => {
    const dataURL = payload.getImageDataURL();
    setPreviewDataURL(dataURL || null);
    setPlacementPayload(payload);
    setShowPlacement(false);
    try {
      sessionStorage.setItem(
        BALL_LAYOUT_PLACEMENT_KEY,
        JSON.stringify({
          redBall: payload.redBall,
          yellowBall: payload.yellowBall,
          whiteBall: payload.whiteBall,
          cueBall: payload.cueBall,
        })
      );
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (data: {
    title: string;
    noteDate: string;
    content: string;
  }): Promise<string | null> => {
    if (!placementPayload) return null;
    const { redBall, yellowBall, whiteBall, cueBall } = placementPayload;
    if (
      !redBall || !yellowBall || !whiteBall ||
      typeof redBall.x !== "number" || typeof redBall.y !== "number" ||
      typeof yellowBall.x !== "number" || typeof yellowBall.y !== "number" ||
      typeof whiteBall.x !== "number" || typeof whiteBall.y !== "number"
    ) {
      throw new Error("공 배치 정보가 올바르지 않습니다. 당구공 배치를 다시 해 주세요.");
    }
    let dataURL: string | null | undefined = placementPayload.getImageDataURL?.();
    if (!dataURL && typeof window !== "undefined") {
      dataURL = sessionStorage.getItem(BALL_LAYOUT_IMAGE_KEY);
    }
    if (!dataURL) throw new Error("이미지를 생성할 수 없습니다.");
    let blob: Blob;
    try {
      blob = dataURLToBlob(dataURL);
    } catch {
      throw new Error("이미지 데이터가 올바르지 않습니다. 당구공 배치를 다시 해 주세요.");
    }
    if (!blob.size) throw new Error("이미지 크기가 0입니다. 당구공 배치를 다시 해 주세요.");
    const formData = new FormData();
    formData.append("file", new File([blob], "table.png", { type: blob.type }));
    const uploadRes = await fetch("/api/community/billiard-notes/upload-image", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const uploadJson = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      throw new Error(uploadJson.error ?? "이미지 업로드에 실패했습니다.");
    }
    const url = uploadJson.url;
    if (!url || typeof url !== "string") {
      throw new Error("이미지 업로드 응답이 올바르지 않습니다.");
    }
    const res = await fetch("/api/community/billiard-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: data.title || null,
        noteDate: data.noteDate || null,
        redBall: { x: redBall.x, y: redBall.y },
        yellowBall: { x: yellowBall.x, y: yellowBall.y },
        whiteBall: { x: whiteBall.x, y: whiteBall.y },
        cueBall: cueBall === "yellow" ? "yellow" : "white",
        memo: data.content || null,
        imageUrl: url,
        visibility: "private",
      }),
    });
    const resJson = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(resJson.error ?? "저장에 실패했습니다.");
    }
    const id = resJson.id;
    if (!id) throw new Error("저장 응답이 올바르지 않습니다.");
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      sessionStorage.removeItem(BALL_LAYOUT_IMAGE_KEY);
      sessionStorage.removeItem(BALL_LAYOUT_PLACEMENT_KEY);
    } catch {
      // ignore
    }
    return id;
  };

  if (showPlacement) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <MobileBallPlacementFullscreen
          initialRed={placementPayload?.redBall}
          initialYellow={placementPayload?.yellowBall}
          initialWhite={placementPayload?.whiteBall}
          initialCueBall={placementPayload?.cueBall}
          onSave={async (payload) => handlePlacementComplete(payload)}
          onExitFullscreen={() => setShowPlacement(false)}
          returnOnly={true}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/mypage" className="hover:text-site-primary">마이페이지</Link>
          <span aria-hidden>/</span>
          <Link href="/mypage/notes" className="hover:text-site-primary">당구노트</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">작성</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">당구노트 작성</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          제목·날짜·내용을 입력하고, 당구공배치를 클릭해 공을 배치한 뒤 저장하세요.
        </p>
        <BilliardNoteFormScreen
          previewImageUrl={previewDataURL}
          onSubmit={handleSubmit}
          onOpenPlacement={() => setShowPlacement(true)}
          showPlacement={showPlacement}
          hasPlacement={!!placementPayload}
          redirectBasePath="/mypage/notes"
        />
      </div>
    </main>
  );
}
