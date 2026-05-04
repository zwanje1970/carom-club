/**
 * OCR: 증빙 이미지에서 텍스트 추출만 담당한다.
 * 참가 자격 판정용 숫자 기준은 대회 규칙의 eligibilityValue(및 관련 필드)만 사용한다.
 * entryCondition(조건 설명 문장) 본문에서 숫자를 읽어 기준으로 삼지 않는다.
 */
import { getStoredProofImageVariantUrl } from "./proof-image-storage-url";
import { readProofImageVariantFile } from "./read-proof-image-variant";
import {
  completeTournamentApplicationOcr,
  getProofImageAssetById,
  getTournamentApplicationById,
  getTournamentById,
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
import { runGoogleOcrOnImageBuffer } from "./google-ocr";
import { checkOcrEligibility, parseOcrEligibilityText } from "./ocr-eligibility-parser";
import { getTournamentByIdFirestore } from "./firestore-tournaments";

export type OcrResultStatus = "success" | "failed";

export type OcrRecognitionResult = {
  rawText: string;
  extractedValue: string | null;
  confidence: number | null;
  provider: string;
  processedAt: string;
  status: OcrResultStatus;
};

async function loadProofImageOriginalBuffer(proofImage: ProofImageAsset): Promise<Buffer> {
  const url = getStoredProofImageVariantUrl(proofImage, "original");
  if (url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("proof image fetch failed");
    }
    return Buffer.from(await response.arrayBuffer());
  }
  const fromDisk = await readProofImageVariantFile(proofImage.id, "original", proofImage.originalExt);
  if (!fromDisk) {
    throw new Error("proof image not found on disk");
  }
  return fromDisk.buffer;
}

async function runMockOcrFromSeed(seed: { depositorName: string; phone: string }): Promise<OcrRecognitionResult> {
  return {
    rawText: `입금자명 추정: ${seed.depositorName}\n전화번호 추정: ${seed.phone}`,
    extractedValue: seed.depositorName || null,
    confidence: 0.78,
    provider: "mock",
    processedAt: new Date().toISOString(),
    status: "success",
  };
}

async function runMockOcr(application: TournamentApplication): Promise<OcrRecognitionResult> {
  return runMockOcrFromSeed({ depositorName: application.depositorName, phone: application.phone });
}

/**
 * 신청서 없이 증빙 이미지 자산만으로 OCR을 실행한다(사이트 신청 전 게이트용).
 * mock 프로바이더일 때는 `mockSeed`로 OCR 텍스트를 채운다.
 */
export async function runOcrForProofImageAsset(
  proofImage: ProofImageAsset,
  mockSeed?: { depositorName: string; phone: string }
): Promise<OcrRecognitionResult> {
  const providerEnv = (process.env.OCR_PROVIDER ?? "mock").trim() || "mock";
  try {
    if (providerEnv === "http") {
      const imageBuffer = await loadProofImageOriginalBuffer(proofImage);
      return await runHttpOcrFromBuffer(imageBuffer);
    }
    if (providerEnv === "google") {
      const imageBuffer = await loadProofImageOriginalBuffer(proofImage);
      const google = await runGoogleOcrOnImageBuffer(imageBuffer);
      const processedAt = new Date().toISOString();
      if (google.status !== "success") {
        return {
          rawText: "",
          extractedValue: null,
          confidence: null,
          provider: "google",
          processedAt,
          status: "failed",
        };
      }
      const rawText = google.text.slice(0, 2000);
      return {
        rawText,
        extractedValue: null,
        confidence: null,
        provider: "google",
        processedAt,
        status: "success",
      };
    }
    return await runMockOcrFromSeed(mockSeed ?? { depositorName: "", phone: "" });
  } catch {
    const providerLabel =
      providerEnv === "http" ? "http" : providerEnv === "google" ? "google" : "mock";
    return {
      rawText: "",
      extractedValue: null,
      confidence: null,
      provider: providerLabel,
      processedAt: new Date().toISOString(),
      status: "failed",
    };
  }
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

  return runOcrForProofImageAsset(proofImage, {
    depositorName: application.depositorName,
    phone: application.phone,
  });
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

    let parsed: ReturnType<typeof parseOcrEligibilityText> | undefined;
    let eligibilityCheck: ReturnType<typeof checkOcrEligibility> | undefined;
    if (result.status === "success" && result.rawText.trim() !== "") {
      try {
        parsed = parseOcrEligibilityText(result.rawText);
        const tournament = isFirestoreUsersBackendConfigured()
          ? await getTournamentByIdFirestore(tournamentId)
          : await getTournamentById(tournamentId);
        if (tournament?.rule) {
          eligibilityCheck = checkOcrEligibility(parsed, tournament.rule);
        }
      } catch (e) {
        console.warn("[ocr-service] OCR eligibility parse/check failed", e);
      }
    }

    const normalizedRawResult = JSON.stringify(
      {
        status: result.status,
        provider: result.provider,
        rawText: result.rawText,
        extractedValue: result.extractedValue,
        confidence: result.confidence,
        processedAt: result.processedAt,
        ...(parsed ? { parsed } : {}),
        ...(eligibilityCheck ? { eligibilityCheck } : {}),
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
