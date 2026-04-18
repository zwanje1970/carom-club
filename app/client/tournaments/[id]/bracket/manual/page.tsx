"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

export default function BracketManualAssignPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const [snapshot, setSnapshot] = useState<BracketParticipantSnapshot | null>(null);
  const [selectedPlayer1, setSelectedPlayer1] = useState("");
  const [selectedPlayer2, setSelectedPlayer2] = useState("");
  const [matches, setMatches] = useState<DraftMatch[]>([]);
  const [message, setMessage] = useState("");

  const assignedUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const match of matches) {
      ids.add(match.player1.userId);
      ids.add(match.player2.userId);
    }
    return ids;
  }, [matches]);

  const availableParticipants = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.participants.filter((participant) => !assignedUserIds.has(participant.userId));
  }, [snapshot, assignedUserIds]);

  useEffect(() => {
    async function loadSnapshot() {
      if (!tournamentId) return;
      setMessage("");
      try {
        const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/participants-snapshot`);
        const result = (await response.json()) as {
          snapshot?: BracketParticipantSnapshot | null;
          error?: string;
        };
        if (!response.ok) {
          setMessage(result.error ?? "최신 스냅샷 조회에 실패했습니다.");
          return;
        }
        const latestSnapshot = result.snapshot ?? null;
        setSnapshot(latestSnapshot);
        if (!latestSnapshot) {
          setMessage("최신 스냅샷이 없습니다. 허브에서 먼저 대상자 스냅샷을 생성해 주세요.");
        }
      } catch {
        setMessage("최신 스냅샷 조회 중 오류가 발생했습니다.");
      }
    }
    void loadSnapshot();
  }, [tournamentId]);

  function handleAddMatch() {
    if (!snapshot) return;
    const p1 = availableParticipants.find((participant) => participant.userId === selectedPlayer1);
    const p2 = availableParticipants.find((participant) => participant.userId === selectedPlayer2);
    if (!p1 || !p2) {
      setMessage("매치에 넣을 두 명을 선택해 주세요.");
      return;
    }
    if (p1.userId === p2.userId) {
      setMessage("같은 참가자를 양쪽에 배정할 수 없습니다.");
      return;
    }

    setMatches((prev) => [
      ...prev,
      {
        player1: { userId: p1.userId, name: p1.applicantName },
        player2: { userId: p2.userId, name: p2.applicantName },
      },
    ]);
    setSelectedPlayer1("");
    setSelectedPlayer2("");
    setMessage("");
  }

  function handleRemoveMatch(indexToRemove: number) {
    setMatches((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  function handleGoPreview() {
    if (!tournamentId || !snapshot) return;
    if (matches.length === 0) {
      setMessage("최소 1개 이상의 매치를 만들어 주세요.");
      return;
    }
    const draft = {
      source: "manual",
      snapshotId: snapshot.id,
      matches,
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(getDraftStorageKey(tournamentId), JSON.stringify(draft));
    router.push(`/client/tournaments/${tournamentId}/bracket/preview`);
  }

  return (
    <main className="v3-page v3-stack">
      <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem" }}>
        <Link className="v3-btn" href={`/client/tournaments/${tournamentId}/bracket`} style={{ padding: "0.5rem 0.9rem" }}>
          ← 브래킷 허브
        </Link>
        <h1 className="v3-h1" style={{ marginBottom: 0 }}>
          수동배정
        </h1>
      </div>

      <p className="v3-muted">최신 스냅샷 참가자를 운영자가 2명씩 직접 묶습니다. 이 단계에서는 저장하지 않습니다.</p>
      {message ? <p className="v3-muted">{message}</p> : null}

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">참가자 선택</h2>
        {!snapshot ? (
          <p className="v3-muted">스냅샷이 없습니다.</p>
        ) : (
          <>
            <p>
              <strong>스냅샷 ID:</strong> {snapshot.id}
            </p>
            <p>
              <strong>남은 참가자:</strong> {availableParticipants.length}명
            </p>
            <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
              <select value={selectedPlayer1} onChange={(event) => setSelectedPlayer1(event.target.value)}>
                <option value="">player1 선택</option>
                {availableParticipants.map((participant) => (
                  <option key={`p1-${participant.userId}`} value={participant.userId}>
                    {participant.applicantName} ({participant.phone})
                  </option>
                ))}
              </select>
              <select value={selectedPlayer2} onChange={(event) => setSelectedPlayer2(event.target.value)}>
                <option value="">player2 선택</option>
                {availableParticipants.map((participant) => (
                  <option key={`p2-${participant.userId}`} value={participant.userId}>
                    {participant.applicantName} ({participant.phone})
                  </option>
                ))}
              </select>
              <button type="button" className="v3-btn" onClick={handleAddMatch}>
                매치 추가
              </button>
            </div>
          </>
        )}
      </section>

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">임시 매치 목록</h2>
        {matches.length === 0 ? (
          <p className="v3-muted">아직 추가된 매치가 없습니다.</p>
        ) : (
          <ul className="v3-list">
            {matches.map((match, index) => (
              <li key={`${match.player1.userId}-${match.player2.userId}-${index}`}>
                {match.player1.name} vs {match.player2.name}
                <button
                  type="button"
                  className="v3-btn"
                  style={{ marginLeft: "0.75rem", padding: "0.2rem 0.5rem" }}
                  onClick={() => handleRemoveMatch(index)}
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="v3-row">
        <button type="button" className="v3-btn" onClick={handleGoPreview} disabled={!snapshot || matches.length === 0}>
          미리보기로 이동
        </button>
      </div>
    </main>
  );
}
