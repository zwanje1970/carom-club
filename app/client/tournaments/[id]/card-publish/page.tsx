"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TournamentSnapshotCardView,
  type SlideDeckItem,
} from "../../../../site/tournament-snapshot-card-view";
import editorStyles from "../card-publish-editor.module.css";

const DESCRIPTION_MAX_LINES = 5;

/** 백색 글자 대비용 고정 64색 (8×8 그리드) */
const CARD_COLOR_PALETTE_64 = [
  // Red
  "#7F1D1D",
  "#991B1B",
  "#B91C1C",
  "#DC2626",
  "#7C2D12",
  "#9A3412",
  "#C2410C",
  "#EA580C",
  // Brown
  "#78350F",
  "#92400E",
  "#B45309",
  "#D97706",
  "#7C3E0A",
  "#9C4F0D",
  "#C4660F",
  "#E07A12",
  // Green
  "#064E3B",
  "#065F46",
  "#047857",
  "#059669",
  "#14532D",
  "#166534",
  "#15803D",
  "#16A34A",
  // Teal
  "#134E4A",
  "#115E59",
  "#0F766E",
  "#0D9488",
  "#164E63",
  "#155E75",
  "#0E7490",
  "#0891B2",
  // Blue
  "#1E3A8A",
  "#1D4ED8",
  "#2563EB",
  "#1E40AF",
  "#1E293B",
  "#334155",
  "#0F172A",
  "#1F2937",
  // Indigo / Purple
  "#312E81",
  "#3730A3",
  "#4338CA",
  "#4F46E5",
  "#581C87",
  "#6B21A8",
  "#7E22CE",
  "#9333EA",
  // Pink / Rose (어두운 톤만)
  "#881337",
  "#9F1239",
  "#BE123C",
  "#E11D48",
  "#831843",
  "#9D174D",
  "#BE185D",
  "#DB2777",
  // Gray (밝은 회색 제외)
  "#111827",
  "#1F2937",
  "#374151",
  "#4B5563",
  "#030712",
  "#020617",
  "#111827",
  "#0B1220",
] as const;

