"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import deckStyles from "../../../../site/main-scene-slide-deck.module.css";
import { SlideDeckCard, type SlideDeckItem } from "../../../../site/tournament-slide-card";
type UploadedImage = {
  imageId: string;
  w320Url: string;
  w640Url: string;
};

type CardTemplate = "A" | "B";
type CardTheme = "dark" | "light" | "natural";

type TournamentSummary = {
  title: string;
  date: string;
  location: string;
  statusBadge?: string;
};

export default function ClientTournamentCardPublishPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);

  const [tournamentStatusForPreview, setTournamentStatusForPreview] = useState("");
  const [tournamentDateForPreview, setTournamentDateForPreview] = useState("");
  const [tournamentLocationForPreview, setTournamentLocationForPreview] = useState("");
  const [cardTemplate, setCardTemplate] = useState<CardTemplate>("A");
  const [title, setTitle] = useState("");
  const [textLine1, setTextLine1] = useState("");
  const [textLine2, setTextLine2] = useState("");
  const [themeType, setThemeType] = useState<CardTheme>("dark");
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [showStyleOptions, setShowStyleOptions] = useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const backgroundType = uploadedImage ? "image" : "theme";

  const cardPublishSlidePreview: SlideDeckItem = useMemo(
    () => ({
      snapshotId: "card-publish-preview",
      title: title.trim() || "(제목)",
      subtitle: `${tournamentDateForPreview} · ${tournamentLocationForPreview}`.trim(),
      statusBadge: tournamentStatusForPreview,
      cardExtraLine1: textLine1 || null,
      cardExtraLine2: textLine2 || null,
      image320Url: uploadedImage?.w320Url,
      cardTemplate,
      backgroundType,
      themeType,
    }),
    [
      title,
      tournamentDateForPreview,
      tournamentLocationForPreview,
      tournamentStatusForPreview,
      textLine1,
      textLine2,
      uploadedImage?.w320Url,
      cardTemplate,
      backgroundType,
      themeType,
    ]
  );

  const loadSnapshots = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const response = await fetch(`/api/client/card-snapshots?tournamentId=${encodeURIComponent(tournamentId)}`);
      const result = (await response.json()) as {
        snapshots?: Array<{
          title?: string;
          cardExtraLine1?: string | null;
          cardExtraLine2?: string | null;
          tournamentCardTemplate?: "A" | "B";
          tournamentTheme?: "dark" | "light" | "natural";
          tournamentBackgroundType?: "image" | "theme";
          image320Url?: string;
          imageId?: string;
          image640Url?: string;
        }>;
        activeSnapshot?: {
          title?: string;
          cardExtraLine1?: string | null;
          cardExtraLine2?: string | null;
          tournamentCardTemplate?: "A" | "B";
          tournamentTheme?: "dark" | "light" | "natural";
          tournamentBackgroundType?: "image" | "theme";
          image320Url?: string;
          imageId?: string;
          image640Url?: string;
        } | null;
        tournament?: TournamentSummary;
        error?: string;
      };
      if (!response.ok) return;

      const t = result.tournament;
      if (!t) return;

      setTournamentStatusForPreview(
        typeof t.statusBadge === "string" && t.statusBadge.trim() ? t.statusBadge.trim() : ""
      );
      setTournamentDateForPreview(typeof t.date === "string" ? t.date : "");
      setTournamentLocationForPreview(typeof t.location === "string" ? t.location : "");

      const newest = result.snapshots?.[0];
      const active = result.activeSnapshot;
      const pick =
        newest && (newest.title ?? "").trim()
          ? newest
          : active && (active.title ?? "").trim()
            ? active
            : null;
      if (pick) {
        setTitle(pick.title || t.title);
        setTextLine1(pick.cardExtraLine1 ?? "");
        setTextLine2(pick.cardExtraLine2 ?? "");
        setCardTemplate(pick.tournamentCardTemplate === "B" ? "B" : "A");
        setThemeType(
          pick.tournamentTheme === "light" ? "light" : pick.tournamentTheme === "natural" ? "natural" : "dark"
        );
        if (pick.tournamentBackgroundType === "image" && pick.image320Url?.trim()) {
          setUploadedImage({
            imageId: pick.imageId || "",
            w320Url: pick.image320Url,
            w640Url: pick.image640Url || pick.image320Url,
          });
        } else {
          setUploadedImage(null);
        }
      } else {
        setTitle(t.title);
        setTextLine1("");
        setTextLine2("");
        setUploadedImage(null);
      }
    } catch {
      /* noop */
    }
  }, [tournamentId]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void loadSnapshots();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadSnapshots]);

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tournamentId || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/client/card-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          title: title.trim(),
          textLine1: textLine1.trim(),
          textLine2: textLine2.trim(),
          cardTemplate,
          backgroundType,
          themeType,
          imageId: uploadedImage?.imageId ?? "",
          image320Url: uploadedImage?.w320Url ?? "",
          draftOnly: true,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "저장에 실패했습니다.");
        return;
      }
      setMessage("카드가 저장되었습니다. 대회 상세에서 카드게시를 눌러 게시하세요.");
      router.refresh();
    } catch {
      setMessage("저장 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadImage(file: File) {
    if (uploading) return;
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as UploadedImage & { error?: string };
      if (!response.ok || !result.imageId) {
        setMessage(result.error ?? "이미지 업로드에 실패했습니다.");
        return;
      }
      setUploadedImage({
        imageId: result.imageId,
        w320Url: result.w320Url,
        w640Url: result.w640Url,
      });
      setMessage("이미지가 적용되었습니다.");
    } catch {
      setMessage("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setUploadedImage(null);
    setMessage("이미지를 제거했습니다. 테마 배경으로 표시됩니다.");
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "40rem", margin: "0 auto" }}>
      <h1 className="v3-h1">게시카드 작성</h1>

      <form className="v3-box v3-stack" onSubmit={handlePublish}>
        <fieldset className="v3-stack" style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="v3-muted" style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
            템플릿
          </legend>
          <div className="v3-row" style={{ gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="cardTemplate"
                checked={cardTemplate === "A"}
                onChange={() => setCardTemplate("A")}
              />
              템플릿 A
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="cardTemplate"
                checked={cardTemplate === "B"}
                onChange={() => setCardTemplate("B")}
              />
              템플릿 B
            </label>
          </div>
        </fieldset>

        <label className="v3-stack">
          <span>제목</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>문구 1줄</span>
          <input
            value={textLine1}
            onChange={(event) => setTextLine1(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <label className="v3-stack">
          <span>문구 2줄</span>
          <input
            value={textLine2}
            onChange={(event) => setTextLine2(event.target.value)}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>

        <label className="v3-stack">
          <span>이미지 (선택)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUploadImage(file);
              }
            }}
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem", background: "#fff" }}
          />
          <p className="v3-muted" style={{ margin: 0 }}>
            {uploadedImage ? "이미지 적용됨 · 테마는 글자 대비용으로만 사용" : uploading ? "업로드 중…" : "없으면 자동 테마 배경"}
          </p>
          {uploadedImage ? (
            <button type="button" className="v3-btn" onClick={clearImage} style={{ alignSelf: "flex-start" }}>
              이미지 제거
            </button>
          ) : null}
        </label>

        <button
          type="button"
          className="v3-btn"
          onClick={() => setShowStyleOptions((v) => !v)}
          style={{ alignSelf: "flex-start", background: "#f4f4f5" }}
        >
          {showStyleOptions ? "스타일 옵션 닫기" : "스타일 변경 (테마)"}
        </button>
        {showStyleOptions ? (
          <fieldset className="v3-stack" style={{ border: "1px dashed #ccc", padding: "0.75rem", borderRadius: "0.4rem" }}>
            <legend className="v3-muted" style={{ fontSize: "0.8rem" }}>
              테마
            </legend>
            <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
              {(["dark", "light", "natural"] as const).map((th) => (
                <label key={th} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                  <input type="radio" name="theme" checked={themeType === th} onChange={() => setThemeType(th)} />
                  {th === "dark" ? "Dark" : th === "light" ? "Light" : "Natural"}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {tournamentStatusForPreview ? (
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            상태: <strong>{tournamentStatusForPreview}</strong> (대회 관리에서 변경)
          </p>
        ) : null}

        <section className="v3-box v3-stack" style={{ background: "#fafafa" }}>
          <p style={{ fontWeight: 700, margin: 0 }}>미리보기</p>
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.78rem" }}>
            저장 후 사이트 메인 슬라이드에 반영됩니다 (게시 시).
          </p>
          <div
            style={{
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid #e4e4e7",
              maxWidth: "360px",
            }}
          >
            <div className={deckStyles.slideDeckCard} style={{ width: "100%", maxWidth: "min(90%, 387px)" }}>
              <SlideDeckCard item={cardPublishSlidePreview} />
            </div>
          </div>
        </section>

        <div className="v3-row">
          <button type="submit" className="v3-btn" disabled={loading}>
            {loading ? "처리 중…" : "저장"}
          </button>
        </div>
      </form>

      {message ? <p className="v3-muted">{message}</p> : null}
    </main>
  );
}
