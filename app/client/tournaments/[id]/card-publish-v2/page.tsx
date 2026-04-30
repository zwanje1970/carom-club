"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SLIDE_DECK_SOLID_BACKDROPS,
  TournamentSnapshotCardView,
  type SlideDeckItem,
  type TournamentCardSurfaceLayout,
} from "../../../../site/tournament-snapshot-card-view";
import {
  POSTCARD_TEMPLATE_APP_DEFAULTS,
  POSTCARD_TEMPLATE_TEXT_COLOR_SWATCHES,
} from "../../../../../lib/postcard-template-reference";
import editorStyles from "../card-publish-editor.module.css";

const DESCRIPTION_MAX_LINES = 3;

/** 제목 위 / 제목 / 설명 글자색 — `carom-postcard-template-test/src/App.tsx` 와 동일 */
const CARD_TEXT_COLOR_SWATCHES = POSTCARD_TEMPLATE_TEXT_COLOR_SWATCHES;

function TextColorSwatches({
  value,
  onChange,
  wrapClass,
  swatchClass,
  swatchLightClass,
  swatchSelectedClass,
}: {
  value: string;
  onChange: (next: string) => void;
  wrapClass: string;
  swatchClass: string;
  swatchLightClass: string;
  swatchSelectedClass: string;
}) {
  return (
    <div className={wrapClass} role="group" aria-label="글자색">
      {CARD_TEXT_COLOR_SWATCHES.map((hex) => {
        const selected = value.trim().toLowerCase() === hex.toLowerCase();
        const isLight = hex.toLowerCase() === "#ffffff";
        return (
          <button
            key={hex}
            type="button"
            className={`${swatchClass} ${isLight ? swatchLightClass : ""} ${selected ? swatchSelectedClass : ""}`}
            style={{ backgroundColor: hex }}
            aria-label={`색 ${hex}`}
            aria-pressed={selected}
            onClick={() => onChange(selected ? "" : hex)}
          />
        );
      })}
    </div>
  );
}

/** 카드 배경색 팔레트 (32색, 8×4 · 흰색 포함) — 목록에 없는 저장값도 `mediaBackground` 그대로 미리보기·저장됨 */
const CARD_COLOR_PALETTE_32 = [
  "#FFFFFF",
  "#F3F4F6",
  "#9CA3AF",
  "#6B7280",
  "#374151",
  "#171717",
  "#FECACA",
  "#DC2626",
  "#FDBA74",
  "#EA580C",
  "#FDE68A",
  "#EAB308",
  "#CA8A04",
  "#BBF7D0",
  "#84CC16",
  "#4ADE80",
  "#16A34A",
  "#6EE7B7",
  "#14B8A6",
  "#22D3EE",
  "#38BDF8",
  "#0EA5E9",
  "#60A5FA",
  "#2563EB",
  "#1E40AF",
  "#1E3A8A",
  "#818CF8",
  "#6366F1",
  "#A78BFA",
  "#9333EA",
  "#F0ABFC",
  "#EC4899",
] as const;

/** 신규 작성·저장 스냅샷 없을 때 미리보기·팔레트 기본(32색 중 하늘색) */
const DEFAULT_CARD_MEDIA_BACKGROUND = "#38BDF8";

/** 배경 이미지 `<img>` opacity — 슬라이더 100%에 대응(완전 불투명) */
const DEFAULT_BG_IMAGE_OVERLAY_OPACITY = 1;

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
  cardExtraLine3?: string | null;
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
  cardLeadTextColor?: string | null;
  cardTitleTextColor?: string | null;
  cardDescriptionTextColor?: string | null;
  tournamentCardTextShadowEnabled?: boolean;
  tournamentCardSurfaceLayout?: TournamentCardSurfaceLayout;
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
  publishedCardImageUrl?: string | null;
  publishedCardImage320Url?: string | null;
};

function hasStoredV2Media(pick: SnapshotPick): boolean {
  return (
    typeof pick.tournamentMediaBackground === "string" ||
    typeof pick.tournamentImageOverlayBlend === "boolean" ||
    typeof pick.tournamentImageOverlayOpacity === "number"
  );
}

