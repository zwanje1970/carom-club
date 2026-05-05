"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { expectedTotalKnockoutMatches, roundLabelFromMatchCount } from "../bracket-progress-utils";

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

type DraftMatch = {
  player1: { userId: string; name: string };
  player2: { userId: string; name: string };
};

type ListItem = {
  status?: string;
  zoneId?: string | null;
};

function shuffleParticipants(parts: BracketParticipant[]): BracketParticipant[] {
  const a = [...parts];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function buildMatchesFromParticipants(parts: BracketParticipant[]): DraftMatch[] {
  const pairCount = Math.floor(parts.length / 2);
  const matches: DraftMatch[] = [];
  for (let i = 0; i < pairCount * 2; i += 2) {
    const p1 = parts[i]!;
    const p2 = parts[i + 1]!;
    matches.push({
      player1: { userId: p1.userId, name: p1.applicantName },
      player2: { userId: p2.userId, name: p2.applicantName },
    });
  }
  return matches;
}

function randomPairingFromSnapshot(snapshot: BracketParticipantSnapshot): DraftMatch[] {
  return buildMatchesFromParticipants(shuffleParticipants(snapshot.participants));
}

function sequentialPairingFromSnapshot(snapshot: BracketParticipantSnapshot): DraftMatch[] {
  return buildMatchesFromParticipants(snapshot.participants);
}

export default function BracketCreateWizardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const urlZoneId = useMemo(() => searchParams.get("zoneId")?.trim() ?? "", [searchParams]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [zoneOptions, setZoneOptions] = useState<{ id: string; zoneName: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<BracketParticipantSnapshot | null>(null);
  const [matches, setMatches] = useState<DraftMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const bracketZoneQuery = useMemo(() => {
    if (!zonesEnabled || !selectedZoneId) return "";
    return `?zoneId=${encodeURIComponent(selectedZoneId)}`;
  }, [zonesEnabled, selectedZoneId]);

  const approvedEntries = useMemo(() => {
    return listItems.filter((e) => {
      if (e.status !== "APPROVED") return false;
      if (!zonesEnabled || !selectedZoneId) return true;
      const z = typeof e.zoneId === "string" ? e.zoneId.trim() : "";
      return z === selectedZoneId;
    });
  }, [listItems, zonesEnabled, selectedZoneId]);

  const approvedCount = approvedEntries.length;

  const loadListItems = useCallback(async () => {
    if (!tournamentId) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/applications/list-items`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as { ok?: boolean; entries?: ListItem[]; error?: string };
      if (!res.ok || !json.ok || !Array.isArray(json.entries)) {
        setMessage(json.error ?? "참가 신청 목록을 불러오지 못했습니다.");
        setListItems([]);
        return;
      }
      setListItems(json.entries);
      setMessage("");
    } catch {
      setMessage("참가 신청 목록을 불러오는 중 오류가 발생했습니다.");
      setListItems([]);
    } finally {
      setListLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void loadListItems();
  }, [loadListItems]);

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

  async function handleConfirmParticipantsNext() {
    if (!tournamentId || busy) return;
    if (zonesEnabled && !selectedZoneId) {
      setMessage("권역을 선택해 주세요.");
      return;
    }
    if (approvedCount < 2) return;
    setBusy(true);
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
        setMessage(result.error ?? "대상자 확정에 실패했습니다.");
        return;
      }
      const snap = result.snapshot;
      setSnapshot(snap);
      const initial = sequentialPairingFromSnapshot(snap);
      setMatches(initial);
      setStep(2);
    } catch {
      setMessage("대상자 확정 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function applyRandomPairing() {
    if (!snapshot) return;
    setMatches(randomPairingFromSnapshot(snapshot));
  }

  async function handleFinalConfirm() {
    if (!tournamentId || !snapshot || busy || matches.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: snapshot.id,
          matches,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? "대진표 확정에 실패했습니다.");
        return;
      }
      router.push(`/client/tournaments/${tournamentId}/bracket${bracketZoneQuery}`);
    } catch {
      setMessage("대진표 확정 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const round1MatchCount = matches.length;
  const canProceedStep1 =
    approvedCount >= 2 && (!zonesEnabled || Boolean(selectedZoneId)) && !listLoading && !busy;

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem", maxWidth: 720 }}>
      <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link prefetch={false} href={`/client/tournaments/${tournamentId}/bracket${bracketZoneQuery}`} className="v3-muted">
          ← 대진표 관리
        </Link>
      </div>

      <p className="v3-muted" style={{ margin: 0 }}>
        단계 {step}/3 —{" "}
        {step === 1 ? "참가자 확인" : step === 2 ? "자동 배정" : "확정"}
      </p>

      {zonesEnabled ? (
        <section className="v3-box v3-stack" style={{ padding: "0.65rem 0.75rem" }}>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontWeight: 800 }}>권역</span>
            <select
              className="v3-btn"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              disabled={zoneOptions.length === 0 || step > 1}
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
        </section>
      ) : null}

      {step === 1 ? (
        <section className="v3-box v3-stack">
          <h2 className="v3-h2">1단계: 참가자 확인</h2>
          <p style={{ margin: 0 }}>
            승인된 참가자만 대진표에 포함됩니다. (상태가 승인이 아닌 신청은 제외됩니다.)
          </p>
          {listLoading ? (
            <p className="v3-muted">불러오는 중…</p>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                승인 참가자 {approvedCount}명
              </p>
              {approvedCount >= 2 && approvedCount % 2 === 0 ? (
                <p style={{ margin: 0, color: "#15803d", fontWeight: 600 }}>
                  {approvedCount}강 생성 가능 · 1라운드 {approvedCount / 2}경기
                </p>
              ) : null}
              {approvedCount >= 2 && approvedCount % 2 === 1 ? (
                <p className="v3-muted" style={{ margin: 0 }}>
                  홀수 인원입니다. 자동 배정 시 마지막 1명은 짝을 만들 수 없어 제외됩니다.
                </p>
              ) : null}
              {approvedCount < 2 ? (
                <p className="v3-muted" style={{ margin: 0 }}>
                  참가자가 2명 미만이면 다음 단계로 진행할 수 없습니다.
                </p>
              ) : null}
            </>
          )}
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ui-btn-primary-solid"
              disabled={!canProceedStep1}
              onClick={() => void handleConfirmParticipantsNext()}
              style={{ padding: "0.65rem 1.2rem", fontWeight: 700 }}
            >
              {busy ? "처리 중…" : "대상자 확정 후 다음 단계로"}
            </button>
            <Link className="v3-btn" href={`/client/tournaments/${tournamentId}/participants`}>
              참가자 관리
            </Link>
          </div>
        </section>
      ) : null}

      {step === 2 && snapshot ? (
        <section className="v3-box v3-stack">
          <h2 className="v3-h2">2단계: 자동 배정</h2>
          <p className="v3-muted" style={{ margin: 0 }}>
            아래는 아직 저장되지 않은 1라운드 짝입니다. 확정 전까지 실제 대진표 데이터는 만들어지지 않습니다.
          </p>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="v3-btn" onClick={applyRandomPairing}>
              자동 배정
            </button>
            <button type="button" className="v3-btn" onClick={applyRandomPairing}>
              다시 섞기
            </button>
          </div>
          <p style={{ margin: 0 }}>
            <strong>1라운드</strong> {round1MatchCount}경기
          </p>
          {matches.length === 0 ? (
            <p className="v3-muted">매치를 만들 수 없습니다.</p>
          ) : (
            <ul className="v3-list">
              {matches.map((m, index) => (
                <li key={`${m.player1.userId}-${m.player2.userId}-${index}`}>
                  {m.player1.name} vs {m.player2.name}
                </li>
              ))}
            </ul>
          )}
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="v3-btn" onClick={() => setStep(1)} disabled={busy}>
              이전
            </button>
            <button
              type="button"
              className="ui-btn-primary-solid"
              disabled={matches.length === 0 || busy}
              onClick={() => setStep(3)}
              style={{ padding: "0.65rem 1.2rem", fontWeight: 700 }}
            >
              다음: 확정 전 확인
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 && snapshot ? (
        <section className="v3-box v3-stack">
          <h2 className="v3-h2">3단계: 확정</h2>
          <p className="v3-muted" style={{ margin: 0 }}>
            확정 후에는 대진표 진행 데이터가 생성됩니다. 참가자 변경이 필요하면 확정 전에 돌아가 수정하세요.
          </p>
          <div
            className="v3-box"
            style={{
              padding: "0.65rem 0.85rem",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          >
            <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: "#0f172a" }}>확정 예정 대진표</p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.84rem", color: "#334155", lineHeight: 1.45 }}>
              {roundLabelFromMatchCount(matches.length)} · 전체 {expectedTotalKnockoutMatches(snapshot.participants.length)}경기 · 참가자{" "}
              {snapshot.participants.length}명
            </p>
          </div>
          <div className="v3-box v3-stack" style={{ background: "#fafafa" }}>
            <p style={{ fontWeight: 700, margin: 0 }}>전체 미리보기 · Round 1</p>
            <ul className="v3-list">
              {matches.map((match, index) => (
                <li key={`${match.player1.userId}-${match.player2.userId}-${index}`}>
                  {match.player1.name} vs {match.player2.name}
                </li>
              ))}
            </ul>
          </div>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="v3-btn" onClick={() => setStep(2)} disabled={busy}>
              이전
            </button>
            <button
              type="button"
              className="ui-btn-primary-solid"
              disabled={busy || matches.length === 0}
              onClick={() => void handleFinalConfirm()}
              style={{ padding: "0.65rem 1.2rem", fontWeight: 700 }}
            >
              {busy ? "처리 중…" : "대진표 확정"}
            </button>
          </div>
        </section>
      ) : null}

      {message ? (
        <p className="v3-muted" style={{ color: "#b45309" }}>
          {message}
        </p>
      ) : null}
    </main>
  );
}