const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** `2026-05-09 (일)` — 저장/미리보기 입력값과 동일 형식 */
function formatCardDateForDisplay(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const withoutWeek = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const m = withoutWeek.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  let d: Date | null = null;
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    const cand = new Date(y, mo - 1, da);
    if (
      cand.getFullYear() === y &&
      cand.getMonth() === mo - 1 &&
      cand.getDate() === da
    ) {
      d = cand;
    }
  }
  if (!d) {
    const t = Date.parse(withoutWeek.replace(/\./g, "-"));
    if (!Number.isNaN(t)) d = new Date(t);
  }
  if (!d || Number.isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da} (${KO_WEEKDAYS[d.getDay()]})`;
}

/** 당구장명만: 첫 줄 → 한 줄이면 `상호 / 주소`에서 앞부분만 → 쉼표 앞만. 빈 값은 "" */
function venueNameOnly(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  s = s.split(/\r?\n/)[0].trim();
  const slashPart = s.split(/\s*\/\s*/)[0]?.trim() ?? "";
  if (slashPart) s = slashPart;
  const comma = s.indexOf(",");
  if (comma > 0) {
    s = s.slice(0, comma).trim();
  }
  return s;
}

function clampDescriptionToMaxLines(value: string, maxLines: number): string {
  const lines = value.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
}

function firstNonEmptyLine(raw: string | null | undefined): string {
  if (raw == null) return "";
  for (const line of String(raw).split(/\r?\n/)) {
    const t = line.trim();
    if (t) return t;
  }
  return "";
}

function secondNonEmptyLine(raw: string | null | undefined): string {
  if (raw == null) return "";
  let seen = false;
  for (const line of String(raw).split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (!seen) {
      seen = true;
      continue;
    }
    return t;
  }
  return "";
}

function isUsableSnapshotTitle(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  return t.length > 0 && t !== "(제목)";
}

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
  summary?: string | null;
  prizeInfo?: string | null;
};

type SnapshotPick = {
  title?: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  tournamentCardTemplate?: "A" | "B";
  tournamentTheme?: "dark" | "light" | "natural";
  tournamentBackgroundType?: "image" | "theme";
  image320Url?: string;
  imageId?: string;
  image640Url?: string;
  tournamentMediaBackground?: string | null;
  tournamentImageOverlayBlend?: boolean | null;
  tournamentImageOverlayOpacity?: number | null;
  tournamentCardDisplayDate?: string | null;
  tournamentCardDisplayLocation?: string | null;
};

function hasStoredV2Media(pick: SnapshotPick): boolean {
  return (
    typeof pick.tournamentMediaBackground === "string" ||
    typeof pick.tournamentImageOverlayBlend === "boolean" ||
    typeof pick.tournamentImageOverlayOpacity === "number"
  );
}

export default function ClientTournamentCardPublishPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);

  const [tournamentStatusForPreview, setTournamentStatusForPreview] = useState("");
  const [cardDate, setCardDate] = useState("");
  const [cardPlace, setCardPlace] = useState("");
  const [cardTemplate, setCardTemplate] = useState<CardTemplate>("A");
  const [title, setTitle] = useState("");
  const [textLine1, setTextLine1] = useState("");
  const [textLine2, setTextLine2] = useState("");
  const [themeType, setThemeType] = useState<CardTheme>("dark");
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);

  const [mediaBackground, setMediaBackground] = useState("");
  const [imageOverlayBlend, setImageOverlayBlend] = useState(true);
  const [imageOverlayOpacity, setImageOverlayOpacity] = useState(0.78);
  const [v2MediaMode, setV2MediaMode] = useState<"inherit" | "on">("on");

  const [editorStep, setEditorStep] = useState<1 | 2>(1);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const backgroundType = uploadedImage ? "image" : "theme";

  /** 배경색·배경 이미지 미설정 시 미리보기 기본(짙은 청색)만 — 저장 payload는 그대로 */
  const DEFAULT_PREVIEW_MEDIA_BG = "#0f2747";

  const cardPublishSlidePreview: SlideDeckItem = useMemo(() => {
    const datePart = formatCardDateForDisplay(cardDate) || cardDate.trim() || "-";
    const placePart = venueNameOnly(cardPlace) || "-";
    const subtitle = `${datePart} · ${placePart}`;
    const noBgImage = !uploadedImage?.w320Url;
    const noCssBg = !(mediaBackground || "").trim();
    const resolvedPreviewMediaBg =
      noBgImage && noCssBg ? DEFAULT_PREVIEW_MEDIA_BG : mediaBackground.trim();
    const base: SlideDeckItem = {
      snapshotId: "card-publish-preview",
      title: title.trim() || "(제목)",
      subtitle: subtitle.length ? subtitle : "·",
      statusBadge: tournamentStatusForPreview,
      cardExtraLine1: textLine1 || null,
      cardExtraLine2: textLine2 || null,
      image320Url: uploadedImage?.w320Url,
      cardTemplate,
      backgroundType,
      themeType,
      mediaBackground: resolvedPreviewMediaBg,
      imageOverlayBlend: v2MediaMode === "on" ? imageOverlayBlend : true,
      imageOverlayOpacity: v2MediaMode === "on" ? imageOverlayOpacity : 1,
    };
    return base;
  }, [
    title,
    cardDate,
    cardPlace,
    tournamentStatusForPreview,
    textLine1,
    textLine2,
    uploadedImage?.w320Url,
    cardTemplate,
    backgroundType,
    themeType,
    v2MediaMode,
    mediaBackground,
    imageOverlayBlend,
    imageOverlayOpacity,
  ]);

  function activateV2Media() {
    setV2MediaMode("on");
  }

  const loadSnapshots = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const response = await fetch(`/api/client/card-snapshots?tournamentId=${encodeURIComponent(tournamentId)}`);
      const result = (await response.json()) as {
        snapshots?: SnapshotPick[];
        activeSnapshot?: SnapshotPick | null;
        tournament?: TournamentSummary;
        error?: string;
      };
      if (!response.ok) {
        setMessage(result.error ?? "카드 정보를 불러오지 못했습니다.");
        return;
      }

      const t = result.tournament;
      if (!t) return;

      setTournamentStatusForPreview(
        typeof t.statusBadge === "string" && t.statusBadge.trim() ? t.statusBadge.trim() : ""
      );

      const summaryLine1 = firstNonEmptyLine(t.summary);
      const summaryLine2 = secondNonEmptyLine(t.summary);
      const prizeLine1 = firstNonEmptyLine(t.prizeInfo);

      const newest = result.snapshots?.[0];
      const active = result.activeSnapshot;
      const pick =
        newest && isUsableSnapshotTitle(newest.title)
          ? newest
          : active && isUsableSnapshotTitle(active.title)
            ? active
            : null;
      if (pick) {
        const snapTitle = (pick.title ?? "").trim();
        setTitle(snapTitle && snapTitle !== "(제목)" ? snapTitle : t.title);
        const fromPick1 = (pick.cardExtraLine1 ?? "").trim();
        const fromPick2 = (pick.cardExtraLine2 ?? "").trim();
        setTextLine1(fromPick1 || summaryLine1);
        setTextLine2(fromPick2 || prizeLine1 || summaryLine2);
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
        if (hasStoredV2Media(pick)) {
          setV2MediaMode("on");
          setMediaBackground(typeof pick.tournamentMediaBackground === "string" ? pick.tournamentMediaBackground : "");
          setImageOverlayBlend(
            typeof pick.tournamentImageOverlayBlend === "boolean" ? pick.tournamentImageOverlayBlend : true
          );
          setImageOverlayOpacity(
            typeof pick.tournamentImageOverlayOpacity === "number" ? pick.tournamentImageOverlayOpacity : 0.78
          );
        } else {
          setV2MediaMode("inherit");
          setMediaBackground("");
          setImageOverlayBlend(false);
          setImageOverlayOpacity(1);
        }
        const storedDate =
          typeof pick.tournamentCardDisplayDate === "string" ? pick.tournamentCardDisplayDate.trim() : "";
        const dRaw = storedDate || (typeof t.date === "string" ? t.date : "");
        const storedLoc =
          typeof pick.tournamentCardDisplayLocation === "string" ? pick.tournamentCardDisplayLocation.trim() : "";
        const locRaw = storedLoc || (typeof t.location === "string" ? t.location : "");
        setCardDate(dRaw ? formatCardDateForDisplay(dRaw) : "");
        setCardPlace(locRaw ? venueNameOnly(locRaw) : "");
      } else {
        setTitle(t.title);
        setTextLine1(summaryLine1);
        setTextLine2(prizeLine1 || summaryLine2);
        setUploadedImage(null);
        setV2MediaMode("on");
        setMediaBackground("");
        setImageOverlayBlend(true);
        setImageOverlayOpacity(0.78);
        const d0 = typeof t.date === "string" ? t.date : "";
        const loc0 = typeof t.location === "string" ? t.location : "";
        setCardDate(d0 ? formatCardDateForDisplay(d0) : "");
        setCardPlace(loc0 ? venueNameOnly(loc0) : "");
      }
    } catch {
      setMessage("카드 정보를 불러오는 중 오류가 발생했습니다.");
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
      const body: Record<string, unknown> = {
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
        cardDisplayDate: formatCardDateForDisplay(cardDate).trim(),
        cardDisplayLocation: cardPlace.trim(),
      };
      if (v2MediaMode === "on") {
        body.mediaBackground = mediaBackground;
        body.imageOverlayBlend = imageOverlayBlend;
        body.imageOverlayOpacity = imageOverlayOpacity;
      }
      const response = await fetch("/api/client/card-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      /** 메인 슬라이드 등 공개 페이지에서 `/site-images/...` 로 노출되도록 */
      formData.append("sitePublic", "1");
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
      activateV2Media();
      setEditorStep(2);
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

  function clearBackgroundFileSelection() {
    if (bgFileInputRef.current) bgFileInputRef.current.value = "";
    if (uploadedImage) clearImage();
  }

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "none", margin: 0, width: "100%" }}>
      <div className={editorStyles.pcPageShell}>
        <div className={editorStyles.pcPageMain}>
          <h1 className="v3-h1" style={{ paddingLeft: "0.75rem", paddingRight: "0.75rem" }}>
            게시카드 작성
          </h1>

          <div className={editorStyles.pageWrap}>
        <div className={editorStyles.previewSticky}>
          <div className={editorStyles.previewInner}>
            <div className={editorStyles.previewCardWrap}>
              <TournamentSnapshotCardView item={cardPublishSlidePreview} />
            </div>
            <div className={editorStyles.templateRadioRow} role="radiogroup" aria-label="슬라이드 템플릿">
              <label className={editorStyles.templateRadioLabel}>
                <input
                  type="radio"
                  name="cardPublishCardTemplate"
                  value="A"
                  checked={cardTemplate === "A"}
                  onChange={() => setCardTemplate("A")}
                />
                좌측 정렬형
              </label>
              <label className={editorStyles.templateRadioLabel}>
                <input
                  type="radio"
                  name="cardPublishCardTemplate"
                  value="B"
                  checked={cardTemplate === "B"}
                  onChange={() => setCardTemplate("B")}
                />
                가운데 정렬형
              </label>
            </div>
          </div>
        </div>

        <form className={editorStyles.formPanel} onSubmit={handlePublish}>
          <div className={editorStyles.stepTabs} role="tablist" aria-label="편집 단계">
            <button
              type="button"
              role="tab"
              aria-selected={editorStep === 1}
              className={`${editorStyles.stepTab} ${editorStep === 1 ? editorStyles.stepTabActive : ""}`}
              onClick={() => setEditorStep(1)}
            >
              1. 내용 입력
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorStep === 2}
              className={`${editorStyles.stepTab} ${editorStep === 2 ? editorStyles.stepTabActive : ""}`}
              onClick={() => setEditorStep(2)}
            >
              2. 배경 설정
            </button>
          </div>

          {editorStep === 1 ? (
            <>
              <label className={editorStyles.field}>
                <span className={editorStyles.fieldLabel}>제목 위 한 줄</span>
                <input
                  className={editorStyles.fieldInput}
                  type="text"
                  value={textLine1}
                  onChange={(e) => setTextLine1(e.target.value)}
                  autoComplete="off"
                  placeholder="비우면 표시 안 함"
                />
              </label>

              <label className={editorStyles.field}>
                <span className={editorStyles.fieldLabel}>제목 (1줄)</span>
                <input
                  className={editorStyles.fieldInput}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>

              <label className={editorStyles.field}>
                <span className={editorStyles.fieldLabel}>
                  설명 (최대 {DESCRIPTION_MAX_LINES}줄 · Enter 줄바꿈)
                </span>
                <textarea
                  className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea}`}
                  rows={5}
                  value={textLine2}
                  onChange={(e) =>
                    setTextLine2(clampDescriptionToMaxLines(e.target.value, DESCRIPTION_MAX_LINES))
                  }
                  spellCheck={false}
                  placeholder="비우면 카드에 표시하지 않음"
                />
              </label>

              <label className={editorStyles.field}>
                <span className={editorStyles.fieldLabel}>날짜</span>
                <input
                  className={editorStyles.fieldInput}
                  type="text"
                  value={cardDate}
                  onChange={(e) => setCardDate(e.target.value)}
                  autoComplete="off"
                  placeholder="예: 2026-05-09 (일)"
                />
              </label>

              <label className={editorStyles.field}>
                <span className={editorStyles.fieldLabel}>장소</span>
                <input
                  className={editorStyles.fieldInput}
                  type="text"
                  value={cardPlace}
                  onChange={(e) => setCardPlace(e.target.value)}
                  autoComplete="off"
                  placeholder="예: 캐롬클럽 빌리어즈"
                />
              </label>
            </>
          ) : (
            <>
              <div className={editorStyles.field}>
                <span className={editorStyles.fieldLabel}>카드 배경색</span>
                <div
                  className="card-publish-color-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(8, 34px)",
                    gap: "7px",
                    justifyContent: "center",
                    width: "100%",
                    maxWidth: "max-content",
                    margin: "0.35rem auto 0",
                  }}
                >
                  {CARD_COLOR_PALETTE_64.map((hex, index) => {
                    const selected = mediaBackground.trim().toLowerCase() === hex.toLowerCase();
                    return (
                      <button
                        key={`card-color-${index}-${hex}`}
                        type="button"
                        aria-label={`배경색 ${hex}`}
                        className="card-publish-color-swatch"
                        style={{
                          width: 34,
                          height: 34,
                          padding: 0,
                          border: "none",
                          borderRadius: 7,
                          backgroundColor: hex,
                          cursor: "pointer",
                          boxSizing: "border-box",
                          outline: selected ? "2px solid #ffffff" : "none",
                          boxShadow: selected ? "0 0 0 2px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.25)" : "none",
                        }}
                        onClick={() => {
                          activateV2Media();
                          setMediaBackground(hex);
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className={editorStyles.field}>
                <span className={editorStyles.fieldLabel}>배경 이미지</span>
                <div className={editorStyles.bgRow}>
                  <input
                    ref={bgFileInputRef}
                    className={editorStyles.fieldFile}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleUploadImage(file);
                    }}
                  />
                  <button
                    type="button"
                    className={editorStyles.clearBtn}
                    style={{ marginTop: 0 }}
                    onClick={clearBackgroundFileSelection}
                  >
                    선택해제
                  </button>
                </div>
                {uploadedImage || uploading ? (
                  <p className="v3-muted" style={{ margin: 0, fontSize: "0.78rem" }}>
                    {uploadedImage ? "이미지 적용됨" : "업로드 중…"}
                  </p>
                ) : null}
                <label className={editorStyles.fieldCheck}>
                  <input
                    type="checkbox"
                    checked={imageOverlayBlend}
                    disabled={!uploadedImage}
                    onChange={(e) => {
                      activateV2Media();
                      setImageOverlayBlend(e.target.checked);
                    }}
                  />
                  <span>이미지 오버레이 (배경색 위에 반투명으로 겹침 · 끄면 이미지 불투명)</span>
                </label>
                <div className={editorStyles.rangeBlock}>
                  <span className={`${editorStyles.fieldLabel} ${editorStyles.fieldLabelRow}`}>
                    배경그림 투명도
                    <output className={editorStyles.rangeOut}>{Math.round(imageOverlayOpacity * 100)}%</output>
                  </span>
                  <input
                    className={editorStyles.range}
                    type="range"
                    min={15}
                    max={100}
                    step={1}
                    value={Math.round(imageOverlayOpacity * 100)}
                    disabled={!uploadedImage || !imageOverlayBlend}
                    aria-label="배경그림 투명도"
                    onChange={(e) => {
                      activateV2Media();
                      setImageOverlayOpacity(Number(e.target.value) / 100);
                    }}
                  />
                  <p className={editorStyles.microhint}>
                    낮추면 배경이 더 보이고, 높이면 이미지가 진해집니다.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className={editorStyles.actions}>
            <button type="submit" className="v3-btn" disabled={loading}>
              {loading ? "처리 중…" : "저장"}
            </button>
          </div>
        </form>
          </div>

          {message ? (
            <p className="v3-muted" style={{ paddingLeft: "0.75rem" }}>
              {message}
            </p>
          ) : null}
        </div>
        <aside className={editorStyles.pcPageAside} aria-hidden="true" />
      </div>
    </main>
  );
}
