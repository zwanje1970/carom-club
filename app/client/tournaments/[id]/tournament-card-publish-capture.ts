"use client";

import {
  captureCardRegionViaCaromNativeBridge,
  hasCaromNativeCaptureBridge,
  isCaromAppWebViewRuntime,
} from "../../../../lib/carom-app-webview-runtime";

/** 네이티브 캡처 출력 목표 가로 픽셀 (크롭 후 리사이즈) */
export const NATIVE_CAPTURE_TARGET_WIDTH = 640;

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

/** 디버깅: 화면에 강제 팝업. 원인 확인 후 제거할 것. */
function diagAlert(step: string, detail: string): void {
  if (typeof window === "undefined") return;
  window.alert(`[JS 진단 — ${step}]\n\n${detail}`);
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

export async function captureAndUploadTournamentPublishedCardFullPngInBrowser(args: {
  tournamentId: string;
  previewCaptureRoot: HTMLElement;
  signal?: AbortSignal;
}): Promise<{
  imageId: string;
  publishedCardImageUrl: string;
  publishedCardImage320Url: string;
  publishedCardImage480Url: string;
}> {
  const { tournamentId, previewCaptureRoot, signal } = args;

  // ── 체크포인트 1: 런타임 판별 ─────────────────────────────
  const w = window as Window & {
    CaromAppBridge?: { captureCardRegion?: unknown };
    CaromNativeCapture?: { onResult?: unknown };
  };
  const isNative = isCaromAppWebViewRuntime();
  const hasBridge = hasCaromNativeCaptureBridge();
  const bridgeKeys = w.CaromAppBridge
    ? Object.keys(w.CaromAppBridge as object).join(", ") || "(no enumerable keys)"
    : "(CaromAppBridge 없음)";
  const captureCardRegionType = w.CaromAppBridge
    ? typeof (w.CaromAppBridge as Record<string, unknown>)["captureCardRegion"]
    : "N/A";

  diagAlert(
    "1 런타임 판별",
    `isCaromAppWebViewRuntime: ${isNative}\nhasCaromNativeCaptureBridge: ${hasBridge}\nwindow.CaromAppBridge 존재: ${Boolean(w.CaromAppBridge)}\nCaromAppBridge keys: ${bridgeKeys}\ntypeof captureCardRegion: ${captureCardRegionType}\nUserAgent: ${navigator.userAgent.slice(0, 120)}`,
  );

  logCapture(`runtime = ${isNative ? "native" : "web"}`, { tournamentId, isNative, hasBridge });

  if (!isNative) {
    logCapture("blocked: non-native runtime");
    throw makeCodedError(APP_ONLY_MSG, APP_ONLY_ERROR_CODE);
  }

  // ── 체크포인트 2: bridge 메서드 가용성 ──────────────────────
  if (!hasBridge) {
    diagAlert(
      "2 bridge 메서드 없음",
      `window.CaromAppBridge: ${JSON.stringify(w.CaromAppBridge)}\ntypeof captureCardRegion: ${captureCardRegionType}\n\n→ @JavascriptInterface 등록 누락 또는 메서드명 불일치 의심`,
    );
    logCapture("native result fail", { code: "E_BRIDGE_UNAVAILABLE" });
    throw makeCodedError(APP_CAPTURE_FAIL_MSG, "E_BRIDGE_UNAVAILABLE");
  }

  if (nativeCaptureInFlight) {
    diagAlert("2 in_flight", "이미 캡처가 진행 중입니다 (nativeCaptureInFlight = true)");
    logCapture("native result fail", { code: "E_CAPTURE_FAILED", reason: "in_flight" });
    throw makeCodedError(APP_CAPTURE_FAIL_MSG, "E_CAPTURE_FAILED");
  }

  // ── 체크포인트 3: 카드 article 요소 탐색 ────────────────────
  const articleEl = previewCaptureRoot.querySelector(
    '[data-tournament-card-capture-root="1"]',
  ) as HTMLElement | null;

  diagAlert(
    "3 DOM 탐색",
    `previewCaptureRoot tagName: ${previewCaptureRoot.tagName}\npreviewCaptureRoot id: ${previewCaptureRoot.id || "(없음)"}\narticleEl 발견: ${articleEl instanceof HTMLElement}\narticleEl: ${articleEl ? articleEl.outerHTML.slice(0, 120) : "null"}`,
  );

  if (!(articleEl instanceof HTMLElement)) {
    const msg = "게시카드 미리보기에서 카드 요소를 찾을 수 없습니다.";
    console.error("[card-publish-capture]", msg);
    throw makeCodedError(msg, "E_CAPTURE_FAILED");
  }

  // ── 체크포인트 4: 레이아웃 대기 후 rect 측정 ─────────────────
  if (typeof document.fonts?.ready?.then === "function") {
    await document.fonts.ready;
  }
  throwIfAborted(signal);
  await doubleRaf();
  throwIfAborted(signal);

  const rect = articleEl.getBoundingClientRect();
  diagAlert(
    "4 getBoundingClientRect",
    `left: ${rect.left}\ntop: ${rect.top}\nwidth: ${rect.width}\nheight: ${rect.height}\nwindow.innerWidth: ${window.innerWidth}\nwindow.innerHeight: ${window.innerHeight}\ndevicePixelRatio: ${window.devicePixelRatio}`,
  );

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

  // ── 체크포인트 5: bridge 호출 직전 ──────────────────────────
  diagAlert(
    "5 bridge 호출 직전",
    `이 팝업 이후 Android captureCardRegion 호출됩니다.\nrequestId는 Android Logcat에 출력됩니다.\ntargetWidth: ${NATIVE_CAPTURE_TARGET_WIDTH}`,
  );

  // ── Native capture (Android bridge) ──────────────────────
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
    logCapture("native base64->blob ok", {
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

    // ── 체크포인트 6: 네이티브 응답 실패 ─────────────────────
    const diagLabel =
      code === "E_DIAG_BRIDGE_OK"
        ? "✅ 브리지 연결 확인 (DIAG_BRIDGE_ECHO_TEST=true 상태)"
        : `❌ 캡처 실패 [${code}]`;
    diagAlert(
      `6 네이티브 응답 실패`,
      `${diagLabel}\n\n${nativeDetail || err.name + ": " + err.message}`,
    );

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

  // ── multipart 업로드 ──────────────────────────────────────
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
