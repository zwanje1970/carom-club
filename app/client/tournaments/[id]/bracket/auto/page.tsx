"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type BracketParticipant = {
  userId: string;
  applicantName: string;
  phone: string;
};

type BracketParticipantSnapshot = {
  id: string;
  tournamentId: string;
  participants: BracketParticipant[];
  createdAt: string;
};

type DraftMatch = {
  player1: { userId: string; name: string };
  player2: { userId: string; name: string };
};

function getDraftStorageKey(tournamentId: string): string {
  return `v3_bracket_draft_${tournamentId}`;
}

function buildMatchesFromSnapshot(latestSnapshot: BracketParticipantSnapshot): DraftMatch[] {
  const pairCount = Math.floor(latestSnapshot.participants.length / 2);
  const matches: DraftMatch[] = [];
  for (let i = 0; i < pairCount * 2; i += 2) {
    const p1 = latestSnapshot.participants[i];
    const p2 = latestSnapshot.participants[i + 1];
    matches.push({
      player1: { userId: p1.userId, name: p1.applicantName },
      player2: { userId: p2.userId, name: p2.applicantName },
    });
  }
  return matches;
}

export default function BracketAutoAssignPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const [snapshot, setSnapshot] = useState<BracketParticipantSnapshot | null>(null);
  const [proposedMatches, setProposedMatches] = useState<DraftMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [noApprovedParticipants, setNoApprovedParticipants] = useState(false);

  const loadSnapshot = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setMessage("");
    setNoApprovedParticipants(false);
    try {
      const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/participants-snapshot`);
      const result = (await response.json()) as {
        snapshot?: BracketParticipantSnapshot | null;
        error?: string;
      };
      if (!response.ok) {
        setMessage(result.error ?? "대상자 정보를 불러오지 못했습니다.");
        return;
      }
      const latestSnapshot = result.snapshot ?? null;
      setSnapshot(latestSnapshot);
      if (!latestSnapshot) {
        setProposedMatches([]);
        return;
      }
      setProposedMatches(buildMatchesFromSnapshot(latestSnapshot));
    } catch {
      setMessage("대상자 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  function goPreviewWithDraft(matches: DraftMatch[], snap: BracketParticipantSnapshot) {
    if (!tournamentId || matches.length === 0) return;
    const draft = {
      source: "auto" as const,
      snapshotId: snap.id,
      matches,
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(getDraftStorageKey(tournamentId), JSON.stringify(draft));
    router.push(`/client/tournaments/${tournamentId}/bracket/preview`);
  }

  async function handleCreateSnapshot() {
    if (!tournamentId || loading) return;
    setLoading(true);
    setMessage("");
    setNoApprovedParticipants(false);
    try {
      const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/participants-snapshot`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        snapshot?: BracketParticipantSnapshot;
        error?: string;
      };
      if (!response.ok || !result.snapshot) {
        const err = result.error ?? "";
        if (err.includes("APPROVED") || err.includes("없어")) {
          setMessage("승인된 참가자가 없습니다.");
          setNoApprovedParticipants(true);
        } else {
          setMessage(err || "생성에 실패했습니다.");
        }
        return;
      }
      const snap = result.snapshot;
      setSnapshot(snap);
      const matches = buildMatchesFromSnapshot(snap);
      setProposedMatches(matches);
      if (matches.length === 0) {
        setMessage("참가자 인원으로는 매치를 만들 수 없습니다.");
        return;
      }
      goPreviewWithDraft(matches, snap);
    } catch {
      setMessage("생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoPreview() {
    if (!tournamentId || !snapshot) return;
    if (proposedMatches.length === 0) {
      setMessage("매치가 없어 미리보기로 이동할 수 없습니다.");
      return;
    }
    goPreviewWithDraft(proposedMatches, snapshot);
  }

  const participantsPath = `/client/tournaments/${tournamentId}/participants`;

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p style={{ margin: 0, fontSize: "0.98rem", lineHeight: 1.55 }}>
        승인된 참가자를 기준으로 대진표를 자동 생성합니다.
      </p>

      {message ? (
        <p className="v3-muted" style={{ color: noApprovedParticipants ? "#b45309" : undefined }}>
          {message}
        </p>
      ) : null}
      {noApprovedParticipants ? (
        <Link className="v3-btn" href={participantsPath} style={{ padding: "0.55rem 0.9rem", alignSelf: "flex-start" }}>
          참가자 관리로 이동
        </Link>
      ) : null}

      {loading ? <p className="v3-muted">불러오는 중…</p> : null}

      {!loading && !snapshot ? (
        <section className="v3-box v3-stack" style={{ gap: "0.75rem" }}>
          <p className="v3-muted" style={{ margin: 0 }}>
            아직 대진표 대상 스냅샷이 없습니다. 아래에서 생성을 시작하세요.
          </p>
          <button
            type="button"
            className="ui-btn-primary-solid"
            disabled={loading}
            onClick={() => void handleCreateSnapshot()}
            style={{ padding: "0.65rem 1.2rem", fontWeight: 700, alignSelf: "flex-start" }}
          >
            생성하기
          </button>
        </section>
      ) : null}

      {!loading && snapshot ? (
        <section className="v3-box v3-stack" style={{ gap: "0.65rem" }}>
          <p style={{ margin: 0 }}>
            <strong>참가자</strong> {snapshot.participants.length}명 · <strong>임시 매치</strong> {proposedMatches.length}경기
          </p>
          {snapshot.participants.length % 2 === 1 ? (
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              홀수 인원인 경우 마지막 1명은 이번 자동 배정에서 제외됩니다.
            </p>
          ) : null}
          {proposedMatches.length > 0 ? (
            <ul className="v3-list" style={{ margin: 0, fontSize: "0.92rem" }}>
              {proposedMatches.map((match, index) => (
                <li key={`${match.player1.userId}-${match.player2.userId}-${index}`}>
                  {match.player1.name} vs {match.player2.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="v3-muted">생성된 임시 매치가 없습니다.</p>
          )}
          <button
            type="button"
            className="ui-btn-primary-solid"
            disabled={proposedMatches.length === 0}
            onClick={handleGoPreview}
            style={{ padding: "0.65rem 1.2rem", fontWeight: 700, alignSelf: "flex-start" }}
          >
            미리보기로 이동
          </button>
        </section>
      ) : null}

      <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        <Link href={`/client/tournaments/${tournamentId}/bracket/manual`} style={{ color: "inherit", textDecoration: "underline" }}>
          수동 배정
        </Link>
        은 여기서만 진입합니다.
      </p>
    </main>
  );
}
