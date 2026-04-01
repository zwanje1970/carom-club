import "server-only";

export type GoogleOcrResult = {
  text: string;
  status: "success" | "failed";
  /** 최소 메타 */
  meta?: { locale?: string; errorMessage?: string };
};

async function getVisionClient(): Promise<import("@google-cloud/vision").ImageAnnotatorClient | null> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (!projectId || !clientEmail || !rawKey) {
    return null;
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  try {
    const { ImageAnnotatorClient } = await import("@google-cloud/vision");
    return new ImageAnnotatorClient({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });
  } catch (e) {
    console.error("[google-ocr] ImageAnnotatorClient init failed:", e);
    return null;
  }
}

/**
 * 이미지 바이너리에 대해 Document Text Detection 1회 (서버 전용).
 * 환경변수 미설정 시 실패 결과 반환 (신청 API에서 접수 유지 + pending 정책과 조합).
 */
export async function runGoogleOcrOnImageBuffer(buffer: Buffer): Promise<GoogleOcrResult> {
  const client = await getVisionClient();
  if (!client) {
    return {
      text: "",
      status: "failed",
      meta: { errorMessage: "OCR 환경변수가 설정되지 않았습니다." },
    };
  }
  try {
    const [result] = await client.documentTextDetection({ image: { content: buffer } });
    const text = result.fullTextAnnotation?.text?.trim() ?? "";
    if (!text) {
      return { text: "", status: "failed", meta: { errorMessage: "추출 텍스트가 비어 있습니다." } };
    }
    return { text, status: "success" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[google-ocr] documentTextDetection error:", msg);
    return { text: "", status: "failed", meta: { errorMessage: msg } };
  }
}
