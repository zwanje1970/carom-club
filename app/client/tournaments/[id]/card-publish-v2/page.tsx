"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { publishTournamentCardFromEditorClient } from "../tournament-card-client-publish";
import type { TournamentCardSurfaceLayout } from "../../../../site/tournament-snapshot-card-view";
import { POSTCARD_TEMPLATE_APP_DEFAULTS } from "../../../../../lib/postcard-template-reference";
import editorStyles from "../card-publish-editor.module.css";
import { ClientBlockingStatusOverlay } from "../../../components/ClientBlockingStatusOverlay";
import { useClientTournamentFormKeyboardScroll } from "../../client-tournament-form-keyboard-scroll";
import { CardPublishBackgroundTab, CardPublishContentTab } from "./CardPublishEditorFormParts";
import { normalizeCardEditorBackgroundUpload } from "./normalize-card-editor-background-upload";
import { CardPublishPreview, type CardPublishPreviewModel } from "./CardPublishPreview";

/** 신규 작성·저장 스냅샷 없을 때 미리보기·팔레트 기본(32색 중 하늘색) */
const DEFAULT_CARD_MEDIA_BACKGROUND = "#38BDF8";

/** 배경 이미지 `<img>` opacity — 슬라이더 100%에 대응(완전 불투명) */
const DEFAULT_BG_IMAGE_OVERLAY_OPACITY = 1;

const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 모집중 게시 단계형 진행(단계 전환 시에만 % 변경, 타이머 가짜 증가 없음). */
const PUBLISH_PROGRESS_DRAFT_SAVE = {
  percent: 20,
  label: "초안 저장 중",
};
const PUBLISH_PROGRESS_STATUS_PATCH = {
  percent: 40,
  label: "대회 상태 변경 중",
};
const PUBLISH_PROGRESS_CARD_IMAGE = {
  percent: 70,
  label: "카드 이미지 생성 중",
  hint: "카드 이미지 생성 중입니다. 잠시만 기다려 주세요.",
};
const PUBLISH_PROGRESS_MAIN_SAVE = {
  percent: 90,
  label: "게시 데이터 저장 중",
};
const PUBLISH_PROGRESS_DONE = {
  percent: 100,
  label: "게시 완료",
};
const PUBLISH_FLOW_FAIL_KO = "게시 이미지 생성 또는 저장에 실패했습니다. 다시 게시해 주세요.";
const PUBLISH_DRAFT_SAVE_FAIL_KO = "초안 저장에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.";
const PUBLISH_STATUS_PATCH_FAIL_KO = PUBLISH_FLOW_FAIL_KO;

type PublishFlowState = { percent: number; label: string; hint?: string };

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

function formatPrizeValueWithManwon(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d+$/.test(t)) return `${t}만원`;
  if (/만원$/.test(t)) return t;
  return t;
}

function buildPrizeInfoSingleLine(raw: string | null | undefined): string {
  if (!raw) return "";
  const labels: Array<"우승" | "준우승" | "공동 3위" | "3위" | "4위"> = ["우승", "준우승", "공동 3위", "3위", "4위"];
  const byLabel = new Map<string, string>();
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = /^(우승|준우승|공동\s*3(?:위|등)|3(?:위|등)|4(?:위|등))\s*:\s*(.+)$/.exec(trimmed);
    if (!m) continue;
    const rawLabel = m[1] ?? "";
    const label =
      /^공동/.test(rawLabel) ? "공동 3위" : /^3(?:위|등)$/.test(rawLabel) ? "3위" : /^4(?:위|등)$/.test(rawLabel) ? "4위" : (rawLabel as "우승" | "준우승");
    const value = formatPrizeValueWithManwon(m[2] ?? "");
    if (!value) continue;
    if (!byLabel.has(label)) byLabel.set(label, value);
  }
  const out: string[] = [];
  for (const label of labels) {
    const value = byLabel.get(label);
    if (value) out.push(`${label}: ${value}`);
  }
  return out.join(" ");
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

