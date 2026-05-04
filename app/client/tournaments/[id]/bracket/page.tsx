"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const TournamentGroupRound1PrintClient = dynamic(
  () => import("./TournamentGroupRound1PrintClient"),
  { ssr: false, loading: () => <p className="v3-muted">조별 1차 대진표 인쇄 도구를 불러오는 중…</p> },
);

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
  zoneId?: string | null;
};

type Bracket = {
  id: string;
  tournamentId: string;
  snapshotId: string;
  zoneId?: string | null;
  rounds: Array<{
    roundNumber: number;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    matches: Array<{
      id: string;
      player1: { userId: string; name: string };
      player2: { userId: string; name: string };
      winnerUserId: string | null;
      winnerName: string | null;
      status: "PENDING" | "COMPLETED";
    }>;
  }>;
  createdAt: string;
};

function getRoundStatusLabel(status: "PENDING" | "IN_PROGRESS" | "COMPLETED"): string {
  if (status === "IN_PROGRESS") return "진행중";
  if (status === "COMPLETED") return "완료";
  return "대기";
}

export default function TournamentBracketSnapshotPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const urlZoneId = useMemo(() => searchParams.get("zoneId")?.trim() ?? "", [searchParams]);
  const [snapshot, setSnapshot] = useState<BracketParticipantSnapshot | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [replacementSelections, setReplacementSelections] = useState<
    Record<string, { player1: string; player2: string }>
  >({});
  const [message, setMessage] = useState("");
  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [zoneOptions, setZoneOptions] = useState<{ id: string; zoneName: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");

  const bracketZoneQuery = useMemo(() => {
    if (!zonesEnabled || !selectedZoneId) return "";
    return `?zoneId=${encodeURIComponent(selectedZoneId)}`;
  }, [zonesEnabled, selectedZoneId]);

  const bracketPlayers = useMemo(() => {
    if (!bracket) return [];
    const map = new Map<string, { userId: string; name: string }>();
    for (const round of bracket.rounds) {
      for (const match of round.matches) {
        map.set(match.player1.userId, match.player1);
        map.set(match.player2.userId, match.player2);
      }
    }
    return Array.from(map.values());
  }, [bracket]);

  const loadLatestSnapshot = useCallback(async () => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) {
      setSnapshot(null);
      return;
    }
    try {
      const q = zonesEnabled && selectedZoneId ? `?zoneId=${encodeURIComponent(selectedZoneId)}` : "";
      const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/participants-snapshot${q}`, {
        credentials: "same-origin",
      });
      const result = (await response.json()) as {
        snapshot?: BracketParticipantSnapshot | null;
        error?: string;
      };
      if (!response.ok) {
        setMessage(result.error ?? "대진표 대상자 스냅샷 조회에 실패했습니다.");
        return;
      }
      setSnapshot(result.snapshot ?? null);
    } catch {
      setMessage("대진표 대상자 스냅샷 조회 중 오류가 발생했습니다.");
    }
  }, [tournamentId, zonesEnabled, selectedZoneId]);

  const loadLatestBracket = useCallback(async () => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) {
      setBracket(null);
      return;
    }
    try {
      const url = zonesEnabled
        ? `/api/client/tournaments/${tournamentId}/bracket/zones/${encodeURIComponent(selectedZoneId)}`
        : `/api/client/tournaments/${tournamentId}/bracket`;
      const response = await fetch(url, { credentials: "same-origin" });
      const result = (await response.json()) as { bracket?: Bracket | null; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "대진표 조회에 실패했습니다.");
        return;
      }
      setBracket(result.bracket ?? null);
    } catch {
      setMessage("대진표 조회 중 오류가 발생했습니다.");
    }
  }, [tournamentId, zonesEnabled, selectedZoneId]);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}`, { credentials: "same-origin" });
        const json = (await res.json()) as { tournament?: { zonesEnabled?: boolean } };
        if (!res.ok || cancelled || !json.tournament) return;
        setZonesEnabled(json.tournament.zonesEnabled === true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId || !zonesEnabled) {
      setZoneOptions([]);
      if (!zonesEnabled) setSelectedZoneId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}/zones`, { credentials: "same-origin" });
        const json = (await res.json()) as { zones?: Array<{ id?: string; zoneName?: string; status?: string }> };
        if (!res.ok || cancelled || !Array.isArray(json.zones)) return;
        const opts: { id: string; zoneName: string }[] = [];
        for (const z of json.zones) {
          if (!z || z.status !== "ACTIVE") continue;
          const id = typeof z.id === "string" ? z.id.trim() : "";
          const zoneName = typeof z.zoneName === "string" ? z.zoneName.trim() : "";
          if (id && zoneName) opts.push({ id, zoneName });
        }
        setZoneOptions(opts);
        setSelectedZoneId((prev) => {
          if (urlZoneId && opts.some((o) => o.id === urlZoneId)) return urlZoneId;
          if (prev && opts.some((o) => o.id === prev)) return prev;
          return opts[0]?.id ?? "";
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, zonesEnabled, urlZoneId]);

  useEffect(() => {
    void loadLatestSnapshot();
    void loadLatestBracket();
  }, [loadLatestSnapshot, loadLatestBracket]);

  async function handleCreateSnapshot() {
    if (!tournamentId || loadingSnapshot) return;
    if (zonesEnabled && !selectedZoneId) {
      setMessage("권역을 선택해 주세요.");
      return;
    }
    setLoadingSnapshot(true);
    setMessage("");
    try {
      const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/participants-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zonesEnabled && selectedZoneId ? { zoneId: selectedZoneId } : {}),
      });
      const result = (await response.json()) as {
        snapshot?: BracketParticipantSnapshot;
        error?: string;
      };
      if (!response.ok || !result.snapshot) {
        setMessage(result.error ?? "스냅샷 생성에 실패했습니다.");
        return;
      }
      setSnapshot(result.snapshot);
      setMessage("대진표 대상자 스냅샷이 생성되었습니다.");
    } catch {
      setMessage("스냅샷 생성 중 오류가 발생했습니다.");
    } finally {
      setLoadingSnapshot(false);
    }
  }

  async function handleSetWinner(matchId: string, winnerUserId: string) {
    if (!tournamentId || actionLoading) return;
    setActionLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/matches/${matchId}/result${bracketZoneQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerUserId }),
        }
      );
      const result = (await response.json()) as { bracket?: Bracket; error?: string };
      if (!response.ok || !result.bracket) {
        setMessage(result.error ?? "경기 결과 저장에 실패했습니다.");
        return;
      }
      setBracket(result.bracket);
      setMessage("경기 결과가 반영되었습니다.");
    } catch {
      setMessage("경기 결과 저장 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetWinner(matchId: string) {
    if (!tournamentId || actionLoading) return;
    setActionLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/matches/${matchId}/result${bracketZoneQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerUserId: null }),
        }
      );
      const result = (await response.json()) as { bracket?: Bracket; error?: string };
      if (!response.ok || !result.bracket) {
        setMessage(result.error ?? "결과 초기화에 실패했습니다.");
        return;
      }
      setBracket(result.bracket);
      setMessage("경기 결과가 초기화되었습니다.");
    } catch {
      setMessage("결과 초기화 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReplacePlayer(matchId: string, slot: "player1" | "player2") {
    if (!tournamentId || actionLoading) return;
    const replacementUserId = replacementSelections[matchId]?.[slot] ?? "";
    if (!replacementUserId) {
      setMessage("교체할 참가자를 선택해 주세요.");
      return;
    }

    setActionLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/matches/${matchId}/players${bracketZoneQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot, replacementUserId }),
        }
      );
      const result = (await response.json()) as { bracket?: Bracket; error?: string };
      if (!response.ok || !result.bracket) {
        setMessage(result.error ?? "참가자 교체에 실패했습니다.");
        return;
      }
      setBracket(result.bracket);
      setReplacementSelections((prev) => ({
        ...prev,
        [matchId]: { player1: "", player2: "" },
      }));
      setMessage("참가자가 교체되었고 해당 매치는 PENDING으로 초기화되었습니다.");
    } catch {
      setMessage("참가자 교체 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdvanceRound(roundNumber: number) {
    if (!tournamentId || actionLoading) return;
    setActionLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/rounds/${roundNumber}/advance${bracketZoneQuery}`,
        { method: "POST" }
      );
      const result = (await response.json()) as { bracket?: Bracket; error?: string };
      if (!response.ok || !result.bracket) {
        setMessage(result.error ?? "다음 라운드 생성에 실패했습니다.");
        return;
      }
      setBracket(result.bracket);
      setMessage(`Round ${roundNumber + 1}이 생성되었습니다.`);
    } catch {
      setMessage("다음 라운드 생성 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">
        자동배정/수동배정에서 임시 배정 후 미리보기에서 확인하고, 확정 저장 시점에만 실제 대진표가 반영됩니다.
      </p>

      {zonesEnabled ? (
        <section className="v3-box v3-stack" style={{ padding: "0.65rem 0.75rem" }}>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontWeight: 800 }}>권역</span>
            <select
              className="v3-btn"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              disabled={zoneOptions.length === 0}
              style={{ minHeight: 36, fontWeight: 600 }}
            >
              {zoneOptions.length === 0 ? <option value="">권역 없음</option> : null}
              {zoneOptions.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.zoneName}
                </option>
              ))}
            </select>
          </div>
          <p className="v3-muted" style={{ margin: "0.5rem 0 0", fontSize: "0.82rem" }}>
            권역 운영 대회는 아래에서 권역을 선택한 뒤 스냅샷·대진표를 다룹니다. 기존{" "}
            <code>/api/client/tournaments/…/bracket</code> 단일 조회는 이 화면에서 사용하지 않습니다.
          </p>
        </section>
      ) : null}

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">최신 대상자 스냅샷</h2>
        {!snapshot ? (
          <p className="v3-muted">생성된 스냅샷이 없습니다.</p>
        ) : (
          <>
            <p>
              <strong>스냅샷 ID:</strong> {snapshot.id}
            </p>
            <p>
              <strong>참가자 수:</strong> {snapshot.participants.length}명
            </p>
            <p>
              <strong>생성 시각:</strong> {new Date(snapshot.createdAt).toLocaleString("ko-KR")}
            </p>
          </>
        )}
        <div className="v3-row">
          <button
            type="button"
            className="v3-btn"
            onClick={handleCreateSnapshot}
            disabled={loadingSnapshot || (zonesEnabled && (!selectedZoneId || zoneOptions.length === 0))}
          >
            {loadingSnapshot ? "생성 중..." : "대상자 스냅샷 생성"}
          </button>
        </div>
      </section>

      <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link
          prefetch={false}
          className="v3-btn"
          href={`/client/tournaments/${tournamentId}/bracket/auto${bracketZoneQuery}`}
          aria-disabled={zonesEnabled && !selectedZoneId}
          style={zonesEnabled && !selectedZoneId ? { pointerEvents: "none", opacity: 0.45 } : undefined}
        >
          자동배정
        </Link>
        <Link
          prefetch={false}
          className="v3-btn"
          href={`/client/tournaments/${tournamentId}/bracket/manual${bracketZoneQuery}`}
          aria-disabled={zonesEnabled && !selectedZoneId}
          style={zonesEnabled && !selectedZoneId ? { pointerEvents: "none", opacity: 0.45 } : undefined}
        >
          수동배정
        </Link>
        <a className="v3-btn" href="#confirmed-bracket">
          현재 확정 대진표 보기
        </a>
      </div>

      <section className="v3-box v3-stack" aria-label="조별 1차 대진표 인쇄">
        <h2 className="v3-h2">조별 1차 대진표 인쇄</h2>
        <TournamentGroupRound1PrintClient tournamentId={tournamentId} />
      </section>

      {message ? <p className="v3-muted">{message}</p> : null}

      <section id="confirmed-bracket" className="v3-box v3-stack">
        <h2 className="v3-h2">현재 확정 대진표 (최신 1개)</h2>
        {!bracket ? (
          <p className="v3-muted">아직 확정 저장된 대진표가 없습니다.</p>
        ) : (
          <>
            <p>
              <strong>대진표 ID:</strong> {bracket.id}
            </p>
            {bracket.zoneId ? (
              <p>
                <strong>권역:</strong> {bracket.zoneId}
              </p>
            ) : null}
            <p>
              <strong>입력 스냅샷:</strong> {bracket.snapshotId}
            </p>
            <p>
              <strong>생성 시각:</strong> {new Date(bracket.createdAt).toLocaleString("ko-KR")}
            </p>
            {bracket.rounds.map((round) => (
              <div key={`${bracket.id}-${round.roundNumber}`} className="v3-box v3-stack" style={{ background: "#fafafa" }}>
                <p style={{ fontWeight: 700 }}>
                  Round {round.roundNumber} ({getRoundStatusLabel(round.status)})
                </p>
                {round.matches.length === 0 ? (
                  <p className="v3-muted">매치가 없습니다.</p>
                ) : (
                  <div className="v3-stack">
                    {round.matches.map((match) => (
                      <div key={match.id} className="v3-box v3-stack">
                        <p>
                          {match.player1.name} vs {match.player2.name}
                        </p>
                        <p className="v3-muted">승자: {match.winnerName ?? "-"}</p>
                        <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="v3-btn"
                            onClick={() => handleSetWinner(match.id, match.player1.userId)}
                            disabled={actionLoading}
                          >
                            {match.player1.name} 승
                          </button>
                          <button
                            type="button"
                            className="v3-btn"
                            onClick={() => handleSetWinner(match.id, match.player2.userId)}
                            disabled={actionLoading}
                          >
                            {match.player2.name} 승
                          </button>
                          <button
                            type="button"
                            className="v3-btn"
                            onClick={() => handleResetWinner(match.id)}
                            disabled={actionLoading}
                          >
                            결과 초기화
                          </button>
                        </div>
                        <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                          <select
                            value={replacementSelections[match.id]?.player1 ?? ""}
                            onChange={(event) =>
                              setReplacementSelections((prev) => ({
                                ...prev,
                                [match.id]: {
                                  player1: event.target.value,
                                  player2: prev[match.id]?.player2 ?? "",
                                },
                              }))
                            }
                          >
                            <option value="">player1 교체 대상</option>
                            {bracketPlayers.map((player) => (
                              <option key={`${match.id}-p1-${player.userId}`} value={player.userId}>
                                {player.name} ({player.userId})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="v3-btn"
                            onClick={() => handleReplacePlayer(match.id, "player1")}
                            disabled={actionLoading}
                          >
                            player1 교체
                          </button>
                        </div>
                        <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                          <select
                            value={replacementSelections[match.id]?.player2 ?? ""}
                            onChange={(event) =>
                              setReplacementSelections((prev) => ({
                                ...prev,
                                [match.id]: {
                                  player1: prev[match.id]?.player1 ?? "",
                                  player2: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">player2 교체 대상</option>
                            {bracketPlayers.map((player) => (
                              <option key={`${match.id}-p2-${player.userId}`} value={player.userId}>
                                {player.name} ({player.userId})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="v3-btn"
                            onClick={() => handleReplacePlayer(match.id, "player2")}
                            disabled={actionLoading}
                          >
                            player2 교체
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {round.status === "COMPLETED" &&
                !bracket.rounds.some((nextRound) => nextRound.roundNumber === round.roundNumber + 1) ? (
                  <div className="v3-row">
                    <button
                      type="button"
                      className="v3-btn"
                      onClick={() => handleAdvanceRound(round.roundNumber)}
                      disabled={actionLoading}
                    >
                      다음 라운드 생성
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </>
        )}
      </section>

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">최신 스냅샷 참가자</h2>
        {!snapshot ? (
          <p className="v3-muted">스냅샷이 없어 참가자 목록을 표시할 수 없습니다.</p>
        ) : (
          <ul className="v3-list">
            {snapshot.participants.map((participant, index) => (
              <li key={`${snapshot.id}-${participant.userId}-${index}`}>
                {participant.applicantName} / {participant.phone}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
