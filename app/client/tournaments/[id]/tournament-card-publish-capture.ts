"use client";

import {
  captureCardRegionViaCaromNativeBridge,
  hasCaromNativeCaptureBridge,
  isCaromAppWebViewRuntime,
} from "../../../../lib/carom-app-webview-runtime";

/** 네이티브 캡처 출력 목표 가로 픽셀 (크롭 후 리사이즈) */
export const NATIVE_CAPTURE_TARGET_WIDTH = 960;

const APP_ONLY_MSG = "게시카드 저장 기능은 앱에서만 가능합니다.";
const APP_CAPTURE_FAIL_MSG = "앱 화면 캡처에 실패했습니다. 화면을 다시 확인 후 재시도해 주세요.";

/** 앱 전용 차단 에러임을 외부에서 감지할 수 있도록 code를 붙인다. */
export const APP_ONLY_ERROR_CODE = "E_APP_ONLY";

let nativeCaptureInFlight = false;

function logCapture(msg: string, extra?: Record<string, unknown>): void {
  if (extra) console.info("[card-publish-capture]", msg, extra);
  else console.info("[card-publish-capture]", msg);
}

function makeCodedError(message: string, code: string): Error & { code: string } {
  const e = new Error(message) as Error & { code: string };
  e.code = code;
  return e;
}

