/**
 * OCR: 증빙 이미지에서 텍스트 추출만 담당한다.
 * 참가 자격 판정용 숫자 기준은 대회 규칙의 eligibilityValue(및 관련 필드)만 사용한다.
 * entryCondition(조건 설명 문장) 본문에서 숫자를 읽어 기준으로 삼지 않는다.
 */
import { readFile } from "fs/promises";
import path from "path";
import { getProofImagesBaseDir } from "./proof-images-base-dir";
import { getStoredProofImageVariantUrl } from "./proof-image-storage-url";
import {
  completeTournamentApplicationOcr,
  getProofImageAssetById,
  getTournamentApplicationById,
  markTournamentApplicationOcrProcessing,
  type ProofImageAsset,
  type TournamentApplication,
} from "./platform-backing-store";
import {
  completeTournamentApplicationOcrFirestore,
  getTournamentApplicationByIdFirestore,
  markTournamentApplicationOcrProcessingFirestore,
} from "./firestore-tournament-applications";
import { isFirestoreUsersBackendConfigured } from "./firestore-users";

export type OcrResultStatus = "success" | "failed";

export type OcrRecognitionResult = {
  rawText: string;
  extractedValue: string | null;
  confidence: number | null;
  provider: string;
  processedAt: string;
  status: OcrResultStatus;
};

function resolveProofImageAbsolutePath(params: { imageId: string; originalExt: "jpg" | "png" | "webp" }): string {
  return path.join(getProofImagesBaseDir(), "original", `${params.imageId}.${params.originalExt}`);
}

async function loadProofImageOriginalBuffer(proofImage: ProofImageAsset): Promise<Buffer> {
  const url = getStoredProofImageVariantUrl(proofImage, "original");
  if (url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("proof image fetch failed");
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(
    resolveProofImageAbsolutePath({ imageId: proofImage.id, originalExt: proofImage.originalExt })
  );
}

async function runMockOcr(application: TournamentApplication): Promise<OcrRecognitionResult> {
  return {
    rawText: `입금자명 추정: ${application.depositorName}\n전화번호 추정: ${application.phone}`,
    extractedValue: application.depositorName || null,
    confidence: 0.78,
    provider: "mock",
    processedAt: new Date().toISOString(),
    status: "success",
  };
}

async function runHttpOcrFromBuffer(buffer: Buffer): Promise<OcrRecognitionResult> {
  const endpoint = process.env.OCR_HTTP_ENDPOINT?.trim() ?? "";
  if (!endpoint) {
    throw new Error("OCR endpoint is not configured");
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
    throw new Error("OCR provider request failed");
  }

  const payload = (await response.json()) as {
    rawText?: unknown;
    extractedValue?: unknown;
    confidence?: unknown;
    provider?: unknown;
  };

  const rawText = typeof payload.rawText === "string" ? payload.rawText : "";
  const extractedValue = typeof payload.extractedValue === "string" ? payload.extractedValue.slice(0, 200) : null;
  const confidence = typeof payload.confidence === "number" && Number.isFinite(payload.confidence) ? payload.confidence : null;
  const provider = typeof payload.provider === "string" && payload.provider.trim() ? payload.provider.trim() : "http";
  return {
    rawText: rawText.slice(0, 2000),
    extractedValue,
    confidence,
    provider,
    processedAt: new Date().toISOString(),
    status: "success",
  };
}

export async function runOcrForProofImage(params: {
  tournamentId: string;
  entryId: string;
}): Promise<OcrRecognitionResult> {
  const application = isFirestoreUsersBackendConfigured()
    ? await getTournamentApplicationByIdFirestore(params.tournamentId, params.entryId)
    : await getTournamentApplicationById(params.tournamentId, params.entryId);
  if (!application) {
    return {
      rawText: "",
      extractedValue: null,
      confidence: null,
      provider: "system",
      processedAt: new Date().toISOString(),
      status: "failed",
    };
  }

  const proofImage = await getProofImageAssetById(application.proofImageId);
  if (!proofImage) {
    return {
      rawText: "",
      extractedValue: null,
      confidence: null,
      provider: "system",
      processedAt: new Date().toISOString(),
      status: "failed",
    };
  }

  try {
    if ((process.env.OCR_PROVIDER ?? "mock").trim() === "http") {
      const imageBuffer = await loadProofImageOriginalBuffer(proofImage);
      return await runHttpOcrFromBuffer(imageBuffer);
    }
    return await runMockOcr(application);
  } catch {
    return {
      rawText: "",
      extractedValue: null,
      confidence: null,
      provider: (process.env.OCR_PROVIDER ?? "mock").trim() || "mock",
      processedAt: new Date().toISOString(),
      status: "failed",
    };
  }
}

export function triggerOcrForTournamentApplication(params: { tournamentId: string; entryId: string }): void {
  const tournamentId = params.tournamentId.trim();
  const entryId = params.entryId.trim();
  if (!tournamentId || !entryId) return;

  void (async () => {
    const processing = isFirestoreUsersBackendConfigured()
      ? await markTournamentApplicationOcrProcessingFirestore({ tournamentId, entryId })
      : await markTournamentApplicationOcrProcessing({ tournamentId, entryId });
    if (!processing) return;

    const result = await runOcrForProofImage({ tournamentId, entryId });
    const normalizedRawResult = JSON.stringify(
      {
        status: result.status,
        provider: result.provider,
        rawText: result.rawText,
        extractedValue: result.extractedValue,
        confidence: result.confidence,
        processedAt: result.processedAt,
      },
      null,
      2
    );

    const ocrParams = {
      tournamentId,
      entryId,
      text: result.rawText.slice(0, 2000),
      rawResult: normalizedRawResult,
      failed: result.status !== "success",
    };
    if (isFirestoreUsersBackendConfigured()) {
      await completeTournamentApplicationOcrFirestore(ocrParams);
    } else {
      await completeTournamentApplicationOcr(ocrParams);
    }
  })();
}
