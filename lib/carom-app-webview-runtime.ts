/**
 * 브라우저에서 캐롬클럽 앱 WebView 여부를 판별한다.
 * `lib/is-carom-club-mobile-app-shell.ts`(요청 헤더·환경)와 동일한 UA·브릿지 신호를 본다.
 * 서버에서 놓친 요청도 클라이언트 복구용으로 사용한다.
 */
export function isCaromAppWebViewRuntime(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const bridge = (window as Window & { CaromAppBridge?: unknown }).CaromAppBridge;
    if (bridge != null && typeof bridge === "object") return true;
  } catch {
    /* ignore */
  }
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  if (ua.includes("; wv)") || ua.includes("; wv ")) return true;
  if (ua.includes("caromclubapp") || ua.includes("carom-club-app")) return true;
  return false;
}

type CaromNativeCaptureRequest = {
  requestId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  format: "png";
  /** 크롭 후 리사이즈할 목표 가로 픽셀 (0 이하면 리사이즈 생략) */
  targetWidth: number;
};

type CaromNativeCaptureResult =
  | {
      ok: true;
      requestId: string;
      format: "png";
      mimeType: string;
      base64: string;
      bitmapWidth: number;
      bitmapHeight: number;
      cropWidth: number;
      cropHeight: number;
    }
  | {
      ok: false;
      requestId: string;
      code: string;
      message: string;
    };

type CaptureBridge = { captureCardRegion?: (requestJson: string) => void };

type CaptureWindow = Window & {
  CaromAppBridge?: CaptureBridge;
  CaromNativeCapture?: { onResult?: (resultJson: string) => void };
};

const capturePending = new Map<
  string,
  {
    resolve: (result: Extract<CaromNativeCaptureResult, { ok: true }>) => void;
    reject: (error: Error & { code?: string }) => void;
    timer: number;
  }
>();

function makeCaptureError(message: string, code?: string): Error & { code?: string } {
  const e = new Error(message) as Error & { code?: string };
  if (code) e.code = code;
  return e;
}

function logNativeCaptureDiag(message: string, extra?: Record<string, unknown>): void {
  if (extra) console.info("[card-publish-capture]", message, extra);
  else console.info("[card-publish-capture]", message);
}

function ensureCaromNativeCaptureResultHandler(): void {
  if (typeof window === "undefined") return;
  const w = window as CaptureWindow;
  const current = w.CaromNativeCapture?.onResult;
  if (typeof current === "function" && (current as unknown as { __caromNativeBound?: boolean }).__caromNativeBound) {
    logNativeCaptureDiag("native onResult already registered");
    return;
  }
  const handler = (resultJson: string) => {
    let payload: CaromNativeCaptureResult;
    try {
      payload = JSON.parse(resultJson) as CaromNativeCaptureResult;
    } catch {
      return;
    }
    const requestId = typeof payload.requestId === "string" ? payload.requestId.trim() : "";
    if (!requestId) return;
    const pending = capturePending.get(requestId);
    if (!pending) return;
    capturePending.delete(requestId);
    window.clearTimeout(pending.timer);
    if (payload.ok) {
      logNativeCaptureDiag("native result ok", {
        requestId,
        cropWidth: payload.cropWidth,
        cropHeight: payload.cropHeight,
      });
      pending.resolve(payload);
      return;
    }
    logNativeCaptureDiag("native result fail", {
      requestId,
      code: payload.code,
      message: payload.message,
    });
    pending.reject(makeCaptureError(payload.message || "앱 화면 캡처에 실패했습니다.", payload.code));
  };
  (handler as unknown as { __caromNativeBound?: boolean }).__caromNativeBound = true;
  w.CaromNativeCapture = w.CaromNativeCapture ?? {};
  w.CaromNativeCapture.onResult = handler;
  logNativeCaptureDiag("native onResult registered", {
    hasCaromNativeCaptureObject: Boolean(w.CaromNativeCapture),
    hasOnResult: typeof w.CaromNativeCapture?.onResult === "function",
  });
}

export function hasCaromNativeCaptureBridge(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as CaptureWindow;
  return Boolean(w.CaromAppBridge && typeof w.CaromAppBridge.captureCardRegion === "function");
}

export async function captureCardRegionViaCaromNativeBridge(args: {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  /** 크롭 후 리사이즈할 목표 가로 픽셀. 기본값 960. */
  targetWidth?: number;
  timeoutMs?: number;
}): Promise<Extract<CaromNativeCaptureResult, { ok: true }>> {
  if (typeof window === "undefined") {
    throw makeCaptureError("브라우저 환경이 아닙니다.", "E_BRIDGE_UNAVAILABLE");
  }
  const w = window as CaptureWindow;
  const bridge = w.CaromAppBridge;
  if (!bridge || typeof bridge.captureCardRegion !== "function") {
    throw makeCaptureError("앱 캡처 브리지를 찾을 수 없습니다.", "E_BRIDGE_UNAVAILABLE");
  }
  logNativeCaptureDiag("native bridge precheck", {
    hasCaromAppBridge: Boolean(w.CaromAppBridge),
    hasCaptureCardRegion: typeof w.CaromAppBridge?.captureCardRegion === "function",
    hasOnResultBeforeEnsure: typeof w.CaromNativeCapture?.onResult === "function",
  });
  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `cap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  ensureCaromNativeCaptureResultHandler();
  const request: CaromNativeCaptureRequest = {
    requestId,
    left: args.left,
    top: args.top,
    width: args.width,
    height: args.height,
    viewportWidth: args.viewportWidth ?? window.innerWidth,
    viewportHeight: args.viewportHeight ?? window.innerHeight,
    devicePixelRatio: args.devicePixelRatio ?? (window.devicePixelRatio || 1),
    format: "png",
    targetWidth: args.targetWidth ?? 960,
  };
  return await new Promise<Extract<CaromNativeCaptureResult, { ok: true }>>((resolve, reject) => {
    const timeoutMs = Math.max(1_000, args.timeoutMs ?? 12_000);
    const timer = window.setTimeout(() => {
      capturePending.delete(requestId);
      logNativeCaptureDiag("native result fail", { requestId, code: "E_CAPTURE_TIMEOUT" });
      reject(makeCaptureError("앱 화면 캡처 시간이 초과되었습니다.", "E_CAPTURE_TIMEOUT"));
    }, timeoutMs);
    capturePending.set(requestId, { resolve, reject, timer });
    try {
      logNativeCaptureDiag("native request sent", {
        requestId,
        left: request.left,
        top: request.top,
        width: request.width,
        height: request.height,
        viewportWidth: request.viewportWidth,
        viewportHeight: request.viewportHeight,
        targetWidth: request.targetWidth,
      });
      bridge.captureCardRegion!(JSON.stringify(request));
    } catch {
      window.clearTimeout(timer);
      capturePending.delete(requestId);
      logNativeCaptureDiag("native result fail", { requestId, code: "E_CAPTURE_FAILED" });
      reject(makeCaptureError("앱 화면 캡처 브리지 호출에 실패했습니다.", "E_CAPTURE_FAILED"));
    }
  });
}
