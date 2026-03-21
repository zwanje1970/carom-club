"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MobileBallPlacementFullscreen } from "@/components/community/MobileBallPlacementFullscreen";
import type { CueBallType } from "@/lib/billiard-table-constants";

type NoteSavePayload = {
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: CueBallType;
  memo: string;
  getImageDataURL: () => string;
};

function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

export default function MypageEditNotePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [note, setNote] = useState<{
    redBall: { x: number; y: number };
    yellowBall: { x: number; y: number };
    whiteBall: { x: number; y: number };
    cueBall: "white" | "yellow";
    memo: string | null;
    isAuthor: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/community/billiard-notes/${id}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("노트를 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => {
        if (!data.isAuthor) throw new Error("수정 권한이 없습니다.");
        setNote({
          redBall: data.redBall,
          yellowBall: data.yellowBall,
          whiteBall: data.whiteBall,
          cueBall: data.cueBall,
          memo: data.memo,
          isAuthor: data.isAuthor,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveCore = async (payload: NoteSavePayload) => {
    setError("");
    const dataURL = payload.getImageDataURL();
    if (!dataURL) throw new Error("이미지를 생성할 수 없습니다.");
    const blob = dataURLToBlob(dataURL);
    const formData = new FormData();
    formData.append("file", new File([blob], "table.png", { type: blob.type }));

    const uploadRes = await fetch("/api/community/billiard-notes/upload-image", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!uploadRes.ok) {
      const j = await uploadRes.json().catch(() => ({}));
      throw new Error(j.error ?? "이미지 업로드에 실패했습니다.");
    }
    const { url } = await uploadRes.json();

    const res = await fetch(`/api/community/billiard-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        redBall: payload.redBall,
        yellowBall: payload.yellowBall,
        whiteBall: payload.whiteBall,
        cueBall: payload.cueBall,
        memo: payload.memo || null,
        imageUrl: url,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "저장에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-gray-500">불러오는 중…</p>
        </div>
      </main>
    );
  }
  if (error || !note) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600">{error}</p>
          <Link href="/mypage/notes" className="mt-2 inline-block text-site-primary underline">
            목록으로
          </Link>
        </div>
      </main>
    );
  }

  /** 신규 작성과 동일한 풀스크린 공배치 UI(줌·도구 서랍). 데스크톱·모바일 공통. */
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <MobileBallPlacementFullscreen
        initialRed={note.redBall}
        initialYellow={note.yellowBall}
        initialWhite={note.whiteBall}
        initialCueBall={note.cueBall}
        includeMemoField
        initialMemo={note.memo ?? ""}
        onSave={handleSaveCore}
        returnOnly
        onExitFullscreen={() => router.push(`/mypage/notes/${id}`)}
      />
    </main>
  );
}