export default function ClientTournamentCardPublishV2Page() {
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
  const [leadTextColor, setLeadTextColor] = useState("");
  const [titleTextColor, setTitleTextColor] = useState("");
  const [descriptionTextColor, setDescriptionTextColor] = useState("");
  const [themeType, setThemeType] = useState<CardTheme>("dark");
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);

  const [mediaBackground, setMediaBackground] = useState(DEFAULT_CARD_MEDIA_BACKGROUND);
  const [imageOverlayOpacity, setImageOverlayOpacity] = useState(DEFAULT_BG_IMAGE_OVERLAY_OPACITY);
  const [v2MediaMode, setV2MediaMode] = useState<"inherit" | "on">("on");
  const [cardTextShadowEnabled, setCardTextShadowEnabled] = useState(false);
  const [cardSurfaceLayout, setCardSurfaceLayout] = useState<TournamentCardSurfaceLayout>("split");
  const [footerDateTextColor, setFooterDateTextColor] = useState("");
  const [footerPlaceTextColor, setFooterPlaceTextColor] = useState("");

  const [editorTab, setEditorTab] = useState<"background" | "content">("background");

  const [message, setMessage] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** 메인에 노출 중인 게시카드 존재 여부(대회당 1개·재게시 시 덮어쓰기) */
  const [hasLivePublishedCard, setHasLivePublishedCard] = useState(false);

  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const cardPublishCaptureRef = useRef<HTMLDivElement>(null);
  /** 저장/게시 중복 요청 차단 — ref로 동기 가드 */
  const isPublishingRef = useRef(false);

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
      title: title.length > 0 ? title : "(제목)",
      subtitle: subtitle.length ? subtitle : "·",
      statusBadge: tournamentStatusForPreview,
      cardExtraLine1: textLine1.length > 0 ? textLine1 : null,
      cardExtraLine2: textLine2.length > 0 ? textLine2 : null,
      cardExtraLine3: null,
      image320Url: uploadedImage?.w320Url,
      cardTemplate,
      backgroundType,
      themeType,
      mediaBackground: resolvedPreviewMediaBg,
      imageOverlayBlend: true,
      imageOverlayOpacity: v2MediaMode === "on" ? imageOverlayOpacity : DEFAULT_BG_IMAGE_OVERLAY_OPACITY,
      ...(leadTextColor.trim() ? { cardLeadTextColor: leadTextColor.trim() } : {}),
      ...(titleTextColor.trim() ? { cardTitleTextColor: titleTextColor.trim() } : {}),
      ...(descriptionTextColor.trim() ? { cardDescriptionTextColor: descriptionTextColor.trim() } : {}),
      ...(cardTextShadowEnabled ? { cardTextShadowEnabled: true } : {}),
      ...(cardSurfaceLayout === "full" ? { cardSurfaceLayout: "full" as const } : {}),
      ...(footerDateTextColor.trim() ? { cardFooterDateTextColor: footerDateTextColor.trim() } : {}),
      ...(footerPlaceTextColor.trim() ? { cardFooterPlaceTextColor: footerPlaceTextColor.trim() } : {}),
    };
    return base;
  }, [
    title,
    cardDate,
    cardPlace,
    tournamentStatusForPreview,
    textLine1,
    textLine2,
    leadTextColor,
    titleTextColor,
    descriptionTextColor,
    cardTextShadowEnabled,
    cardSurfaceLayout,
    footerDateTextColor,
    footerPlaceTextColor,
    uploadedImage?.w320Url,
    cardTemplate,
    backgroundType,
    themeType,
    v2MediaMode,
    mediaBackground,
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

      setHasLivePublishedCard(Boolean(result.activeSnapshot));

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
        const snapRaw = pick.title ?? "";
        setTitle(snapRaw.trim() && snapRaw.trim() !== "(제목)" ? snapRaw : t.title);
        const fromPick1 = pick.cardExtraLine1 ?? "";
        const fromPick2 = pick.cardExtraLine2 ?? "";
        setTextLine1(fromPick1 || summaryLine1);
        setTextLine2(fromPick2 || prizeLine1 || summaryLine2);
        setCardTextShadowEnabled(pick.tournamentCardTextShadowEnabled === true);
        setCardSurfaceLayout(pick.tournamentCardSurfaceLayout === "full" ? "full" : "split");
        setFooterDateTextColor(
          typeof pick.cardFooterDateTextColor === "string" ? pick.cardFooterDateTextColor.trim() : ""
        );
        setFooterPlaceTextColor(
          typeof pick.cardFooterPlaceTextColor === "string" ? pick.cardFooterPlaceTextColor.trim() : ""
        );
        setLeadTextColor(typeof pick.cardLeadTextColor === "string" ? pick.cardLeadTextColor.trim() : "");
        setTitleTextColor(typeof pick.cardTitleTextColor === "string" ? pick.cardTitleTextColor.trim() : "");
        setDescriptionTextColor(
          typeof pick.cardDescriptionTextColor === "string" ? pick.cardDescriptionTextColor.trim() : ""
        );
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
          setImageOverlayOpacity(
            typeof pick.tournamentImageOverlayOpacity === "number"
              ? pick.tournamentImageOverlayOpacity
              : DEFAULT_BG_IMAGE_OVERLAY_OPACITY
          );
        } else {
          setV2MediaMode("inherit");
          setMediaBackground("");
          setImageOverlayOpacity(DEFAULT_BG_IMAGE_OVERLAY_OPACITY);
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
        const sum1 = summaryLine1.trim();
        const sum2 = (prizeLine1 || summaryLine2).trim();
        setTextLine1(sum1 || POSTCARD_TEMPLATE_APP_DEFAULTS.leadText);
        setTextLine2(sum2 || POSTCARD_TEMPLATE_APP_DEFAULTS.descriptionText);
        setLeadTextColor("");
        setTitleTextColor("");
        setDescriptionTextColor("");
        setUploadedImage(null);
        setV2MediaMode("on");
        setMediaBackground(DEFAULT_CARD_MEDIA_BACKGROUND);
        setImageOverlayOpacity(DEFAULT_BG_IMAGE_OVERLAY_OPACITY);
        const d0 = typeof t.date === "string" ? t.date : "";
        const loc0 = typeof t.location === "string" ? t.location : "";
        setCardDate(d0 ? formatCardDateForDisplay(d0) : POSTCARD_TEMPLATE_APP_DEFAULTS.dateText);
        setCardPlace(loc0 ? venueNameOnly(loc0) : POSTCARD_TEMPLATE_APP_DEFAULTS.placeText);
        setCardTextShadowEnabled(false);
        setCardSurfaceLayout("split");
        setFooterDateTextColor("");
        setFooterPlaceTextColor("");
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

  function buildCardPayload(draftOnly: boolean): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
    if (!tournamentId.trim()) return { ok: false, error: "대회 정보가 없습니다." };
    if (!title.trim()) return { ok: false, error: "제목을 입력해 주세요." };
    const body: Record<string, unknown> = {
      tournamentId,
      title,
      textLine1,
      textLine2,
      textLine3: "",
      cardTemplate,
      backgroundType,
      themeType,
      imageId: uploadedImage?.imageId ?? "",
      image320Url: uploadedImage?.w320Url ?? "",
      draftOnly,
      cardDisplayDate: formatCardDateForDisplay(cardDate).trim(),
      cardDisplayLocation: cardPlace.trim(),
      cardTextShadowEnabled,
      cardSurfaceLayout,
      cardFooterDateTextColor: footerDateTextColor.trim() || null,
      cardFooterPlaceTextColor: footerPlaceTextColor.trim() || null,
    };
    if (leadTextColor.trim()) body.cardLeadTextColor = leadTextColor.trim();
    if (titleTextColor.trim()) body.cardTitleTextColor = titleTextColor.trim();
    if (descriptionTextColor.trim()) body.cardDescriptionTextColor = descriptionTextColor.trim();
    if (v2MediaMode === "on") {
      body.mediaBackground = mediaBackground;
      body.imageOverlayBlend = true;
      body.imageOverlayOpacity = imageOverlayOpacity;
    }
    return { ok: true, body };
  }

  function postCardSnapshot(draftOnly: boolean, successMessage: string) {
    if (!tournamentId) return;
    if (isPublishingRef.current) return;
    isPublishingRef.current = true;

    void (async () => {
      if (draftOnly) setSaveBusy(true);
      else setPublishBusy(true);
      setMessage("");
      try {
        const built = buildCardPayload(draftOnly);
        if (!built.ok) {
          setMessage(built.error);
          return;
        }
        let body: Record<string, unknown> = built.body;
        if (!draftOnly) {
          try {
            const el = cardPublishCaptureRef.current;
            if (!el) {
              setMessage("미리보기 카드 영역을 찾을 수 없어 게시 이미지를 만들 수 없습니다.");
              return;
            }
            const { default: html2canvas } = await import("html2canvas");
            const w = Math.max(1, Math.round(el.getBoundingClientRect().width));
            const scale = 640 / w;
            const canvas = await html2canvas(el, {
              scale,
              useCORS: true,
              allowTaint: false,
              backgroundColor: null,
              logging: false,
            });
            const blob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error("이미지 변환에 실패했습니다."))),
                "image/png",
              );
            });
            const formData = new FormData();
            formData.append("file", blob, "published-card.png");
            formData.append("sitePublic", "1");
            formData.append("purpose", "published-card-snapshot");
            const uploadRes = await fetch("/api/upload/image", { method: "POST", body: formData });
            const uploadJson = (await uploadRes.json()) as UploadedImage & { error?: string };
            if (!uploadRes.ok || !uploadJson.w640Url?.trim()) {
              setMessage(uploadJson.error ?? "게시용 이미지 업로드에 실패했습니다.");
              return;
            }
            body = {
              ...body,
              publishedCardImageUrl: uploadJson.w640Url,
              ...(uploadJson.w320Url?.trim() ? { publishedCardImage320Url: uploadJson.w320Url } : {}),
            };
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "게시 이미지를 만들지 못했습니다.");
            return;
          }
        }
        const response = await fetch("/api/client/card-snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          setMessage(result.error ?? (draftOnly ? "저장에 실패했습니다." : "메인 게시에 실패했습니다."));
          return;
        }
        if (!draftOnly) {
          setHasLivePublishedCard(true);
        }
        setMessage(successMessage);
        router.refresh();
      } catch {
        setMessage(draftOnly ? "저장 요청 중 오류가 발생했습니다." : "메인 게시 요청 중 오류가 발생했습니다.");
      } finally {
        if (draftOnly) setSaveBusy(false);
        else setPublishBusy(false);
        isPublishingRef.current = false;
      }
    })();
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
      setImageOverlayOpacity(DEFAULT_BG_IMAGE_OVERLAY_OPACITY);
      activateV2Media();
      setEditorTab("background");
    } catch {
      setMessage("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setUploadedImage(null);
    setImageOverlayOpacity(DEFAULT_BG_IMAGE_OVERLAY_OPACITY);
    setMessage("이미지를 제거했습니다. 테마 배경으로 표시됩니다.");
  }

  function clearBackgroundFileSelection() {
    if (bgFileInputRef.current) bgFileInputRef.current.value = "";
    if (uploadedImage) clearImage();
  }

  return (
    <main
      className="v3-page v3-stack"
      data-card-publish-v2="1"
      style={{ maxWidth: "none", margin: 0, width: "100%" }}
    >
      <div className={editorStyles.pcPageShell}>
        <div className={editorStyles.pcPageMain}>
          <div className={`${editorStyles.pageWrap} ${editorStyles.pageWrapV2}`}>
        <div className={editorStyles.surfaceTemplateRow}>
          <div className={editorStyles.surfaceTemplateTabs} role="radiogroup" aria-label="카드 템플릿">
            <button
              type="button"
              className={`${editorStyles.surfaceTemplateTab} ${cardSurfaceLayout === "split" ? editorStyles.surfaceTemplateTabActive : ""}`}
              aria-pressed={cardSurfaceLayout === "split"}
              onClick={() => setCardSurfaceLayout("split")}
            >
              분리형
            </button>
            <button
              type="button"
              className={`${editorStyles.surfaceTemplateTab} ${cardSurfaceLayout === "full" ? editorStyles.surfaceTemplateTabActive : ""}`}
              aria-pressed={cardSurfaceLayout === "full"}
              onClick={() => setCardSurfaceLayout("full")}
            >
              전체형
            </button>
          </div>
        </div>

        <div className={editorStyles.previewSticky}>
          <div className={editorStyles.previewInner}>
            <div className={editorStyles.previewSlideLayer}>
              <div className={editorStyles.previewCardScaleHost}>
                <div className={editorStyles.previewCardScaleInner}>
                  <div className={editorStyles.previewCardWrap}>
                    <div ref={cardPublishCaptureRef} className={editorStyles.cardPublishCaptureRoot}>
                      <TournamentSnapshotCardView
                        item={cardPublishSlidePreview}
                        slideDeck
                        templateCardLayout
                        editorCompactCardHeight
                        slideDeckSolidBackdrop={SLIDE_DECK_SOLID_BACKDROPS[0]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form
          className={editorStyles.formPanel}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            postCardSnapshot(
              true,
              "카드 초안이 저장되었습니다. 메인에 올리려면 「게시」 또는 대회 상세의 동일 버튼을 누르세요.",
            );
          }}
        >
          <div className={editorStyles.stepTabsWrap}>
            <div className={editorStyles.stepTabs} role="tablist" aria-label="편집 단계">
              <button
                type="button"
                role="tab"
                aria-selected={editorTab === "background"}
                className={`${editorStyles.stepTab} ${editorTab === "background" ? editorStyles.stepTabActive : ""}`}
                onClick={() => setEditorTab("background")}
              >
                배경설정
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={editorTab === "content"}
                className={`${editorStyles.stepTab} ${editorTab === "content" ? editorStyles.stepTabActive : ""}`}
                onClick={() => setEditorTab("content")}
              >
                내용입력
              </button>
            </div>
          </div>

          <div className={editorStyles.formScrollPane}>
          <div className={editorStyles.stepScrollBody}>
          {editorTab === "content" ? (
            <>
              <div className={editorStyles.field}>
                <div className={editorStyles.fieldHead}>
                  <span className={editorStyles.fieldLabel}>제목 위 한 줄</span>
                  <TextColorSwatches
                    value={leadTextColor}
                    onChange={setLeadTextColor}
                    wrapClass={editorStyles.fieldSwatches}
                    swatchClass={editorStyles.fieldSwatch}
                    swatchLightClass={editorStyles.fieldSwatchLight}
                    swatchSelectedClass={editorStyles.fieldSwatchSelected}
                  />
                </div>
                <input
                  className={editorStyles.fieldInput}
                  type="text"
                  value={textLine1}
                  onChange={(e) => setTextLine1(e.target.value)}
                  autoComplete="off"
                  placeholder="비우면 표시 안 함"
                />
              </div>

              <div className={editorStyles.field}>
                <div className={editorStyles.fieldHead}>
                  <span className={editorStyles.fieldLabel}>제목 (1줄)</span>
                  <TextColorSwatches
                    value={titleTextColor}
                    onChange={setTitleTextColor}
                    wrapClass={editorStyles.fieldSwatches}
                    swatchClass={editorStyles.fieldSwatch}
                    swatchLightClass={editorStyles.fieldSwatchLight}
                    swatchSelectedClass={editorStyles.fieldSwatchSelected}
                  />
                </div>
                <input
                  className={editorStyles.fieldInput}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className={editorStyles.field}>
                <div className={editorStyles.fieldHead}>
                  <span className={editorStyles.fieldLabel}>설명 (최대 {DESCRIPTION_MAX_LINES}줄)</span>
                  <TextColorSwatches
                    value={descriptionTextColor}
                    onChange={setDescriptionTextColor}
                    wrapClass={editorStyles.fieldSwatches}
                    swatchClass={editorStyles.fieldSwatch}
                    swatchLightClass={editorStyles.fieldSwatchLight}
                    swatchSelectedClass={editorStyles.fieldSwatchSelected}
                  />
                </div>
                <textarea
                  className={`${editorStyles.fieldInput} ${editorStyles.fieldTextarea} ${editorStyles.fieldTextareaContentTight}`}
                  rows={3}
                  value={textLine2}
                  onChange={(e) =>
                    setTextLine2(clampDescriptionToMaxLines(e.target.value, DESCRIPTION_MAX_LINES))
                  }
                  spellCheck={false}
                  placeholder="비우면 카드에 표시하지 않음"
                />
              </div>

              <div className={editorStyles.field}>
                <div className={editorStyles.fieldHead}>
                  <span className={editorStyles.fieldLabel}>날짜</span>
                  <TextColorSwatches
                    value={footerDateTextColor}
                    onChange={setFooterDateTextColor}
                    wrapClass={editorStyles.fieldSwatches}
                    swatchClass={editorStyles.fieldSwatch}
                    swatchLightClass={editorStyles.fieldSwatchLight}
                    swatchSelectedClass={editorStyles.fieldSwatchSelected}
                  />
                </div>
                <input
                  className={`${editorStyles.fieldInput} ${editorStyles.fieldInputContentTight}`}
                  type="text"
                  value={cardDate}
                  onChange={(e) => setCardDate(e.target.value)}
                  autoComplete="off"
                  placeholder="예: 2026-05-09 (일)"
                />
              </div>

              <div className={editorStyles.field}>
                <div className={editorStyles.fieldHead}>
                  <span className={editorStyles.fieldLabel}>장소</span>
                  <TextColorSwatches
                    value={footerPlaceTextColor}
                    onChange={setFooterPlaceTextColor}
                    wrapClass={editorStyles.fieldSwatches}
                    swatchClass={editorStyles.fieldSwatch}
                    swatchLightClass={editorStyles.fieldSwatchLight}
                    swatchSelectedClass={editorStyles.fieldSwatchSelected}
                  />
                </div>
                <input
                  className={`${editorStyles.fieldInput} ${editorStyles.fieldInputContentTight}`}
                  type="text"
                  value={cardPlace}
                  onChange={(e) => setCardPlace(e.target.value)}
                  autoComplete="off"
                  placeholder="예: 캐롬클럽 빌리어즈"
                />
              </div>

              <label className={editorStyles.fieldCheck}>
                <input
                  type="checkbox"
                  checked={cardTextShadowEnabled}
                  onChange={(e) => setCardTextShadowEnabled(e.target.checked)}
                />
                <span>전체 글자에 그림자 넣기</span>
              </label>
            </>
          ) : (
            <>
              <div className={editorStyles.field}>
                <span className={editorStyles.fieldLabel}>카드 배경색</span>
                <div className={editorStyles.colorPaletteGrid}>
                  {CARD_COLOR_PALETTE_32.map((hex, index) => {
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
                {uploading ? (
                  <p className="v3-muted" style={{ margin: 0, fontSize: "0.78rem" }}>
                    업로드 중…
                  </p>
                ) : null}
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
                    disabled={!uploadedImage}
                    aria-label="배경그림 투명도"
                    onChange={(e) => {
                      activateV2Media();
                      setImageOverlayOpacity(Number(e.target.value) / 100);
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div className={editorStyles.actions}>
            <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <button type="submit" className="v3-btn" disabled={saveBusy || publishBusy}>
                {saveBusy ? "저장 중" : "저장"}
              </button>
              <button
                type="button"
                className="v3-btn"
                disabled={saveBusy || publishBusy}
                onClick={() =>
                  postCardSnapshot(
                    false,
                    hasLivePublishedCard
                      ? "게시카드가 갱신되어 메인에 반영되었습니다."
                      : "메인에 게시되었습니다. 사이트에 반영되었습니다.",
                  )
                }
              >
                {publishBusy ? "게시 중" : "게시"}
              </button>
            </div>
          </div>
          </div>
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
