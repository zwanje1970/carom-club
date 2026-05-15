import { buildSlideDeckItemForTournamentCapture } from "./tournament-card-build-slide-deck-item";

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
const PUBLISH_IMAGE_TIMEOUT_MS = 45_000;

function joinAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }
  a.addEventListener("abort", abort, { once: true });
  b.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; json: T }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const signal = init.signal ? joinAbortSignals(init.signal, controller.signal) : controller.signal;
  try {
    const res = await fetch(input, { ...init, signal });
    return { ok: res.ok, status: res.status, json: (await res.json()) as T };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * 클라이언트에서 카드 스냅샷 GET → 서버 이미지 생성 → POST(`draftOnly: false`)까지 수행.
 * 대회 `status-badge`는 호출 전에 이미 반영되어 있어야 이미지 배지·메인 노출 플래그가 맞습니다.
 */
export async function publishTournamentCardFromEditorClient(args: {
  tournamentId: string;
  /** 슬라이드/PNG에 찍힐 배지 문구(예: 모집중) */
  slideStatusBadge: string;
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
    const slideDeckItem = buildSlideDeckItemForTournamentCapture({
      tournamentId,
      source: {
        snapshotId: publishSource.snapshotId,
        title: publishSource.title,
        subtitle: publishSource.subtitle,
        cardExtraLine1: publishSource.cardExtraLine1,
        cardExtraLine2: publishSource.cardExtraLine2,
        cardExtraLine3: publishSource.cardExtraLine3,
        image320Url: publishSource.image320Url,
        tournamentCardTemplate: publishSource.tournamentCardTemplate,
        tournamentBackgroundType: publishSource.tournamentBackgroundType,
        tournamentTheme: publishSource.tournamentTheme,
        tournamentMediaBackground: publishSource.tournamentMediaBackground,
        tournamentImageOverlayBlend: publishSource.tournamentImageOverlayBlend,
        tournamentImageOverlayOpacity: publishSource.tournamentImageOverlayOpacity,
        tournamentCardDisplayDate: publishSource.tournamentCardDisplayDate,
        tournamentCardDisplayLocation: publishSource.tournamentCardDisplayLocation,
        cardLeadTextColor: publishSource.cardLeadTextColor,
        cardTitleTextColor: publishSource.cardTitleTextColor,
        cardDescriptionTextColor: publishSource.cardDescriptionTextColor,
        tournamentCardTextShadowEnabled: publishSource.tournamentCardTextShadowEnabled,
        tournamentCardSurfaceLayout: publishSource.tournamentCardSurfaceLayout,
        cardFooterDateTextColor: publishSource.cardFooterDateTextColor,
        cardFooterPlaceTextColor: publishSource.cardFooterPlaceTextColor,
      },
      statusBadge: args.slideStatusBadge,
      tournamentFallbackDate: tournamentDate,
      tournamentFallbackLocation: tournamentLocation,
    });
    const imageRes = await fetchJsonWithTimeout<{
      error?: string;
      imageId?: string;
      publishedCardImageUrl?: string;
      publishedCardImage320Url?: string;
      publishedCardImage480Url?: string;
      w640Url?: string;
      w480Url?: string;
      w320Url?: string;
    }>(
      "/api/client/tournament-card-image",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          templateId: slideDeckItem.cardTemplate ?? "A",
          title: slideDeckItem.title,
          subtitle: slideDeckItem.subtitle,
          textLine1: slideDeckItem.cardExtraLine1 ?? null,
          textLine2: slideDeckItem.cardExtraLine2 ?? null,
          textLine3: slideDeckItem.cardExtraLine3 ?? null,
          statusBadge: args.slideStatusBadge,
          backgroundType: slideDeckItem.backgroundType ?? "image",
          themeType: slideDeckItem.themeType ?? "dark",
          backgroundImageUrl: slideDeckItem.image320Url ?? null,
          backgroundImageOpacity:
            typeof slideDeckItem.imageOverlayOpacity === "number" ? slideDeckItem.imageOverlayOpacity : null,
          mediaBackground: slideDeckItem.mediaBackground ?? null,
          textShadowEnabled: slideDeckItem.cardTextShadowEnabled === true,
          surfaceLayout: slideDeckItem.cardSurfaceLayout === "full" ? "full" : "split",
          leadTextColor: slideDeckItem.cardLeadTextColor ?? null,
          titleTextColor: slideDeckItem.cardTitleTextColor ?? null,
          descriptionTextColor: slideDeckItem.cardDescriptionTextColor ?? null,
          footerDateTextColor: slideDeckItem.cardFooterDateTextColor ?? null,
          footerPlaceTextColor: slideDeckItem.cardFooterPlaceTextColor ?? null,
        }),
      },
      PUBLISH_IMAGE_TIMEOUT_MS,
    );
    publishedCardImageUrl = (imageRes.json.publishedCardImageUrl ?? imageRes.json.w640Url ?? "").trim();
    publishedCardImage480Url = (imageRes.json.publishedCardImage480Url ?? imageRes.json.w480Url ?? "").trim();
    publishedCardImage320Url = (imageRes.json.publishedCardImage320Url ?? imageRes.json.w320Url ?? "").trim();
    publishedCardImageId = (imageRes.json.imageId ?? "").trim();
    if (!imageRes.ok || !publishedCardImageUrl || !publishedCardImage320Url || !publishedCardImageId) {
      return { ok: false, error: SERVER_CARD_IMAGE_FAIL_KO };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof DOMException && e.name === "AbortError" ? SERVER_CARD_IMAGE_FAIL_KO : SERVER_CARD_IMAGE_FAIL_KO,
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
