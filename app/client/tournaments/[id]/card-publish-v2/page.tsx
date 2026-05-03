"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { TournamentCardSurfaceLayout } from "../../../../site/tournament-snapshot-card-view";
import { POSTCARD_TEMPLATE_APP_DEFAULTS } from "../../../../../lib/postcard-template-reference";
import editorStyles from "../card-publish-editor.module.css";
import { CardPublishBackgroundTab, CardPublishContentTab } from "./CardPublishEditorFormParts";
import { CardPublishPreview, type CardPublishPreviewModel } from "./CardPublishPreview";

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
  const labels: Array<"우승" | "준우승" | "3위"> = ["우승", "준우승", "3위"];
  const byLabel = new Map<string, string>();
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = /^(우승|준우승|3위)\s*:\s*(.+)$/.exec(trimmed);
    if (!m) continue;
    const label = m[1] as "우승" | "준우승" | "3위";
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
  /** 저장 성공 후에만 노출: 대회 관리 상태설정 영역으로 이동 */
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** 캡처용 오프스크린 카드 — 초기 타이핑 부담 완화 후 `requestIdleCallback`으로 마운트 */
  const [renderOffscreenCaptureCard, setRenderOffscreenCaptureCard] = useState(false);

  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const cardPublishCaptureRef = useRef<HTMLDivElement>(null);
  const cardPublishCaptureForImageRef = useRef<HTMLDivElement>(null);
  /** 저장 중복 요청 차단 — ref로 동기 가드 */
  const saveInFlightRef = useRef(false);
  const userEditedTextLine2Ref = useRef(false);
  const prizeAutoSeededRef = useRef(false);

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
    const noBgImage = !uploadedImage?.w320Url;
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
      slideStatusBadge: tournamentStatusForPreview,
      slideExtra1: textLine1.length > 0 ? textLine1 : null,
      slideExtra2: textLine2.length > 0 ? textLine2 : null,
      slideImage320Url: uploadedImage?.w320Url,
      slideCardTemplate: cardTemplate,
      slideBackgroundType: backgroundType,
      slideThemeType: themeType,
      slideMediaBackground: resolvedPreviewMediaBg,
      slideImageOverlayOpacity:
        v2MediaMode === "on" ? imageOverlayOpacity : DEFAULT_BG_IMAGE_OVERLAY_OPACITY,
      slideLeadTextColor: lead || undefined,
      slideTitleTextColor: tc || undefined,
      slideDescTextColor: dc || undefined,
      slideTextShadowEnabled: cardTextShadowEnabled,
      slideSurfaceFull: cardSurfaceLayout === "full",
      slideFooterDateTextColor: fdc || undefined,
      slideFooterPlaceTextColor: fpc || undefined,
    };
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

  const activateV2Media = useCallback(() => {
    setV2MediaMode("on");
  }, []);

  useEffect(() => {
    let idleHandle = 0;
    let timeoutHandle = 0;
    const enable = () => setRenderOffscreenCaptureCard(true);
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(enable, { timeout: 2000 });
    } else if (typeof window !== "undefined") {
      timeoutHandle = window.setTimeout(enable, 300);
    }
    return () => {
      if (idleHandle) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    };
  }, []);

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

      setTournamentStatusForPreview(
        typeof t.statusBadge === "string" && t.statusBadge.trim() ? t.statusBadge.trim() : ""
      );

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
    setSaveSucceeded(false);
    userEditedTextLine2Ref.current = false;
    prizeAutoSeededRef.current = false;
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

  /** 초안만 저장. 메인 게시는 이 화면에서 하지 않으며 대회 관리 페이지에서 진행한다. */
  function saveCardDraft(successMessage: string) {
    if (!tournamentId) return;
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;

    void (async () => {
      setSaveBusy(true);
      setMessage("");
      try {
        const built = buildCardPayload(true);
        if (!built.ok) {
          setMessage(built.error);
          return;
        }
        const response = await fetch("/api/client/card-snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(built.body),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          setMessage(result.error ?? "저장에 실패했습니다.");
          return;
        }
        setSaveSucceeded(true);
        setMessage(successMessage);
        router.refresh();
      } catch {
        setMessage("저장 요청 중 오류가 발생했습니다.");
      } finally {
        setSaveBusy(false);
        saveInFlightRef.current = false;
      }
    })();
  }

  const handleUploadImage = useCallback(
    async (file: File) => {
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
    },
    [uploading, activateV2Media]
  );

  const clearImage = useCallback(() => {
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

  const onBackgroundFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleUploadImage(file);
    },
    [handleUploadImage]
  );

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
                  <div
                    className={`${editorStyles.previewCardWrap} ${editorStyles.previewCardWrapV2Chrome}`}
                  >
                    <CardPublishPreview ref={cardPublishCaptureRef} model={previewModel} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={editorStyles.cardPublishCaptureOffscreen} aria-hidden>
            {renderOffscreenCaptureCard ? (
              <div className={editorStyles.previewInner}>
                <div className={editorStyles.previewSlideLayer}>
                  <div className={editorStyles.previewCardScaleHost}>
                    <div className={editorStyles.previewCardScaleInner}>
                      <div
                        className={`${editorStyles.previewCardWrap} ${editorStyles.previewCardWrapV2Chrome}`}
                      >
                        <CardPublishPreview
                          ref={cardPublishCaptureForImageRef}
                          model={previewModel}
                          isImageCaptureMode
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <form
          className={editorStyles.formPanel}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            saveCardDraft("카드 초안이 저장되었습니다.");
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
              cardTextShadowEnabled={cardTextShadowEnabled}
              setCardTextShadowEnabled={setCardTextShadowEnabled}
            />
          ) : (
            <CardPublishBackgroundTab
              mediaBackground={mediaBackground}
              onPickPaletteColor={onPickPaletteColor}
              bgFileInputRef={bgFileInputRef}
              onBackgroundFileChange={onBackgroundFileChange}
              onClearBackgroundFileSelection={clearBackgroundFileSelection}
              uploading={uploading}
              uploadedImage={uploadedImage}
              imageOverlayOpacity={imageOverlayOpacity}
              onImageOverlayChange={onImageOverlayChange}
            />
          )}

          <div className={editorStyles.actions}>
            <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <button type="submit" className="v3-btn" disabled={saveBusy}>
                {saveBusy ? "저장 중" : "저장"}
              </button>
              {saveSucceeded && tournamentId.trim() ? (
                <Link
                  className="v3-btn"
                  href={`/client/tournaments/${encodeURIComponent(tournamentId)}#tournament-status-badge`}
                >
                  상태배지 변경
                </Link>
              ) : null}
            </div>
            {saveSucceeded ? (
              <p className="v3-muted" style={{ margin: 0 }}>
                초안이 저장되었습니다. 게시하려면 모집중으로 변경하셔야 합니다.
              </p>
            ) : null}
          </div>
          </div>
          </div>
        </form>
          </div>

          {message ? (
            <p className="v3-muted" role="status" style={{ paddingLeft: "0.75rem", whiteSpace: "pre-line" }}>
              {message}
            </p>
          ) : null}
        </div>
        <aside className={editorStyles.pcPageAside} aria-hidden="true" />
      </div>
    </main>
  );
}
