/**
 * TEST ONLY — 로컬 OCR 스모크 테스트.
 * `public/ocr-test/receipt.jpg`(없으면 `receipt.jpg.jpg`)를 읽어 HTTP OCR 엔드포인트로 전송한다.
 * 대회 신청/입금/DB/플랫폼 스토어와 연결하지 않는다.
 *
 * 프로덕션 OCR 계약은 `lib/server/ocr-service.ts`의 `runHttpOcrFromBuffer`와 동일한 JSON POST 본문을 사용한다.
 *
 * 실행 예:
 *   npm run test:ocr-receipt
 *
 * HTTP OCR 사용 시(필수):
 *   OCR_HTTP_ENDPOINT=https://... [OCR_HTTP_API_KEY=...] npm run test:ocr-receipt
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type OcrTestReport = {
  success: boolean;
  extractedText: string;
  confidence: number | null;
  errorMessage: string | null;
  /** 디버그용: 실제로 읽은 파일 경로(프로젝트 루트 기준 상대) */
  imagePathUsed: string | null;
};

const PRIMARY_REL = join("public", "ocr-test", "receipt.jpg");
const FALLBACK_REL = join("public", "ocr-test", "receipt.jpg.jpg");

function resolveImagePath(): { rel: string; abs: string } | null {
  const cwd = process.cwd();
  const primary = join(cwd, PRIMARY_REL);
  if (existsSync(primary)) return { rel: PRIMARY_REL, abs: primary };
  const fallback = join(cwd, FALLBACK_REL);
  if (existsSync(fallback)) return { rel: FALLBACK_REL, abs: fallback };
  return null;
}

/** `runHttpOcrFromBuffer`와 동일한 요청/응답 파싱(스크립트 단독 실행용 복제). */
async function runHttpOcrFromBuffer(buffer: Buffer): Promise<{
  rawText: string;
  extractedValue: string | null;
  confidence: number | null;
}> {
  const endpoint = process.env.OCR_HTTP_ENDPOINT?.trim() ?? "";
  if (!endpoint) {
    throw new Error("OCR_HTTP_ENDPOINT is not set");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OCR_HTTP_API_KEY
        ? {
            Authorization: `Bearer ${process.env.OCR_HTTP_API_KEY}`,
          }
        : {}),
    },
    body: JSON.stringify({
      imageBase64: buffer.toString("base64"),
    }),
  });

  if (!response.ok) {
    throw new Error(`OCR provider request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    rawText?: unknown;
    extractedValue?: unknown;
    confidence?: unknown;
  };

  const rawText = typeof payload.rawText === "string" ? payload.rawText : "";
  const extractedValue =
    typeof payload.extractedValue === "string" ? payload.extractedValue.slice(0, 200) : null;
  const confidence =
    typeof payload.confidence === "number" && Number.isFinite(payload.confidence)
      ? payload.confidence
      : null;

  return {
    rawText: rawText.slice(0, 2000),
    extractedValue,
    confidence,
  };
}

async function main(): Promise<OcrTestReport> {
  const resolved = resolveImagePath();
  if (!resolved) {
    return {
      success: false,
      extractedText: "",
      confidence: null,
      errorMessage: `이미지를 찾을 수 없습니다. 다음 중 하나를 두세요: ${PRIMARY_REL} 또는 ${FALLBACK_REL}`,
      imagePathUsed: null,
    };
  }

  const buffer = readFileSync(resolved.abs);
  if (!process.env.OCR_HTTP_ENDPOINT?.trim()) {
    return {
      success: false,
      extractedText: "",
      confidence: null,
      errorMessage:
        "OCR_HTTP_ENDPOINT 가 설정되어 있지 않습니다. .env.local 등에 엔드포인트를 넣은 뒤 동일 셸에서 다시 실행하세요.",
      imagePathUsed: resolved.rel,
    };
  }

  try {
    const { rawText, extractedValue, confidence } = await runHttpOcrFromBuffer(buffer);
    const extractedText = (rawText.trim() || (extractedValue ?? "").trim()).slice(0, 4000);
    return {
      success: true,
      extractedText,
      confidence,
      errorMessage: null,
      imagePathUsed: resolved.rel,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e ?? "unknown error");
    return {
      success: false,
      extractedText: "",
      confidence: null,
      errorMessage: message,
      imagePathUsed: resolved.rel,
    };
  }
}

const report = await main();
console.log(JSON.stringify(report, null, 2));
