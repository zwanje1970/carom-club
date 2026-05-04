/**
 * TEST ONLY — CLI에서 입금증 이미지로 Google Vision OCR을 검증한다.
 * `lib/server/google-ocr.ts`와 동일한 env·`documentTextDetection` 로직을 복제한다.
 * `import "server-only"` 때문에 해당 모듈을 tsx에서 직접 import할 수 없어, 테스트 전용으로만 중복한다.
 *
 *   npx tsx --env-file=.env.local scripts/ocr-test-google-vision-receipt.mts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as eligibilityParserModule from "../lib/server/ocr-eligibility-parser";

const mod = eligibilityParserModule as unknown as {
  parseOcrEligibilityText?: (rawText: string) => {
    name: string | null;
    phone: string | null;
    score: number | null;
    average: number | null;
  };
  default?: { parseOcrEligibilityText?: (rawText: string) => unknown };
};

const parseOcrEligibilityText =
  typeof mod.parseOcrEligibilityText === "function"
    ? mod.parseOcrEligibilityText
    : typeof mod.default?.parseOcrEligibilityText === "function"
      ? mod.default.parseOcrEligibilityText
      : null;

if (!parseOcrEligibilityText) {
  throw new Error("parseOcrEligibilityText could not be resolved from ocr-eligibility-parser");
}

type GoogleOcrResult = {
  text: string;
  status: "success" | "failed";
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
    console.error("[ocr-test-google] ImageAnnotatorClient init failed:", e);
    return null;
  }
}

async function runGoogleOcrOnImageBuffer(buffer: Buffer): Promise<GoogleOcrResult> {
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
    console.error("[ocr-test-google] documentTextDetection error:", msg);
    return { text: "", status: "failed", meta: { errorMessage: msg } };
  }
}

const PRIMARY = join("public", "ocr-test", "receipt.jpg");
const FALLBACK = join("public", "ocr-test", "receipt.jpg.jpg");

function resolvePath(): string {
  const cwd = process.cwd();
  const p = join(cwd, PRIMARY);
  if (existsSync(p)) return p;
  const f = join(cwd, FALLBACK);
  if (existsSync(f)) return f;
  throw new Error(`이미지 없음: ${PRIMARY} 또는 ${FALLBACK}`);
}

const imagePath = resolvePath();
const buf = readFileSync(imagePath);
const result = await runGoogleOcrOnImageBuffer(buf);
const parsed = result.status === "success" ? parseOcrEligibilityText(result.text) : null;
console.log(
  JSON.stringify(
    {
      imagePath,
      status: result.status,
      textPreview: result.text.slice(0, 800),
      textLength: result.text.length,
      parsed,
      meta: result.meta ?? null,
    },
    null,
    2,
  ),
);
