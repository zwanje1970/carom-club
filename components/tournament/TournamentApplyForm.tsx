"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_ADMIN_COPY, getCopyValue } from "@/lib/admin-copy";
import { requiresVerificationImage, type VerificationMode } from "@/lib/tournament-certification";
import { PushSubscribeButton } from "@/components/push/PushSubscribeButton";

export function TournamentApplyForm({
  tournamentId,
  entryFee,
  accountNumber,
  entryConditionsHtml,
  entryQualificationLabels,
  additionalSlot = false,
  isScotch = false,
  currentUserName = null,
  currentUserPhone = null,
  teamScoreLimit = null,
  teamScoreRule = null,
  verificationMode,
  verificationGuideText,
  divisionEnabled,
  eligibilityLine,
  userMemberAvg,
}: {
  tournamentId: string;
  entryFee: number | null;
  /** 계좌번호(은행명, 예금주) — 참가신청 시 입금용으로 복사 버튼과 함께 표시 */
  accountNumber: string | null;
  entryConditionsHtml: string | null;
  entryQualificationLabels: string[];
  additionalSlot?: boolean;
  isScotch?: boolean;
  currentUserName?: string | null;
  currentUserPhone?: string | null;
  teamScoreLimit?: number | null;
  teamScoreRule?: "LTE" | "LT" | null;
  verificationMode: VerificationMode;
  verificationGuideText: string | null;
  divisionEnabled: boolean;
  eligibilityLine: string | null;
  userMemberAvg: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [clubOrAffiliation, setClubOrAffiliation] = useState("");
  const [handicap, setHandicap] = useState("");
  const [avg, setAvg] = useState("");
  const [avgProofUrl, setAvgProofUrl] = useState("");
  const [avgProofUploading, setAvgProofUploading] = useState(false);
  const [certificationImageUrl, setCertificationImageUrl] = useState("");
  const [certUploading, setCertUploading] = useState(false);
  const [certPreviewUrl, setCertPreviewUrl] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [playerAName, setPlayerAName] = useState(currentUserName ?? "");
  const [playerAScore, setPlayerAScore] = useState("");
  const [playerBName, setPlayerBName] = useState("");
  const [playerBScore, setPlayerBScore] = useState("");
  const [playerBProofUrl, setPlayerBProofUrl] = useState("");
  const [playerBUploading, setPlayerBUploading] = useState(false);
  const [applicantName, setApplicantName] = useState(currentUserName ?? "");
  const [applicantPhone, setApplicantPhone] = useState(currentUserPhone ?? "");
  const [proxyParticipants, setProxyParticipants] = useState<Array<{ name: string; phone: string }>>([]);
  const [participantResults, setParticipantResults] = useState<
    Array<{ name: string; phone: string; result: "APPLIED" | "ALREADY_APPLIED" }>
  >([]);

  const needCert = requiresVerificationImage(verificationMode);
  const showVerificationNotice = verificationMode !== "NONE";

  useEffect(() => {
    return () => {
      if (certPreviewUrl) URL.revokeObjectURL(certPreviewUrl);
    };
  }, [certPreviewUrl]);

  useEffect(() => {
    if (currentUserName) {
      setPlayerAName(currentUserName);
      setApplicantName(currentUserName);
    }
  }, [currentUserName]);

  useEffect(() => {
    if (currentUserPhone) {
      setApplicantPhone(currentUserPhone);
    }
  }, [currentUserPhone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setParticipantResults([]);
    if (!depositorName.trim()) {
      setError("입금자명을 입력해주세요.");
      return;
    }
    if (!applicantName.trim()) {
      setError("참가자 본인 이름을 입력해주세요.");
      return;
    }
    if (!applicantPhone.trim()) {
      setError("참가자 본인 전화번호를 입력해주세요.");
      return;
    }
    const invalidProxy = proxyParticipants.find((p) => !p.name.trim() || !p.phone.trim());
    if (invalidProxy) {
      setError("추가 참가자의 이름과 전화번호를 모두 입력해주세요.");
      return;
    }
    if (!agreed) {
      setError("참가요건에 동의해주세요.");
      return;
    }
    if (needCert && !certificationImageUrl.trim()) {
      setError(getCopyValue(DEFAULT_ADMIN_COPY, "site.tournament.apply.certRequired"));
      return;
    }
    if (isScotch) {
      const aName = playerAName.trim();
      const bName = playerBName.trim();
      const aScore = Number(playerAScore);
      const bScore = Number(playerBScore);
      if (!aName || !bName) {
        setError("스카치 대회는 두 명의 이름을 모두 입력해야 합니다.");
        return;
      }
      if (!Number.isFinite(aScore) || !Number.isFinite(bScore)) {
        setError("스카치 대회는 두 명의 점수를 모두 숫자로 입력해야 합니다.");
        return;
      }
      if (!certificationImageUrl.trim() || !playerBProofUrl.trim()) {
        setError("스카치 대회는 두 명 모두 증빙을 첨부해야 합니다.");
        return;
      }
      const teamTotalScore = aScore + bScore;
      const limit = teamScoreLimit != null && Number.isFinite(Number(teamScoreLimit)) ? Number(teamScoreLimit) : null;
      if (limit != null && teamScoreRule) {
        const valid = teamScoreRule === "LT" ? teamTotalScore < limit : teamTotalScore <= limit;
        if (!valid) {
          setError(
            teamScoreRule === "LT"
              ? `팀 합산 점수는 ${limit} 미만이어야 합니다.`
              : `팀 합산 점수는 ${limit} 이하이어야 합니다.`
          );
          return;
        }
      }
    }
    setLoading(true);
    try {
      const teamTotalScore =
        isScotch && Number.isFinite(Number(playerAScore)) && Number.isFinite(Number(playerBScore))
          ? Number(playerAScore) + Number(playerBScore)
          : null;
      const res = await fetch("/api/tournaments/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          applicantName: applicantName.trim(),
          applicantPhone: applicantPhone.trim(),
          depositorName: depositorName.trim(),
          clubOrAffiliation: clubOrAffiliation.trim() || undefined,
          handicap: handicap.trim() || undefined,
          avg: avg.trim() || undefined,
          avgProofUrl: avgProofUrl.trim() || undefined,
          ...(needCert && {
            verificationImageUrl: certificationImageUrl.trim(),
          }),
          ...(isScotch && {
            playerAName: playerAName.trim() || currentUserName?.trim() || undefined,
            playerAScore: Number(playerAScore),
            playerAProofUrl: certificationImageUrl.trim(),
            playerBName: playerBName.trim(),
            playerBScore: Number(playerBScore),
            playerBProofUrl: playerBProofUrl.trim(),
            teamTotalScore,
          }),
          ...(additionalSlot && { additionalSlot: true }),
          ...(proxyParticipants.length > 0 && {
            proxyParticipants: proxyParticipants.map((p) => ({
              name: p.name.trim(),
              phone: p.phone.trim(),
            })),
          }),
        }),
      });
      let data: {
        error?: string;
        message?: string;
        participantResults?: Array<{ name?: string; phone?: string; result?: "APPLIED" | "ALREADY_APPLIED" }>;
      } = {};
      try {
        const text = await res.text();
        if (text) data = JSON.parse(text);
      } catch {
        // 응답이 비어 있거나 JSON이 아니면 빈 객체 사용
      }
      if (!res.ok) {
        setError(data.error || "신청에 실패했습니다.");
        const resultRows: Array<{ name: string; phone: string; result: "APPLIED" | "ALREADY_APPLIED" }> = Array.isArray(
          data.participantResults
        )
          ? data.participantResults
              .filter((r) => typeof r?.name === "string")
              .map((r) => ({
                name: String(r.name ?? "").trim(),
                phone: String(r.phone ?? "").trim(),
                result: r.result === "ALREADY_APPLIED" ? "ALREADY_APPLIED" : "APPLIED",
              }))
          : [];
        if (resultRows.length > 0) setParticipantResults(resultRows);
        return;
      }
      setSuccessMessage(data.message || "참가 신청이 접수되었습니다. 운영자 승인 후 참가가 확정됩니다.");
      const resultRows: Array<{ name: string; phone: string; result: "APPLIED" | "ALREADY_APPLIED" }> = Array.isArray(
        data.participantResults
      )
        ? data.participantResults
            .filter((r) => typeof r?.name === "string")
            .map((r) => ({
              name: String(r.name ?? "").trim(),
              phone: String(r.phone ?? "").trim(),
              result: r.result === "ALREADY_APPLIED" ? "ALREADY_APPLIED" : "APPLIED",
            }))
        : [];
      setParticipantResults(resultRows);
      setDepositorName("");
      setClubOrAffiliation("");
      setHandicap("");
      setAvg("");
      setAvgProofUrl("");
      setCertificationImageUrl("");
      setPlayerAName(currentUserName ?? "");
      setPlayerAScore("");
      setPlayerBName("");
      setPlayerBScore("");
      setPlayerBProofUrl("");
      setProxyParticipants([]);
      if (certPreviewUrl) URL.revokeObjectURL(certPreviewUrl);
      setCertPreviewUrl(null);
      setAgreed(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {successMessage && (
        <div className="space-y-2">
          <p className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-300 p-3 rounded border border-green-200 dark:border-green-800">
            {successMessage}
          </p>
          <PushSubscribeButton
            className="inline-flex items-center rounded-lg border border-site-border bg-site-card px-4 py-2 text-sm font-medium text-site-text hover:bg-site-bg"
            label="대진표 알림 받기"
          />
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300 p-2 rounded">{error}</p>
      )}
      {participantResults.length > 0 && (
        <div className="rounded-lg border border-site-border bg-site-bg/40 p-3">
          <p className="text-sm font-semibold text-site-text">신청 결과</p>
          <ul className="mt-2 space-y-1 text-sm">
            {participantResults.map((r, idx) => (
              <li key={`result-${idx}`} className="flex items-center justify-between gap-2">
                <span>
                  {r.name}
                  {r.phone ? ` (${r.phone})` : ""}
                </span>
                <span
                  className={
                    r.result === "ALREADY_APPLIED"
                      ? "rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800"
                      : "rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                  }
                >
                  {r.result === "ALREADY_APPLIED" ? "신청완료" : "신청접수"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showVerificationNotice && eligibilityLine && (
        <p className="text-sm text-site-text border border-site-border rounded-lg px-3 py-2 bg-site-bg/50">
          {eligibilityLine}
        </p>
      )}
      {showVerificationNotice && verificationGuideText && (
        <p className="text-sm text-site-text border border-site-border rounded-lg px-3 py-2 bg-site-bg/50">
          {verificationGuideText}
        </p>
      )}
      {showVerificationNotice && divisionEnabled && (
        <p className="text-sm text-site-text-muted">
          {getCopyValue(DEFAULT_ADMIN_COPY, "site.tournament.apply.divisionAutoNotice")}
        </p>
      )}
      {entryQualificationLabels.length > 0 && (
        <div className="rounded-lg border border-site-border bg-site-bg/50 px-3 py-2 text-sm text-site-text">
          <p className="font-medium">참가 조건 기준</p>
          <p>{entryQualificationLabels.join(" · ")}</p>
        </div>
      )}
      {userMemberAvg && (
        <p className="text-sm text-site-text-muted">
          내 프로필 에버(avg): <strong className="text-site-text">{userMemberAvg}</strong>
        </p>
      )}
      <p className="text-sm text-gray-600">
        {additionalSlot ? "추가 슬롯 참가비 (2배): " : "참가비: "}
        {entryFee != null ? `${Number(entryFee).toLocaleString()}원` : "문의"}
      </p>
      {accountNumber && accountNumber.trim() && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">계좌번호(은행명, 예금주)</label>
          <div className="flex gap-2">
            <span className="flex-1 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm break-all">
              {accountNumber.trim()}
            </span>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) navigator.clipboard.writeText(accountNumber.trim());
              }}
              className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              복사
            </button>
          </div>
        </div>
      )}
      {entryConditionsHtml && (
        <div className="border rounded p-3 bg-gray-50 max-h-40 overflow-auto">
          <div
            className="prose prose-sm max-w-none text-sm break-words overflow-hidden"
            dangerouslySetInnerHTML={{ __html: entryConditionsHtml }}
          />
        </div>
      )}
      <div className="rounded-lg border border-site-border bg-site-bg/40 p-3">
        <p className="text-sm font-semibold text-site-text">참가자 정보</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              참가자 본인 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="신청자 이름"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              참가자 본인 전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={applicantPhone}
              onChange={(e) => setApplicantPhone(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="010-0000-0000"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-site-border bg-site-bg/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-site-text">참가자 추가 (대리신청)</p>
          <button
            type="button"
            onClick={() => setProxyParticipants((prev) => [...prev, { name: "", phone: "" }])}
            className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            참가자 추가
          </button>
        </div>
        {proxyParticipants.length > 0 ? (
          <div className="mt-2 space-y-2">
            {proxyParticipants.map((p, idx) => (
              <div key={`proxy-${idx}`} className="grid grid-cols-1 gap-2 rounded border border-zinc-200 p-2 sm:grid-cols-[1fr_1fr_auto] dark:border-zinc-700">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) =>
                    setProxyParticipants((prev) => {
                      const next = [...prev];
                      if (!next[idx]) return prev;
                      next[idx] = { ...next[idx], name: e.target.value };
                      return next;
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="참가자 이름"
                />
                <input
                  type="text"
                  value={p.phone}
                  onChange={(e) =>
                    setProxyParticipants((prev) => {
                      const next = [...prev];
                      if (!next[idx]) return prev;
                      next[idx] = { ...next[idx], phone: e.target.value };
                      return next;
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="전화번호"
                />
                <button
                  type="button"
                  onClick={() => setProxyParticipants((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-500">추가 참가자가 없으면 본인 신청만 진행됩니다.</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            입금자명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="입금 시 사용할 이름"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">소속/클럽 (선택)</label>
          <input
            type="text"
            value={clubOrAffiliation}
            onChange={(e) => setClubOrAffiliation(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="소속 동호회·클럽명"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">핸디 (선택)</label>
          <input
            type="text"
            value={handicap}
            onChange={(e) => setHandicap(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="예: 10"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">AVG (선택)</label>
          <input
            type="text"
            value={avg}
            onChange={(e) => setAvg(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="예: 0.523"
          />
        </div>
      </div>
      {needCert && !isScotch && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            인증 이미지 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-site-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:opacity-90"
              disabled={certUploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (certPreviewUrl) URL.revokeObjectURL(certPreviewUrl);
                setCertPreviewUrl(URL.createObjectURL(file));
                setCertUploading(true);
                setError("");
                try {
                  const formData = new FormData();
                  formData.set("file", file);
                  const res = await fetch("/api/tournaments/apply/upload-certification", {
                    method: "POST",
                    credentials: "include",
                    body: formData,
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError((data as { error?: string }).error ?? "인증 이미지 업로드에 실패했습니다.");
                    setCertificationImageUrl("");
                    return;
                  }
                  setCertificationImageUrl((data as { url?: string }).url ?? "");
                } catch {
                  setError("인증 이미지 업로드에 실패했습니다.");
                  setCertificationImageUrl("");
                } finally {
                  setCertUploading(false);
                  e.target.value = "";
                }
              }}
            />
            {certUploading && <span className="text-sm text-gray-500">업로드 중…</span>}
            {certificationImageUrl && (
              <span className="text-sm text-green-600 dark:text-green-400">
                첨부됨
                <button
                  type="button"
                  onClick={() => {
                    setCertificationImageUrl("");
                    if (certPreviewUrl) URL.revokeObjectURL(certPreviewUrl);
                    setCertPreviewUrl(null);
                  }}
                  className="ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  제거
                </button>
              </span>
            )}
          </div>
          {certPreviewUrl && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={certPreviewUrl} alt="인증 미리보기" className="max-h-48 rounded border border-gray-200 dark:border-slate-600" />
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP (최대 8MB)</p>
        </div>
      )}
      {isScotch && (
        <div className="space-y-4 rounded-lg border border-site-border bg-site-bg/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-site-text">스카치 팀 정보</h3>
            {teamScoreLimit != null && (
              <span className="text-xs text-site-text-muted">
                합산 {teamScoreRule === "LT" ? "미만" : "이하"} {teamScoreLimit}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                본인 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={playerAName}
                onChange={(e) => setPlayerAName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="본인 이름"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                본인 점수 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="1"
                value={playerAScore}
                onChange={(e) => setPlayerAScore(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="예: 25"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                본인 증빙 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-site-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:opacity-90"
                  disabled={certUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (certPreviewUrl) URL.revokeObjectURL(certPreviewUrl);
                    setCertPreviewUrl(URL.createObjectURL(file));
                    setCertUploading(true);
                    setError("");
                    try {
                      const formData = new FormData();
                      formData.set("file", file);
                      const res = await fetch("/api/tournaments/apply/upload-certification", {
                        method: "POST",
                        credentials: "include",
                        body: formData,
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setError((data as { error?: string }).error ?? "인증 이미지 업로드에 실패했습니다.");
                        setCertificationImageUrl("");
                        return;
                      }
                      setCertificationImageUrl((data as { url?: string }).url ?? "");
                    } catch {
                      setError("인증 이미지 업로드에 실패했습니다.");
                      setCertificationImageUrl("");
                    } finally {
                      setCertUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
                {certUploading && <span className="text-sm text-gray-500">업로드 중…</span>}
                {certificationImageUrl && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    첨부됨
                    <button
                      type="button"
                      onClick={() => {
                        setCertificationImageUrl("");
                        if (certPreviewUrl) URL.revokeObjectURL(certPreviewUrl);
                        setCertPreviewUrl(null);
                      }}
                      className="ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      제거
                    </button>
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                동행자 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={playerBName}
                onChange={(e) => setPlayerBName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="동행자 이름"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                동행자 점수 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="1"
                value={playerBScore}
                onChange={(e) => setPlayerBScore(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="예: 25"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                동행자 증빙 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-site-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:opacity-90"
                  disabled={playerBUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPlayerBUploading(true);
                    setError("");
                    try {
                      const formData = new FormData();
                      formData.set("file", file);
                      const res = await fetch("/api/tournaments/apply/upload-certification", {
                        method: "POST",
                        credentials: "include",
                        body: formData,
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setError((data as { error?: string }).error ?? "인증 이미지 업로드에 실패했습니다.");
                        setPlayerBProofUrl("");
                        return;
                      }
                      setPlayerBProofUrl((data as { url?: string }).url ?? "");
                    } catch {
                      setError("인증 이미지 업로드에 실패했습니다.");
                      setPlayerBProofUrl("");
                    } finally {
                      setPlayerBUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
                {playerBUploading && <span className="text-sm text-gray-500">업로드 중…</span>}
                {playerBProofUrl && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    첨부됨
                    <button
                      type="button"
                      onClick={() => setPlayerBProofUrl("")}
                      className="ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      제거
                    </button>
                  </span>
                )}
              </div>
            </div>
            <div className="sm:col-span-2 rounded-md border border-site-border bg-white/60 p-3 text-sm text-site-text-muted">
              팀 합산 점수는
              {" "}
              <strong className="text-site-text">
                {teamScoreRule === "LT" ? "미만" : "이하"} {teamScoreLimit ?? "제한 없음"}
              </strong>
              {" "}
              기준으로 검증됩니다.
            </div>
          </div>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">AVG 인증서 첨부 (선택)</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-site-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:opacity-90"
            disabled={avgProofUploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setAvgProofUploading(true);
              setError("");
              try {
                const formData = new FormData();
                formData.set("file", file);
                const res = await fetch("/api/tournaments/apply/upload-avg-proof", {
                  method: "POST",
                  credentials: "include",
                  body: formData,
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(data.error ?? "인증서 업로드에 실패했습니다.");
                  return;
                }
                setAvgProofUrl(data.url ?? "");
              } catch {
                setError("인증서 업로드에 실패했습니다.");
              } finally {
                setAvgProofUploading(false);
                e.target.value = "";
              }
            }}
          />
          {avgProofUploading && <span className="text-sm text-gray-500">업로드 중…</span>}
          {avgProofUrl && (
            <span className="text-sm text-green-600 dark:text-green-400">
              첨부됨
              <button
                type="button"
                onClick={() => setAvgProofUrl("")}
                className="ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                제거
              </button>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP (최대 8MB)</p>
      </div>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 rounded border-gray-300"
        />
        <label htmlFor="agree" className="text-sm text-gray-700">
          위 참가요건을 확인하였으며, 동의합니다. <span className="text-red-500">*</span>
        </label>
      </div>
      <p className="text-xs text-gray-500">
        로그인한 회원 정보(이름, 연락처)가 반영됩니다. 핸디·AVG·인증서는 위에서 입력·첨부해 주세요.
      </p>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-site-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "처리 중..." : additionalSlot ? "추가 슬롯 신청" : "참가 신청"}
      </button>
      {!additionalSlot && (
        <p className="text-sm text-gray-500">
          <Link href="/login" className="text-site-primary hover:underline">로그인</Link> 후 신청할 수 있습니다.
        </p>
      )}
    </form>
  );
}
