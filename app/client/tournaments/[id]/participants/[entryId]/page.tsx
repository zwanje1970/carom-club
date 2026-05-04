import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getTournamentApplicationByIdFirestore } from "../../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";
import StatusTransitionControls from "./StatusTransitionControls";

const STATUS_LABELS = {
  APPLIED: "신청접수",
  VERIFYING: "검토중",
  WAITING_PAYMENT: "입금대기",
  APPROVED: "참가자",
  REJECTED: "거절",
} as const;

const STATUS_DESCRIPTIONS = {
  APPLIED: "신청 접수됨",
  VERIFYING: "운영 검토중",
  WAITING_PAYMENT: "입금 확인 필요",
  APPROVED: "입금 확인 완료(참가자)",
  REJECTED: "참가 거절",
} as const;

type OcrAugmentParsed = {
  name: string | null;
  phone: string | null;
  score: number | null;
  average: number | null;
};

type OcrAugmentEligibility = {
  target?: unknown;
  extractedValue?: unknown;
  limit?: unknown;
  compare?: unknown;
  passed?: unknown;
  message?: unknown;
};

function readOcrAugmentFromRawResult(ocrRawResult: string | undefined): {
  parsed: OcrAugmentParsed | null;
  eligibilityCheck: OcrAugmentEligibility | null;
} {
  const raw = ocrRawResult?.trim() ?? "";
  if (!raw) return { parsed: null, eligibilityCheck: null };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const parsedRaw = obj.parsed;
    const eligibilityRaw = obj.eligibilityCheck;
    const parsed =
      parsedRaw && typeof parsedRaw === "object" && !Array.isArray(parsedRaw)
        ? (parsedRaw as OcrAugmentParsed)
        : null;
    const eligibilityCheck =
      eligibilityRaw && typeof eligibilityRaw === "object" && !Array.isArray(eligibilityRaw)
        ? (eligibilityRaw as OcrAugmentEligibility)
        : null;
    return { parsed, eligibilityCheck };
  } catch {
    return { parsed: null, eligibilityCheck: null };
  }
}

function formatOcrAugmentField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const s = typeof value === "number" ? String(value) : value.trim();
  return s ? s : "—";
}

function eligibilityPassedLabel(passed: unknown): string {
  if (passed === true) return "충족(참고)";
  if (passed === false) return "미충족 가능(참고)";
  return "판정불가(참고)";
}

