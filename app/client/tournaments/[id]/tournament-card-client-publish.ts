import {
  APP_ONLY_ERROR_CODE,
  captureAndUploadTournamentPublishedCardFullPngInBrowser,
} from "./tournament-card-publish-capture";

type CardSnapshotRow = {
  snapshotId?: string;
  title: string;
  subtitle: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  cardExtraLine3?: string | null;
  imageId: string;
  image320Url: string;
  tournamentCardTemplate?: "A" | "B";
  tournamentBackgroundType?: "image" | "theme";
  tournamentTheme?: "dark" | "light" | "natural";
  tournamentMediaBackground?: string | null;
  tournamentImageOverlayBlend?: boolean | null;
  tournamentImageOverlayOpacity?: number | null;
  tournamentCardDisplayDate?: string | null;
  tournamentCardDisplayLocation?: string | null;
  tournamentCardTextShadowEnabled?: boolean;
  tournamentCardSurfaceLayout?: "split" | "full";
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
  cardLeadTextColor?: string | null;
  cardTitleTextColor?: string | null;
  cardDescriptionTextColor?: string | null;
  isActive?: boolean;
};

function isCompleteCard(s: CardSnapshotRow | null | undefined): s is CardSnapshotRow {
  if (!s) return false;
  const title = typeof s.title === "string" ? s.title.trim() : "";
  if (!title) return false;
  const bg = s.tournamentBackgroundType === "theme" ? "theme" : "image";
  if (bg === "image") {
    const imageId = typeof s.imageId === "string" ? s.imageId.trim() : "";
    const image320Url = typeof s.image320Url === "string" ? s.image320Url.trim() : "";
    return Boolean(imageId && image320Url);
  }
  return true;
}

function pickCardForPublish(data: {
  snapshots?: CardSnapshotRow[];
  activeSnapshot?: CardSnapshotRow | null;
}): CardSnapshotRow | null {
  const list = data.snapshots ?? [];
  const draft = list.find((row) => row.isActive === false && isCompleteCard(row));
  if (draft) return draft;
  const fromList = list.find((row) => isCompleteCard(row));
  if (fromList) return fromList;
  if (isCompleteCard(data.activeSnapshot)) return data.activeSnapshot;
  return null;
}

export type TournamentCardClientPublishResult =
  | { ok: true; hadPublishedBefore: boolean }
  | { ok: false; error: string };

export type TournamentCardClientPublishProgressPhase = "publish-start" | "before-post";

const SERVER_CARD_IMAGE_FAIL_KO = "게시 이미지 생성 또는 저장에 실패했습니다. 다시 게시해 주세요.";
const NATIVE_CAPTURE_FAIL_KO = "앱 화면 캡처에 실패했습니다. 화면을 다시 확인 후 재시도해 주세요.";
const APP_ONLY_KO = "게시카드 저장 기능은 앱에서만 가능합니다.";
const PUBLISH_IMAGE_TIMEOUT_MS = 45_000;

/**
 * 클라이언트에서 카드 스냅샷 GET → 브라우저 DOM PNG 캡처·업로드 → POST(`draftOnly: false`)까지 수행.
 * 대회 `status-badge`는 호출 전에 이미 반영되어 있어야 이미지 배지·메인 노출 플래그가 맞습니다.
 */