function decodeBase64PngToBlob(base64: string): Blob {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

/**
 * 편집 화면의 카드 article 요소를 Android native bridge로 픽셀 캡처하고
 * 가로 640px PNG로 리사이즈한 뒤 `POST /api/client/tournament-card-image`(multipart)로 업로드한다.
 *
 * - html2canvas 미사용: 레이아웃 재계산 없이 화면에 보이는 그대로 캡처한다.
 * - 앱(Android WebView) 외 환경에서는 기능을 엄격히 차단한다.
 */
export async function captureAndUploadTournamentPublishedCardFullPngInBrowser(args: {
  tournamentId: string;
  /** `CardPublishPreview` 아트보드 루트(ref) */
  previewCaptureRoot: HTMLElement;
  signal?: AbortSignal;
}): Promise<{
  imageId: string;
  publishedCardImageUrl: string;
  publishedCardImage320Url: string;
  publishedCardImage480Url: string;
}> {
  const { tournamentId, previewCaptureRoot, signal } = args;

  const isNative = isCaromAppWebViewRuntime();
  logCapture(`runtime = ${isNative ? "native" : "web"}`, { tournamentId });

  // 앱 외 환경 엄격 차단
  if (!isNative) {
    logCapture("blocked: non-native runtime");
    throw makeCodedError(APP_ONLY_MSG, APP_ONLY_ERROR_CODE);
  }

  // bridge 가용성 확인
  if (!hasCaromNativeCaptureBridge()) {
    logCapture("native result fail", { code: "E_BRIDGE_UNAVAILABLE" });
    throw makeCodedError(APP_CAPTURE_FAIL_MSG, "E_BRIDGE_UNAVAILABLE");
  }

  if (nativeCaptureInFlight) {
    logCapture("native result fail", { code: "E_CAPTURE_FAILED", reason: "in_flight" });
    throw makeCodedError(APP_CAPTURE_FAIL_MSG, "E_CAPTURE_FAILED");
  }

  // 카드 article 요소 찾기
  const articleEl = previewCaptureRoot.querySelector(
    '[data-tournament-card-capture-root="1"]',
  ) as HTMLElement | null;
  if (!(articleEl instanceof HTMLElement)) {
    const msg = "게시카드 미리보기에서 카드 요소를 찾을 수 없습니다.";
    console.error("[card-publish-capture]", msg);
    throw makeCodedError(msg, "E_CAPTURE_FAILED");
  }

  // 레이아웃·폰트 확정 대기
  if (typeof document.fonts?.ready?.then === "function") {
    await document.fonts.ready;
  }
  throwIfAborted(signal);
  await doubleRaf();
  throwIfAborted(signal);

  // rect 측정
  const rect = articleEl.getBoundingClientRect();
  logCapture("rect measured", {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });

  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width < 2 ||
    rect.height < 2
  ) {
    logCapture("native result fail", {
      code: "E_INVALID_RECT",
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    });
    throw makeCodedError(APP_CAPTURE_FAIL_MSG, "E_INVALID_RECT");
  }

  // Native capture (Android bridge)
  nativeCaptureInFlight = true;
  let blob: Blob;
  let captureWidth = 0;
  let captureHeight = 0;
  try {
    throwIfAborted(signal);
    logCapture("native request sent", {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      targetWidth: NATIVE_CAPTURE_TARGET_WIDTH,
    });
    const native = await captureCardRegionViaCaromNativeBridge({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      targetWidth: NATIVE_CAPTURE_TARGET_WIDTH,
      timeoutMs: 12_000,
    });
    throwIfAborted(signal);
    blob = decodeBase64PngToBlob(native.base64);
    captureWidth = native.cropWidth;
    captureHeight = native.cropHeight;
    logCapture("native capture ok", {
      cropWidth: captureWidth,
      cropHeight: captureHeight,
      blobBytes: blob.size,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const code = (err as Error & { code?: string }).code ?? "E_CAPTURE_FAILED";
    const nativeDetail = err.message || "";
    logCapture("native result fail", { code, nativeDetail });

    if (err.name === "AbortError" || code === APP_ONLY_ERROR_CODE) throw e;

    const fullMsg = nativeDetail
      ? `${APP_CAPTURE_FAIL_MSG}\n상세: ${nativeDetail}`
      : APP_CAPTURE_FAIL_MSG;
    throw makeCodedError(fullMsg, code);
  } finally {
    nativeCaptureInFlight = false;
  }

  if (blob.size < 2800) {
    throw makeCodedError(
      "캡처 PNG가 비정상적으로 작습니다. 미리보기를 확인한 뒤 다시 게시해 주세요.",
      "E_CAPTURE_FAILED",
    );
  }

  // multipart 업로드
  const formData = new FormData();
  formData.append("tournamentId", tournamentId);
  formData.append("file", blob, "tournament-published-card.png");
  logCapture("upload start", {
    route: "/api/client/tournament-card-image",
    blobBytes: blob.size,
    width: captureWidth,
    height: captureHeight,
  });

  const res = await fetch("/api/client/tournament-card-image", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal,
  });
  const json = (await res.json()) as {
    error?: string;
    imageId?: string;
    publishedCardImageUrl?: string;
    publishedCardImage320Url?: string;
    publishedCardImage480Url?: string;
    w640Url?: string;
    w480Url?: string;
    w320Url?: string;
  };
  const publishedCardImageUrl = (json.publishedCardImageUrl ?? json.w640Url ?? "").trim();
  const publishedCardImage320Url = (json.publishedCardImage320Url ?? json.w320Url ?? "").trim();
  const publishedCardImage480Url = (json.publishedCardImage480Url ?? json.w480Url ?? "").trim();
  const imageId = (json.imageId ?? "").trim();
  if (!res.ok || !publishedCardImageUrl || !publishedCardImage320Url || !imageId) {
    logCapture("upload fail", {
      status: res.status,
      error: json.error,
      hasImageId: Boolean(imageId),
      has640: Boolean(publishedCardImageUrl),
      has320: Boolean(publishedCardImage320Url),
    });
    throw new Error(json.error ?? "게시 카드 이미지 업로드에 실패했습니다.");
  }
  logCapture("upload ok", { imageId, status: res.status });
  return {
    imageId,
    publishedCardImageUrl,
    publishedCardImage320Url,
    publishedCardImage480Url: publishedCardImage480Url || publishedCardImage320Url,
  };
}