export default async function ClientTournamentParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) notFound();

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const canView = Boolean(session && tournament.createdBy === session.userId);
  if (!canView) notFound();

  const entry = await getTournamentApplicationByIdFirestore(id, entryId);
  if (!entry) notFound();

  const isAdminEntry = entry.registrationSource === "admin";
  const ocrAugment = readOcrAugmentFromRawResult(entry.ocrRawResult);

  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1" style={{ marginBottom: 0 }}>
        신청자 상세
      </h1>

      <section className="v3-box v3-stack">
        <p>
          <strong>대회:</strong> {tournament.title}
        </p>
        <p>
          <strong>신청자명:</strong> {entry.applicantName}
        </p>
        <p>
          <strong>전화번호:</strong> {entry.phone || "—"}
        </p>
        {isAdminEntry && entry.participantAverage != null && Number.isFinite(entry.participantAverage) ? (
          <p>
            <strong>에버:</strong> {entry.participantAverage}
          </p>
        ) : null}
        {isAdminEntry && entry.adminNote?.trim() ? (
          <p>
            <strong>비고:</strong> {entry.adminNote.trim()}
          </p>
        ) : null}
        {isAdminEntry ? (
          <p>
            <strong>등록방식:</strong> 관리자 등록
          </p>
        ) : null}
        <p>
          <strong>입금자명:</strong> {entry.depositorName || "—"}
        </p>
        <p>
          <strong>상태:</strong> {STATUS_LABELS[entry.status]} ({entry.status})
        </p>
        <p>
          <strong>운영 안내:</strong> {STATUS_DESCRIPTIONS[entry.status]}
        </p>
        <p>
          <strong>신청 시각:</strong> {new Date(entry.createdAt).toLocaleString("ko-KR")}
        </p>
        <p>
          <strong>상태 변경 시각:</strong> {new Date(entry.statusChangedAt).toLocaleString("ko-KR")}
        </p>
      </section>

      {!isAdminEntry ? (
        <section className="v3-box v3-stack">
          <h2 className="v3-h2">증빙 이미지</h2>
          {entry.proofImage640Url ? (
            <img
              src={entry.proofImage640Url}
              alt="증빙 이미지"
              style={{ width: "100%", maxHeight: "22rem", objectFit: "cover", borderRadius: "0.55rem" }}
            />
          ) : (
            <p className="v3-muted">저장된 증빙 이미지가 없습니다.</p>
          )}
          {entry.proofOriginalUrl ? (
            <a className="v3-btn" href={entry.proofOriginalUrl} target="_blank" rel="noreferrer">
              원본 이미지 보기
            </a>
          ) : null}
        </section>
      ) : (
        <section className="v3-box v3-stack">
          <p className="v3-muted" style={{ margin: 0 }}>
            관리자 등록 건은 증빙·OCR 절차가 없습니다.
          </p>
        </section>
      )}

      {!isAdminEntry ? (
      <section className="v3-box v3-stack">
        <h2 className="v3-h2">OCR 결과 (참고용)</h2>
        <p>
          <strong>OCR 상태:</strong> {entry.ocrStatus}
        </p>
        <p>
          <strong>OCR 요청 시각:</strong>{" "}
          {entry.ocrRequestedAt ? new Date(entry.ocrRequestedAt).toLocaleString("ko-KR") : "-"}
        </p>
        <p>
          <strong>OCR 완료 시각:</strong>{" "}
          {entry.ocrCompletedAt ? new Date(entry.ocrCompletedAt).toLocaleString("ko-KR") : "-"}
        </p>
        <p>
          <strong>OCR 텍스트:</strong>
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: "0.45rem",
            padding: "0.65rem",
          }}
        >
          {entry.ocrText || "(아직 결과 없음)"}
        </pre>

        <div
          className="v3-stack"
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: "0.45rem",
            border: "1px solid #dbeafe",
            background: "#f8fbff",
          }}
        >
          <p className="v3-h2" style={{ margin: 0, fontSize: "1.05rem" }}>
            OCR 판정 참고
          </p>
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            자동 승인·거절 근거가 아닙니다. 운영 참고용으로만 확인하세요.
          </p>
          {ocrAugment.parsed || ocrAugment.eligibilityCheck ? (
            <>
              <p style={{ margin: 0 }}>
                <strong>이름(OCR):</strong> {formatOcrAugmentField(ocrAugment.parsed?.name)}
              </p>
              <p style={{ margin: 0 }}>
                <strong>전화번호(OCR):</strong> {formatOcrAugmentField(ocrAugment.parsed?.phone)}
              </p>
              <p style={{ margin: 0 }}>
                <strong>핸디(OCR):</strong>{" "}
                {ocrAugment.parsed?.score != null && Number.isFinite(ocrAugment.parsed.score)
                  ? `${ocrAugment.parsed.score}점`
                  : "—"}
              </p>
              <p style={{ margin: 0 }}>
                <strong>AVG(OCR):</strong>{" "}
                {ocrAugment.parsed?.average != null && Number.isFinite(ocrAugment.parsed.average)
                  ? String(ocrAugment.parsed.average)
                  : "—"}
              </p>
              {ocrAugment.eligibilityCheck ? (
                <>
                  <p style={{ margin: 0 }}>
                    <strong>판정:</strong> {eligibilityPassedLabel(ocrAugment.eligibilityCheck.passed)}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>판정 메시지:</strong>{" "}
                    {typeof ocrAugment.eligibilityCheck.message === "string" &&
                    ocrAugment.eligibilityCheck.message.trim()
                      ? ocrAugment.eligibilityCheck.message.trim()
                      : "—"}
                  </p>
                </>
              ) : (
                <p className="v3-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                  대회 규칙과의 비교 결과가 아직 없습니다(OCR만 저장된 경우 등).
                </p>
              )}
            </>
          ) : (
            <p className="v3-muted" style={{ margin: 0 }}>
              저장된 OCR 판정 참고 정보가 없습니다.
            </p>
          )}
        </div>

        {entry.ocrRawResult ? (
          <details>
            <summary>OCR 원시 결과 보기</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#fafafa",
                border: "1px solid #e5e5e5",
                borderRadius: "0.45rem",
                padding: "0.65rem",
                marginTop: "0.5rem",
              }}
            >
              {entry.ocrRawResult}
            </pre>
          </details>
        ) : null}
      </section>
      ) : null}

      <StatusTransitionControls tournamentId={id} entryId={entryId} initialStatus={entry.status} />
    </main>
  );
}