function isBrowserLocalImageSrc(src: string): boolean {
  const s = src.trim();
  return s.startsWith("blob:") || s.startsWith("data:");
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

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
  cardTitleEffect?: "none" | "shadow" | "outline" | "shadow_outline";
  cardTitleOutlineColor?: "black" | "white" | null;
  tournamentCardSurfaceLayout?: TournamentCardSurfaceLayout;
  cardBottomBarColor?: string | null;
  cardBottomBarOpacity?: number | null;
  cardGradientPreset?: "none" | "top" | "left" | "top_left" | "soft";
  cardGradientOpacity?: number | null;
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
  publishedCardImageUrl?: string | null;
  publishedCardImage320Url?: string | null;
};

function pickStoredImageFromSnapshot(pick: SnapshotPick): UploadedImage | null {
  const bgType = pick.tournamentBackgroundType === "theme" ? "theme" : "image";
  if (bgType !== "image") return null;

  const imageId = typeof pick.imageId === "string" ? pick.imageId.trim() : "";
  const image320 = typeof pick.image320Url === "string" ? pick.image320Url.trim() : "";
  const image640 = typeof pick.image640Url === "string" ? pick.image640Url.trim() : "";
  if (!imageId || !image320) return null;

  return {
    imageId,
    w320Url: image320,
    w640Url: image640 || image320,
  };
}

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

  const tournamentFormKeyboardRootRef = useRef<HTMLElement | null>(null);
  useClientTournamentFormKeyboardScroll(tournamentFormKeyboardRootRef);

  /** 게시 화면 전용 미리보기 배지(모집중 공개 vs 임시저장) */
  const [publishIntent, setPublishIntent] = useState<"recruiting" | "draft">("recruiting");
  const [cardDate, setCardDate] = useState("");
  const [cardPlace, setCardPlace] = useState("");
  const cardTemplate = "A" as const;
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
  const [cardTextShadowEnabled] = useState(false);
  const [cardSurfaceLayout] = useState<TournamentCardSurfaceLayout>("split");
  const [cardTitleEffect, setCardTitleEffect] = useState<"none" | "shadow" | "outline" | "shadow_outline">("none");
  const [cardTitleOutlineColor, setCardTitleOutlineColor] = useState<"black" | "white">("black");
  const [bottomBarColor, setBottomBarColor] = useState("#ffffff");
  const [bottomBarOpacity, setBottomBarOpacity] = useState(1);
  const [gradientPreset, setGradientPreset] = useState<"none" | "top" | "left" | "top_left" | "soft">("none");
  const [gradientOpacity, setGradientOpacity] = useState(0);
  const [footerDateTextColor, setFooterDateTextColor] = useState("");
  const [footerPlaceTextColor, setFooterPlaceTextColor] = useState("");

  const [editorTab, setEditorTab] = useState<"background" | "content">("background");

  const [message, setMessage] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishCompleteModalOpen, setPublishCompleteModalOpen] = useState(false);
  /** 모집중 게시 진행(단계형 % + 문구) */
  const [publishFlow, setPublishFlow] = useState<PublishFlowState | null>(null);
  const [publishFlowError, setPublishFlowError] = useState("");
  /** `loadSnapshots` 기준 대회 배지 — 게시 실패 시 PATCH 롤백용 */
  const [tournamentStatusBadge, setTournamentStatusBadge] = useState("");
  const [uploading, setUploading] = useState(false);

  const bgFileInputRef = useRef<HTMLInputElement>(null);
  /** 저장 중복 요청 차단 — ref로 동기 가드 */
  const saveInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const captureImageObjectUrlRef = useRef<string | null>(null);
  const userEditedTextLine2Ref = useRef(false);
  const prizeAutoSeededRef = useRef(false);
  /** 모집중 게시 시 브라우저 PNG 캡처 대상 — `CardPublishPreview` 아트보드 루트 */
  const cardPublishPreviewCaptureRef = useRef<HTMLDivElement>(null);
  /** 캡처용 미리보기 `<img src>` — 저장 URL과 분리된 브라우저 로컬 소스(blob/data). */
  const [captureImageSrc, setCaptureImageSrc] = useState("");

  const handleTextLine2Change = useCallback((next: string) => {
    userEditedTextLine2Ref.current = true;
    setTextLine2(next);
  }, []);

  const backgroundType = uploadedImage ? "image" : "theme";

  /** 배경색·배경 이미지 미설정 시 미리보기 기본(짙은 청색)만 — 저장 payload는 그대로 */
  const DEFAULT_PREVIEW_MEDIA_BG = "#0f2747";

  const previewModel: CardPublishPreviewModel = useMemo(() => {
    const datePart = formatCardDateForDisplay(cardDate) || cardDate.trim() || "-";
    const placePart = venueNameOnly(cardPlace) || "-";
    const subtitle = `${datePart} · ${placePart}`;
    const previewImageSrc = captureImageSrc.trim() || uploadedImage?.w320Url;
    const noBgImage = !previewImageSrc;
    const noCssBg = !(mediaBackground || "").trim();
    const resolvedPreviewMediaBg =
      noBgImage && noCssBg ? DEFAULT_PREVIEW_MEDIA_BG : mediaBackground.trim();
    const lead = leadTextColor.trim();
    const tc = titleTextColor.trim();
    const dc = descriptionTextColor.trim();
    const fdc = footerDateTextColor.trim();
    const fpc = footerPlaceTextColor.trim();
    return {
      slideTitle: title.length > 0 ? title : "(제목)",
      slideSubtitle: subtitle.length ? subtitle : "·",
      slideStatusBadge: publishIntent === "recruiting" ? "모집중" : "임시저장",
      slideExtra1: textLine1.length > 0 ? textLine1 : null,
      slideExtra2: textLine2.length > 0 ? textLine2 : null,
      slideImage320Url: previewImageSrc,
      slideCardTemplate: cardTemplate,
      slideBackgroundType: backgroundType,
      slideThemeType: themeType,
      slideMediaBackground: resolvedPreviewMediaBg,
      slideImageOverlayBlend: v2MediaMode === "on",
      slideImageOverlayOpacity:
        v2MediaMode === "on" ? imageOverlayOpacity : DEFAULT_BG_IMAGE_OVERLAY_OPACITY,
      slideLeadTextColor: lead || undefined,
      slideTitleTextColor: tc || undefined,
      slideDescTextColor: dc || undefined,
      slideTextShadowEnabled: cardTextShadowEnabled,
      slideTitleEffect: cardTitleEffect,
      slideTitleOutlineColor: cardTitleOutlineColor,
      slideBottomBarColor: bottomBarColor,
      slideBottomBarOpacity: bottomBarOpacity,
      slideGradientPreset: gradientPreset,
      slideGradientOpacity: gradientOpacity,
      slideSurfaceFull: false,
      slideFooterDateTextColor: fdc || undefined,
      slideFooterPlaceTextColor: fpc || undefined,
    };
  }, [
    title,
    cardDate,
    cardPlace,
    publishIntent,
    textLine1,
    textLine2,
    leadTextColor,
    titleTextColor,
    descriptionTextColor,
    cardTextShadowEnabled,
    cardTitleEffect,
    cardTitleOutlineColor,
    cardSurfaceLayout,
    bottomBarColor,
    bottomBarOpacity,
    gradientPreset,
    gradientOpacity,
    footerDateTextColor,
    footerPlaceTextColor,
    uploadedImage?.w320Url,
    captureImageSrc,
    cardTemplate,
    backgroundType,
    themeType,
    v2MediaMode,
    imageOverlayOpacity,
    mediaBackground,
  ]);

  const activateV2Media = useCallback(() => {
    setV2MediaMode("on");
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (captureImageObjectUrlRef.current) {
        URL.revokeObjectURL(captureImageObjectUrlRef.current);
        captureImageObjectUrlRef.current = null;
      }
    };
  }, []);

  function clearCaptureImageSource(): void {
    if (captureImageObjectUrlRef.current) {
      URL.revokeObjectURL(captureImageObjectUrlRef.current);
      captureImageObjectUrlRef.current = null;
    }
    setCaptureImageSrc("");
  }

  function setCaptureImageObjectUrl(nextUrl: string): void {
    if (captureImageObjectUrlRef.current) {
      URL.revokeObjectURL(captureImageObjectUrlRef.current);
    }
    captureImageObjectUrlRef.current = nextUrl;
    setCaptureImageSrc(nextUrl);
  }

  async function createLocalObjectUrlFromStoredImage(url: string): Promise<string | null> {
    const src = url.trim();
    if (!src) return null;
    try {
      const response = await fetch(src, { credentials: "same-origin", cache: "force-cache" });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.toLowerCase().startsWith("image/") || blob.size <= 0) return null;
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  async function ensureLocalCaptureImageSource(): Promise<boolean> {
    if (backgroundType !== "image" || !uploadedImage) return true;
    if (isBrowserLocalImageSrc(captureImageSrc)) return true;

    const localUrl = await createLocalObjectUrlFromStoredImage(uploadedImage.w640Url || uploadedImage.w320Url);
    if (!localUrl) return false;
    setCaptureImageObjectUrl(localUrl);
    await waitForNextPaint();
    return true;
  }

  const loadSnapshots = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const response = await fetch(
        `/api/client/card-snapshots?tournamentId=${encodeURIComponent(tournamentId)}&mode=editor`
      );
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

      setTournamentStatusBadge(typeof t.statusBadge === "string" ? t.statusBadge.trim() : "");

      const summaryLine1 = firstNonEmptyLine(t.summary);
      const summaryLine2 = secondNonEmptyLine(t.summary);
      const prizeLine1 = firstNonEmptyLine(t.prizeInfo);
      const prizeSingleLine = buildPrizeInfoSingleLine(t.prizeInfo);
      const autoPrizeLine =
        !prizeAutoSeededRef.current && !userEditedTextLine2Ref.current ? prizeSingleLine : "";

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
        if (!userEditedTextLine2Ref.current) {
          const nextLine2 = fromPick2 || autoPrizeLine || prizeLine1 || summaryLine2;
          setTextLine2(nextLine2);
          if (!fromPick2 && autoPrizeLine) {
            prizeAutoSeededRef.current = true;
          }
        }
        setCardTitleEffect(
          pick.cardTitleEffect === "shadow" ||
            pick.cardTitleEffect === "outline" ||
            pick.cardTitleEffect === "shadow_outline"
            ? pick.cardTitleEffect
            : "none"
        );
        setCardTitleOutlineColor(pick.cardTitleOutlineColor === "white" ? "white" : "black");
        setBottomBarColor(
          typeof pick.cardBottomBarColor === "string" && pick.cardBottomBarColor.trim()
            ? pick.cardBottomBarColor.trim()
            : "#ffffff"
        );
        setBottomBarOpacity(
          typeof pick.cardBottomBarOpacity === "number" && Number.isFinite(pick.cardBottomBarOpacity)
            ? Math.min(1, Math.max(0, pick.cardBottomBarOpacity))
            : 1
        );
        setGradientPreset(
          pick.cardGradientPreset === "top" ||
            pick.cardGradientPreset === "left" ||
            pick.cardGradientPreset === "top_left" ||
            pick.cardGradientPreset === "soft"
            ? pick.cardGradientPreset
            : "none"
        );
        setGradientOpacity(
          typeof pick.cardGradientOpacity === "number" && Number.isFinite(pick.cardGradientOpacity)
            ? Math.min(1, Math.max(0, pick.cardGradientOpacity))
            : 0
        );
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
        setThemeType(
          pick.tournamentTheme === "light" ? "light" : pick.tournamentTheme === "natural" ? "natural" : "dark"
        );
        const restoredImage = pickStoredImageFromSnapshot(pick);
        if (restoredImage) {
          clearCaptureImageSource();
          setUploadedImage(restoredImage);
        } else {
          clearCaptureImageSource();
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
        const sum2 = (autoPrizeLine || prizeLine1 || summaryLine2).trim();
        setTextLine1(sum1 || POSTCARD_TEMPLATE_APP_DEFAULTS.leadText);
        if (!userEditedTextLine2Ref.current) {
          setTextLine2(sum2 || POSTCARD_TEMPLATE_APP_DEFAULTS.descriptionText);
          if (autoPrizeLine) {
            prizeAutoSeededRef.current = true;
          }
        }
        setLeadTextColor("");
        setTitleTextColor("");
        setDescriptionTextColor("");
        clearCaptureImageSource();
        setUploadedImage(null);
        setV2MediaMode("on");
        setMediaBackground(DEFAULT_CARD_MEDIA_BACKGROUND);
        setImageOverlayOpacity(DEFAULT_BG_IMAGE_OVERLAY_OPACITY);
        const d0 = typeof t.date === "string" ? t.date : "";
        const loc0 = typeof t.location === "string" ? t.location : "";
        setCardDate(d0 ? formatCardDateForDisplay(d0) : POSTCARD_TEMPLATE_APP_DEFAULTS.dateText);
        setCardPlace(loc0 ? venueNameOnly(loc0) : POSTCARD_TEMPLATE_APP_DEFAULTS.placeText);
        setCardTitleEffect("none");
        setCardTitleOutlineColor("black");
        setBottomBarColor("#ffffff");
        setBottomBarOpacity(1);
        setGradientPreset("none");
        setGradientOpacity(0);
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
    userEditedTextLine2Ref.current = false;
    prizeAutoSeededRef.current = false;
    setPublishIntent("recruiting");
  }, [tournamentId]);

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
      cardTitleEffect,
      cardTitleOutlineColor,
      cardBottomBarColor: bottomBarColor,
      cardBottomBarOpacity: bottomBarOpacity,
      cardGradientPreset: gradientPreset,
      cardGradientOpacity: gradientOpacity,
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

  /** 스냅샷 임시저장만 (`draftOnly: true`). 공개본은 덮어쓰지 않음. */
  async function persistCardDraftSnapshot(): Promise<boolean> {
    if (!tournamentId) return false;
    const built = buildCardPayload(true);
    if (!built.ok) {
      setMessage(built.error);
      return false;
    }
    const response = await fetch("/api/client/card-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built.body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "저장에 실패했습니다.");
      return false;
    }
    return true;
  }

  async function handlePublish(): Promise<void> {
    if (!tournamentId.trim() || publishBusy) return;
    if (saveInFlightRef.current) return;
    const recruitingPublish = publishIntent === "recruiting";
    let holdBusyUntilSuccessModal = false;
    saveInFlightRef.current = true;
    setPublishBusy(true);
    setMessage("");
    setPublishFlowError("");
    try {
      if (recruitingPublish) {
        setPublishFlow({ percent: PUBLISH_PROGRESS_DRAFT_SAVE.percent, label: PUBLISH_PROGRESS_DRAFT_SAVE.label });
      }

      if (!(await persistCardDraftSnapshot())) {
        if (recruitingPublish) {
          setPublishFlow({ percent: PUBLISH_PROGRESS_DRAFT_SAVE.percent, label: PUBLISH_PROGRESS_DRAFT_SAVE.label });
          setPublishFlowError(PUBLISH_DRAFT_SAVE_FAIL_KO);
        }
        return;
      }

      if (publishIntent === "draft") {
        window.alert("대회카드가 임시저장되었습니다.");
        void router.refresh();
        return;
      }

      if (!(await ensureLocalCaptureImageSource())) {
        setPublishFlow({
          percent: PUBLISH_PROGRESS_CARD_IMAGE.percent,
          label: PUBLISH_PROGRESS_CARD_IMAGE.label,
          hint: PUBLISH_PROGRESS_CARD_IMAGE.hint,
        });
        setPublishFlowError("배경 이미지를 캡처 가능한 브라우저 이미지로 준비하지 못했습니다. 이미지를 다시 선택해 주세요.");
        return;
      }

      setPublishFlow({
        percent: PUBLISH_PROGRESS_STATUS_PATCH.percent,
        label: PUBLISH_PROGRESS_STATUS_PATCH.label,
      });
      const previousBadgeForRevert = tournamentStatusBadge.trim();
      const patchRes = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusBadge: "모집중" }),
      });
      if (!patchRes.ok) {
        setPublishFlow({
          percent: PUBLISH_PROGRESS_STATUS_PATCH.percent,
          label: PUBLISH_PROGRESS_STATUS_PATCH.label,
        });
        setPublishFlowError(PUBLISH_STATUS_PATCH_FAIL_KO);
        return;
      }

      const pub = await publishTournamentCardFromEditorClient({
        tournamentId,
        slideStatusBadge: "모집중",
        getPreviewCaptureRoot: () => cardPublishPreviewCaptureRef.current,
        onProgress: (phase) => {
          if (phase === "publish-start") {
            setPublishFlow({
              percent: PUBLISH_PROGRESS_CARD_IMAGE.percent,
              label: PUBLISH_PROGRESS_CARD_IMAGE.label,
              hint: PUBLISH_PROGRESS_CARD_IMAGE.hint,
            });
          } else if (phase === "before-post") {
            setPublishFlow({
              percent: PUBLISH_PROGRESS_MAIN_SAVE.percent,
              label: PUBLISH_PROGRESS_MAIN_SAVE.label,
            });
          }
        },
      });

      if (!pub.ok) {
        if (previousBadgeForRevert) {
          try {
            const rev = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ statusBadge: previousBadgeForRevert }),
            });
            if (!rev.ok) {
              console.warn("[card-publish-v2] status-badge revert after publish failure failed");
            }
          } catch {
            console.warn("[card-publish-v2] status-badge revert threw");
          }
        }
        setPublishFlowError(
          typeof pub.error === "string" && pub.error.trim() ? pub.error.trim() : PUBLISH_FLOW_FAIL_KO,
        );
        void loadSnapshots();
        void router.refresh();
        return;
      }

      setPublishFlow({ percent: PUBLISH_PROGRESS_DONE.percent, label: PUBLISH_PROGRESS_DONE.label });
      setMessage("");
      holdBusyUntilSuccessModal = true;
      window.setTimeout(() => {
        if (!mountedRef.current) {
          setPublishBusy(false);
          return;
        }
        setPublishCompleteModalOpen(true);
        setPublishFlow(null);
        setPublishFlowError("");
        setPublishBusy(false);
        void loadSnapshots();
        void router.refresh();
      }, 380);
    } catch {
      if (recruitingPublish) {
        setPublishFlow((prev) =>
          prev ?? {
            percent: PUBLISH_PROGRESS_CARD_IMAGE.percent,
            label: PUBLISH_PROGRESS_CARD_IMAGE.label,
            hint: PUBLISH_PROGRESS_CARD_IMAGE.hint,
          },
        );
        setPublishFlowError(PUBLISH_FLOW_FAIL_KO);
      } else {
        window.alert("처리 중 오류가 발생했습니다.");
      }
    } finally {
      if (!holdBusyUntilSuccessModal) {
        setPublishBusy(false);
      }
      saveInFlightRef.current = false;
    }
  }

  const editorLocked = publishBusy || uploading;
  const publishActionBlocked = publishBusy || uploading;
  const publishButtonLabel = publishBusy ? "처리 중…" : "게시";

  function handlePublishCompleteModalConfirm(): void {
    setPublishCompleteModalOpen(false);
    router.push(`/client/tournaments/${encodeURIComponent(tournamentId)}`);
  }

  const handleUploadImage = useCallback(
    async (file: File) => {
      if (uploading) return;
      setUploading(true);
      setMessage("");
      try {
        let uploadFile: File;
        try {
          uploadFile = await normalizeCardEditorBackgroundUpload(file);
        } catch {
          setMessage(
            "이미지 변환에 실패했습니다. 다른 사진을 선택하거나 캡처 이미지로 다시 시도해 주세요."
          );
          if (bgFileInputRef.current) bgFileInputRef.current.value = "";
          return;
        }

        const formData = new FormData();
        formData.append("file", uploadFile);
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
        const localCaptureUrl = URL.createObjectURL(uploadFile);
        setUploadedImage({
          imageId: result.imageId,
          w320Url: result.w320Url,
          w640Url: result.w640Url,
        });
        setCaptureImageObjectUrl(localCaptureUrl);
        setImageOverlayOpacity(DEFAULT_BG_IMAGE_OVERLAY_OPACITY);
        activateV2Media();
        setEditorTab("background");
      } catch {
        setMessage("이미지 업로드 중 오류가 발생했습니다.");
      } finally {
        setUploading(false);
      }
    },
    [uploading, activateV2Media]
  );

  const clearImage = useCallback(() => {
    clearCaptureImageSource();
    setUploadedImage(null);
    setImageOverlayOpacity(DEFAULT_BG_IMAGE_OVERLAY_OPACITY);
    setMessage("이미지를 제거했습니다. 테마 배경으로 표시됩니다.");
  }, []);

  const clearBackgroundFileSelection = useCallback(() => {
    if (bgFileInputRef.current) bgFileInputRef.current.value = "";
    if (uploadedImage) clearImage();
  }, [uploadedImage, clearImage]);

  const onPickPaletteColor = useCallback((hex: string) => {
    setV2MediaMode("on");
    setMediaBackground(hex);
  }, []);

  const onImageOverlayChange = useCallback((opacity: number) => {
    setV2MediaMode("on");
    setImageOverlayOpacity(opacity);
  }, []);

  const onBottomBarOpacityChange = useCallback((opacity: number) => {
    setBottomBarOpacity(opacity);
  }, []);

  const onGradientOpacityChange = useCallback((opacity: number) => {
    setGradientOpacity(opacity);
  }, []);

  const onBackgroundFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleUploadImage(file);
    },
    [handleUploadImage]
  );

  return (
    <main
      ref={tournamentFormKeyboardRootRef}
      className="v3-page v3-stack"
      data-card-publish-v2="1"
      style={{ maxWidth: "none", margin: 0, width: "100%" }}
    >
      <ClientBlockingStatusOverlay
        open={uploading}
        variant="compact"
        message="이미지를 준비하는 중입니다."
      />
      <div className={editorStyles.previewFullWidthBlock}>
        <div className={editorStyles.previewSlideLayer}>
          <div className={editorStyles.previewCardSlot}>
            <div className={editorStyles.previewCardAspectFace}>
              <div className={`${editorStyles.previewCardWrap} ${editorStyles.previewCardWrapV2Chrome}`}>
                <CardPublishPreview ref={cardPublishPreviewCaptureRef} model={previewModel} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={editorStyles.pcPageShell}>
        <div className={editorStyles.pcPageMain}>
          <div className={`${editorStyles.pageWrap} ${editorStyles.pageWrapV2}`}>
            <div className={editorStyles.formPanel}>
              <div className={editorStyles.stepTabsWrap}>
                <div className={editorStyles.stepTabs} role="tablist" aria-label="편집 단계">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorTab === "background"}
                    className={`${editorStyles.stepTab} ${editorTab === "background" ? editorStyles.stepTabActive : ""}`}
                    disabled={editorLocked}
                    onClick={() => setEditorTab("background")}
                  >
                    배경설정
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorTab === "content"}
                    className={`${editorStyles.stepTab} ${editorTab === "content" ? editorStyles.stepTabActive : ""}`}
                    disabled={editorLocked}
                    onClick={() => setEditorTab("content")}
                  >
                    내용입력
                  </button>
                </div>
              </div>

              <div className={`${editorStyles.formScrollPane} client-dashboard-scroll-safe-area`}>
                <div className={editorStyles.stepScrollBody}>
                  {editorTab === "content" ? (
                    <CardPublishContentTab
                      leadTextColor={leadTextColor}
                      setLeadTextColor={setLeadTextColor}
                      titleTextColor={titleTextColor}
                      setTitleTextColor={setTitleTextColor}
                      descriptionTextColor={descriptionTextColor}
                      setDescriptionTextColor={setDescriptionTextColor}
                      footerDateTextColor={footerDateTextColor}
                      setFooterDateTextColor={setFooterDateTextColor}
                      footerPlaceTextColor={footerPlaceTextColor}
                      setFooterPlaceTextColor={setFooterPlaceTextColor}
                      textLine1={textLine1}
                      setTextLine1={setTextLine1}
                      title={title}
                      setTitle={setTitle}
                      textLine2={textLine2}
                      setTextLine2={handleTextLine2Change}
                      cardDate={cardDate}
                      setCardDate={setCardDate}
                      cardPlace={cardPlace}
                      setCardPlace={setCardPlace}
                      cardTitleEffect={cardTitleEffect}
                      setCardTitleEffect={setCardTitleEffect}
                      cardTitleOutlineColor={cardTitleOutlineColor}
                      setCardTitleOutlineColor={setCardTitleOutlineColor}
                      disabled={editorLocked}
                    />
                  ) : (
                    <CardPublishBackgroundTab
                      mediaBackground={mediaBackground}
                      onPickPaletteColor={onPickPaletteColor}
                      bgFileInputRef={bgFileInputRef}
                      onBackgroundFileChange={onBackgroundFileChange}
                      onClearBackgroundFileSelection={clearBackgroundFileSelection}
                      uploadedImage={uploadedImage}
                      imageOverlayOpacity={imageOverlayOpacity}
                      onImageOverlayChange={onImageOverlayChange}
                      bottomBarColor={bottomBarColor}
                      onPickBottomBarColor={setBottomBarColor}
                      bottomBarOpacity={bottomBarOpacity}
                      onBottomBarOpacityChange={onBottomBarOpacityChange}
                      gradientPreset={gradientPreset}
                      onGradientPresetChange={setGradientPreset}
                      gradientOpacity={gradientOpacity}
                      onGradientOpacityChange={onGradientOpacityChange}
                      disabled={editorLocked}
                    />
                  )}

                  <div className={editorStyles.actions}>
                    <div className="v3-stack" style={{ gap: "0.35rem", alignItems: "stretch" }}>
                      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 800, color: "#334155" }}>게시 상태</p>
                      <div
                        className="v3-row"
                        role="radiogroup"
                        aria-label="게시 상태"
                        style={{ flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}
                      >
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.9rem",
                            cursor: publishBusy ? "default" : "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="publish-intent"
                            checked={publishIntent === "recruiting"}
                            disabled={publishBusy}
                            onChange={() => setPublishIntent("recruiting")}
                          />
                          모집중
                        </label>
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.9rem",
                            cursor: publishBusy ? "default" : "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="publish-intent"
                            checked={publishIntent === "draft"}
                            disabled={publishBusy}
                            onChange={() => setPublishIntent("draft")}
                          />
                          임시저장
                        </label>
                      </div>
                      <div
                        role="status"
                        aria-live="polite"
                        aria-busy={Boolean(publishBusy && publishIntent === "recruiting" && !publishFlowError && publishFlow)}
                        className={`${editorStyles.publishStatusSlot} ${publishFlow || publishFlowError ? editorStyles.publishStatusSlotActive : ""} ${publishFlowError ? editorStyles.publishStatusSlotError : ""}`}
                      >
                        <div className={editorStyles.publishStatusTextRow}>
                          {!publishFlow && !publishFlowError ? (
                            <p className={editorStyles.publishStatusHelper}>
                              모집중으로 게시하면 메인에 홍보됩니다. 임시저장은 공개 카드를 바꾸지 않습니다.
                            </p>
                          ) : publishFlow ? (
                            <>
                              <span className={editorStyles.publishStatusLabel}>{publishFlow.label}</span>
                              <span className={editorStyles.publishStatusPercent}>{publishFlow.percent}%</span>
                            </>
                          ) : null}
                        </div>
                        {publishFlow?.hint ? (
                          <p className={editorStyles.publishStatusHint}>{publishFlow.hint}</p>
                        ) : null}
                        <div
                          className={`${editorStyles.publishStatusBarTrack} ${!publishFlow && !publishFlowError ? editorStyles.publishStatusBarTrackIdle : ""} ${publishFlowError ? editorStyles.publishStatusBarTrackError : ""}`}
                          aria-hidden={!publishFlow && !publishFlowError}
                        >
                          {publishFlow ? (
                            <div
                              className={`${editorStyles.publishStatusBarFill} ${publishFlowError ? editorStyles.publishStatusBarFillError : ""}`}
                              style={{ width: `${publishFlow.percent}%` }}
                            />
                          ) : null}
                        </div>
                        <p
                          className={`${editorStyles.publishStatusErrorLine} ${publishFlowError ? editorStyles.publishStatusErrorLineVisible : ""}`}
                        >
                          {publishFlowError || "\u00a0"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="v3-btn"
                        disabled={publishActionBlocked}
                        onClick={() => void handlePublish()}
                      >
                        {publishButtonLabel}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {message && !publishFlow && !publishFlowError ? (
            <p className="v3-muted" role="status" style={{ paddingLeft: "0.75rem", whiteSpace: "pre-line" }}>
              {message}
            </p>
          ) : null}
        </div>
        <aside className={editorStyles.pcPageAside} aria-hidden="true" />
      </div>

      {publishCompleteModalOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10050,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-publish-publish-request-done-title"
            className="v3-box v3-stack"
            style={{
              maxWidth: "22rem",
              width: "100%",
              gap: "0.85rem",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.28)",
            }}
          >
            <h2 id="card-publish-publish-request-done-title" className="v3-h2" style={{ margin: 0 }}>
              게시 완료
            </h2>
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>
              게시가 완료되었습니다.
            </p>
            <button type="button" className="v3-btn" onClick={handlePublishCompleteModalConfirm}>
              확인
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