export async function publishTournamentCardFromEditorClient(args: {
  tournamentId: string;
  /** 슬라이드/PNG에 찍힐 배지 문구(예: 모집중) */
  slideStatusBadge: string;
  /** 편집 화면 `CardPublishPreview` 아트보드 루트(ref.current) — 브라우저 PNG 캡처에 필수 */
  getPreviewCaptureRoot: () => HTMLElement | null;
  /** 단계형 진행 UI용(실제 비율 아님). GET·캡처 구간 시작 시 / draftOnly:false POST 직전. */
  onProgress?: (phase: TournamentCardClientPublishProgressPhase) => void;
}): Promise<TournamentCardClientPublishResult> {
  const tournamentId = args.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "대회 정보가 없습니다." };

  args.onProgress?.("publish-start");

  let data: {
    snapshots?: CardSnapshotRow[];
    activeSnapshot?: CardSnapshotRow | null;
    tournament?: { date?: string; location?: string };
    error?: string;
  } = {};
  let hadPublishedBefore = false;
  let latest: CardSnapshotRow | null = null;
  try {
    const controller = new AbortController();
    /** 게시 직전 초안이 저장된 직후 GET이 이어지므로 넉넉히 둔다(짧은 타임아웃은 오탐 실패 유발). */
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`/api/client/card-snapshots?tournamentId=${encodeURIComponent(tournamentId)}`, {
        signal: controller.signal,
      });
      const json = (await res.json()) as {
        snapshots?: CardSnapshotRow[];
        activeSnapshot?: CardSnapshotRow | null;
        tournament?: { date?: string; location?: string };
        error?: string;
      };
      data = json;
      hadPublishedBefore = Boolean(json.activeSnapshot);
      latest = pickCardForPublish(json);
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch {
    return { ok: false, error: "카드 정보를 불러오지 못했습니다." };
  }

  const publishSource: CardSnapshotRow = latest ?? {
    title: "대회 카드",
    subtitle: "",
    imageId: "theme",
    image320Url: "",
    tournamentCardTemplate: "A",
    tournamentBackgroundType: "theme",
    tournamentTheme: "dark",
    isActive: true,
  };

  const tournamentDate = typeof data.tournament?.date === "string" ? data.tournament.date : "";
  const tournamentLocation = typeof data.tournament?.location === "string" ? data.tournament.location : "";

  let publishedCardImageUrl = "";
  let publishedCardImage480Url = "";
  let publishedCardImage320Url = "";
  let publishedCardImageId = "";
  try {
    const previewCaptureRoot = args.getPreviewCaptureRoot();
    if (!previewCaptureRoot) {
      console.error("[publishTournamentCardFromEditorClient] 게시카드 미리보기 DOM을 찾을 수 없습니다.");
      return { ok: false, error: "게시카드 미리보기를 불러온 뒤 다시 게시해 주세요." };
    }

    const captureController = new AbortController();
    const captureTimeoutId = window.setTimeout(() => captureController.abort(), PUBLISH_IMAGE_TIMEOUT_MS);
    try {
      const r = await captureAndUploadTournamentPublishedCardFullPngInBrowser({
        tournamentId,
        previewCaptureRoot,
        signal: captureController.signal,
      });
      publishedCardImageUrl = r.publishedCardImageUrl;
      publishedCardImage480Url = r.publishedCardImage480Url;
      publishedCardImage320Url = r.publishedCardImage320Url;
      publishedCardImageId = r.imageId;
    } catch (captureErr) {
      console.error("[publishTournamentCardFromEditorClient] capture failed", captureErr);
      const code = captureErr instanceof Error ? (captureErr as Error & { code?: string }).code : undefined;
      const errName = captureErr instanceof Error ? captureErr.name : String(typeof captureErr);
      const errMsg = captureErr instanceof Error ? captureErr.message : String(captureErr);
      // 디버깅: catch에 걸린 실제 JS 에러를 화면에 표시
      window.alert(
        `[JS 내부 에러 — captureErr catch]\n${errName}: ${errMsg}\n\ncode: ${code ?? "(없음)"}`,
      );
      if (code === APP_ONLY_ERROR_CODE) {
        return { ok: false, error: APP_ONLY_KO };
      }
      if (captureErr instanceof DOMException && captureErr.name === "AbortError") {
        return { ok: false, error: NATIVE_CAPTURE_FAIL_KO };
      }
      return { ok: false, error: captureErr instanceof Error ? captureErr.message : NATIVE_CAPTURE_FAIL_KO };
    } finally {
      window.clearTimeout(captureTimeoutId);
    }
    if (!publishedCardImageUrl || !publishedCardImage320Url || !publishedCardImageId) {
      return { ok: false, error: NATIVE_CAPTURE_FAIL_KO };
    }
  } catch (e) {
    const outerErrName = e instanceof Error ? e.name : String(typeof e);
    const outerErrMsg = e instanceof Error ? e.message : String(e);
    window.alert(
      `[JS 내부 에러 — 외부 catch]\n${outerErrName}: ${outerErrMsg}`,
    );
    return {
      ok: false,
      error: e instanceof DOMException && e.name === "AbortError" ? NATIVE_CAPTURE_FAIL_KO : SERVER_CARD_IMAGE_FAIL_KO,
    };
  }

  args.onProgress?.("before-post");

  const postRes = await fetch("/api/client/card-snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tournamentId,
      title: typeof publishSource.title === "string" ? publishSource.title : "",
      textLine1: typeof publishSource.cardExtraLine1 === "string" ? publishSource.cardExtraLine1 : "",
      textLine2: typeof publishSource.cardExtraLine2 === "string" ? publishSource.cardExtraLine2 : "",
      textLine3: typeof publishSource.cardExtraLine3 === "string" ? publishSource.cardExtraLine3 : "",
      cardTemplate: publishSource.tournamentCardTemplate ?? "A",
      backgroundType: publishSource.tournamentBackgroundType ?? "image",
      themeType: publishSource.tournamentTheme ?? "dark",
      imageId: publishSource.imageId?.trim() ?? "",
      image320Url: publishSource.image320Url?.trim() ?? "",
      draftOnly: false,
      statusBadge: args.slideStatusBadge,
      cardTextShadowEnabled: publishSource.tournamentCardTextShadowEnabled === true,
      cardSurfaceLayout: publishSource.tournamentCardSurfaceLayout === "full" ? "full" : "split",
      ...(publishSource.tournamentCardSurfaceLayout === "full"
        ? {
            cardFooterDateTextColor:
              typeof publishSource.cardFooterDateTextColor === "string" && publishSource.cardFooterDateTextColor.trim()
                ? publishSource.cardFooterDateTextColor.trim()
                : null,
            cardFooterPlaceTextColor:
              typeof publishSource.cardFooterPlaceTextColor === "string" && publishSource.cardFooterPlaceTextColor.trim()
                ? publishSource.cardFooterPlaceTextColor.trim()
                : null,
          }
        : {
            cardFooterDateTextColor: null,
            cardFooterPlaceTextColor: null,
          }),
      ...(typeof publishSource.tournamentMediaBackground === "string"
        ? { mediaBackground: publishSource.tournamentMediaBackground }
        : {}),
      ...(typeof publishSource.tournamentImageOverlayBlend === "boolean"
        ? { imageOverlayBlend: publishSource.tournamentImageOverlayBlend }
        : {}),
      ...(typeof publishSource.tournamentImageOverlayOpacity === "number"
        ? { imageOverlayOpacity: publishSource.tournamentImageOverlayOpacity }
        : {}),
      ...(typeof publishSource.tournamentCardDisplayDate === "string"
        ? { cardDisplayDate: publishSource.tournamentCardDisplayDate }
        : {}),
      ...(typeof publishSource.tournamentCardDisplayLocation === "string"
        ? { cardDisplayLocation: publishSource.tournamentCardDisplayLocation }
        : {}),
      ...(typeof publishSource.cardLeadTextColor === "string" && publishSource.cardLeadTextColor.trim()
        ? { cardLeadTextColor: publishSource.cardLeadTextColor.trim() }
        : {}),
      ...(typeof publishSource.cardTitleTextColor === "string" && publishSource.cardTitleTextColor.trim()
        ? { cardTitleTextColor: publishSource.cardTitleTextColor.trim() }
        : {}),
      ...(typeof publishSource.cardDescriptionTextColor === "string" && publishSource.cardDescriptionTextColor.trim()
        ? { cardDescriptionTextColor: publishSource.cardDescriptionTextColor.trim() }
        : {}),
      publishedCardImageUrl,
      ...(publishedCardImage480Url ? { publishedCardImage480Url } : {}),
      publishedCardImage320Url,
      publishedCardImageBackgroundOnly: false,
    }),
  });
  const postData = (await postRes.json()) as { error?: string };
  if (!postRes.ok) {
    if (postData.error) {
      console.warn("[publishTournamentCardFromEditorClient] draftOnly:false POST failed", postData.error);
    }
    return { ok: false, error: SERVER_CARD_IMAGE_FAIL_KO };
  }

  return { ok: true, hadPublishedBefore };
}
