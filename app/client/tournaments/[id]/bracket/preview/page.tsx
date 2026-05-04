"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type DraftMatch = {
  player1: { userId: string; name: string };
  player2: { userId: string; name: string };
};

type DraftPayload = {
  source: "auto" | "manual";
  snapshotId: string;
  matches: DraftMatch[];
  createdAt: string;
  zoneId?: string;
};

function getDraftStorageKey(tournamentId: string): string {
  return `v3_bracket_draft_${tournamentId}`;
}

export default function BracketPreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!tournamentId) return;
    const raw = window.localStorage.getItem(getDraftStorageKey(tournamentId));
    if (!raw) {
      setDraft(null);
      setMessage("미리보기할 임시 배정 결과가 없습니다. 자동배정 또는 수동배정에서 먼저 생성해 주세요.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as DraftPayload;
      const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
      if (!parsed.snapshotId || matches.length === 0) {
        setDraft(null);
        setMessage("임시 배정 데이터가 올바르지 않습니다.");
        return;
      }
      const zoneId = typeof parsed.zoneId === "string" && parsed.zoneId.trim() !== "" ? parsed.zoneId.trim() : undefined;
      setDraft({
        source: parsed.source === "manual" ? "manual" : "auto",
        snapshotId: parsed.snapshotId,
        matches,
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        ...(zoneId ? { zoneId } : {}),
      });
      setMessage("");
    } catch {
      setDraft(null);
      setMessage("임시 배정 데이터를 읽는 중 오류가 발생했습니다.");
    }
  }, [tournamentId]);

  async function handleConfirmSave() {
    if (!tournamentId || !draft || saving) return;
    setSaving(true);
    setSaveState("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: draft.snapshotId,
          matches: draft.matches,
          ...(draft.zoneId ? { zoneId: draft.zoneId } : {}),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? "확정 저장에 실패했습니다.");
        setSaveState("error");
        return;
      }
      setSaveState("success");
      window.localStorage.removeItem(getDraftStorageKey(tournamentId));
      const zq = draft.zoneId ? `?zoneId=${encodeURIComponent(draft.zoneId)}` : "";
      router.push(`/client/tournaments/${tournamentId}/bracket${zq}`);
    } catch {
      setMessage("확정 저장 중 오류가 발생했습니다.");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">이 화면은 임시 배정 결과 확인 단계입니다. 확정 저장 전에는 실제 대진표가 바뀌지 않습니다.</p>
      {message ? <p className="v3-muted">{message}</p> : null}

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">임시 배정 결과</h2>
        {!draft ? (
          <p className="v3-muted">표시할 임시 배정 결과가 없습니다.</p>
        ) : (
          <>
            <p>
              <strong>배정 방식:</strong> {draft.source === "manual" ? "수동배정" : "자동배정"}
            </p>
            <p>
              <strong>입력 스냅샷:</strong> {draft.snapshotId}
            </p>
            <p>
              <strong>임시 매치 수:</strong> {draft.matches.length}경기
            </p>
            <div className="v3-box v3-stack" style={{ background: "#fafafa" }}>
              <p style={{ fontWeight: 700 }}>Round 1</p>
              <ul className="v3-list">
                {draft.matches.map((match, index) => (
                  <li key={`${match.player1.userId}-${match.player2.userId}-${index}`}>
                    {match.player1.name} vs {match.player2.name}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <div className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
        <button type="button" className="v3-btn" onClick={handleConfirmSave} disabled={!draft || saving}>
          확정 저장
        </button>
        {saveState !== "idle" ? (
          <span
            className="v3-muted"
            style={{ color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280" }}
          >
            {saveState === "success" ? "저장성공" : saveState === "error" ? "저장실패" : "저장중"}
          </span>
        ) : null}
      </div>
    </main>
  );
}
