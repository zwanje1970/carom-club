"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

function buildMatchesSequential(parts: BracketParticipant[]): DraftMatch[] {
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

export default function BracketWizardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const urlZoneId = useMemo(() => searchParams.get("zoneId")?.trim() ?? "", [searchParams]);

  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [zoneOptions, setZoneOptions] = useState<{ id: string; zoneName: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"start" | "done">("start");
  const [tournamentStatusBadge, setTournamentStatusBadge] = useState("");
  const [participantsFinalizeModalOpen, setParticipantsFinalizeModalOpen] = useState(false);

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

  const bracketPlanEnabledForCreate = useMemo(() => {
    const b = tournamentStatusBadge.trim();
    return b === "마감" || b === "진행중" || b === "종료";
  }, [tournamentStatusBadge]);

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
        const json = (await res.json()) as { tournament?: { zonesEnabled?: boolean; statusBadge?: string | null } };
        if (!res.ok || cancelled || !json.tournament) return;
        setZonesEnabled(json.tournament.zonesEnabled === true);
        setTournamentStatusBadge(
          typeof json.tournament.statusBadge === "string" ? json.tournament.statusBadge.trim() : "",
        );
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
          const idz = typeof z.id === "string" ? z.id.trim() : "";
          const zoneName = typeof z.zoneName === "string" ? z.zoneName.trim() : "";
          if (idz && zoneName) opts.push({ id: idz, zoneName });
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

  async function createBracketFlow() {
    if (!tournamentId || busy) return;
    if (!bracketPlanEnabledForCreate) {
      setParticipantsFinalizeModalOpen(true);
      return;
    }
    if (zonesEnabled && !selectedZoneId) {
      setMessage("권역을 선택해 주세요.");
      return;
    }
    if (approvedCount < 2) {
      setMessage("승인된 참가확정자가 2명 미만입니다.");
      return;
    }
    if (
      !window.confirm(
        `참가확정자는 ${approvedCount}명입니다.\n대진표를 생성하시겠습니까?\n(1라운드는 신청 순서 기준 짝으로 생성됩니다.)`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const snapRes = await fetch(`/api/client/tournaments/${tournamentId}/bracket/participants-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zonesEnabled && selectedZoneId ? { zoneId: selectedZoneId } : {}),
      });
      const snapJson = (await snapRes.json()) as { snapshot?: BracketParticipantSnapshot; error?: string };
      if (!snapRes.ok || !snapJson.snapshot) {
        setMessage(snapJson.error ?? "대상자 스냅샷 생성에 실패했습니다.");
        return;
      }
      const snap = snapJson.snapshot;
      const matches = buildMatchesSequential(snap.participants);
      if (matches.length === 0) {
        setMessage("짝을 만들 수 없습니다. 인원이 홀수이거나 데이터가 부족합니다.");
        return;
      }

      const confRes = await fetch(`/api/client/tournaments/${tournamentId}/bracket/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: snap.id,
          matches,
        }),
      });
      const confJson = (await confRes.json()) as { ok?: boolean; error?: string };
      if (!confRes.ok || !confJson.ok) {
        setMessage(confJson.error ?? "대진표 확정에 실패했습니다.");
        return;
      }

      window.alert("대진표가 생성되었습니다.");
      setPhase("done");
    } catch {
      setMessage("대진표 생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function shuffleRoundOne() {
    if (!tournamentId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/shuffle-round-one${bracketZoneQuery}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ scope: "qualifiers_only", roundNumber: 1 }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? "다시 섞기에 실패했습니다.");
        return;
      }
      window.alert("1라운드를 다시 섞었습니다.");
    } catch {
      setMessage("다시 섞기 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const printHref = `/client/tournaments/${tournamentId}/participants/print`;

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem", maxWidth: 720 }}>
      <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link prefetch={false} href={`/client/tournaments/${tournamentId}${bracketZoneQuery}`} className="v3-muted">
          ← 대회 관리
        </Link>
      </div>

      <h1 className="v3-h2" style={{ marginBottom: 0 }}>
        대진표 생성
      </h1>
      <p className="v3-muted" style={{ margin: 0 }}>
        참가확정자 기준으로 빠르게 생성합니다. 세부 배정은 「대진표 관리」에서 조정할 수 있습니다.
      </p>

      {zonesEnabled ? (
        <section className="v3-box v3-stack" style={{ padding: "0.65rem 0.75rem" }}>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontWeight: 800 }}>권역</span>
            <select
              className="v3-btn"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              disabled={zoneOptions.length === 0 || phase === "done"}
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

      {phase === "start" ? (
        <section className="v3-box v3-stack">
          <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
            참가확정자는 {listLoading ? "…" : approvedCount}명입니다.
          </p>
          <div className="v3-row" style={{ gap: "0.45rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link prefetch={false} href={printHref} className="v3-btn" style={{ fontWeight: 700 }}>
              참가리스트 보기
            </Link>
            <Link prefetch={false} href={`/client/tournaments/${tournamentId}/participants`} className="v3-btn">
              신청자 관리
            </Link>
          </div>
          <button
            type="button"
            className="ui-btn-primary-solid"
            disabled={
              busy ||
              listLoading ||
              approvedCount < 2 ||
              (zonesEnabled && !selectedZoneId)
            }
            onClick={() => void createBracketFlow()}
            style={{ padding: "0.65rem 1.1rem", fontWeight: 800 }}
          >
            {busy ? "처리 중…" : "대진표 생성 확인"}
          </button>
        </section>
      ) : (
        <section className="v3-box v3-stack">
          <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem" }}>대진표가 생성되었습니다.</p>
          <div className="v3-row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
            <button type="button" className="ui-btn-primary-solid" disabled={busy} onClick={() => router.push(`/client/tournaments/${tournamentId}/bracket${bracketZoneQuery}`)} style={{ fontWeight: 700 }}>
              확인 · 대진표 관리로
            </button>
            <button type="button" className="v3-btn" disabled={busy} onClick={() => void shuffleRoundOne()} style={{ fontWeight: 700 }}>
              다시 섞기 (1라운드)
            </button>
          </div>
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            「대진표 분할」은 대진표 관리 화면에서 진행할 수 있습니다.
          </p>
        </section>
      )}

      {message ? (
        <p className="v3-muted" style={{ color: "#b45309", margin: 0 }}>
          {message}
        </p>
      ) : null}

      {participantsFinalizeModalOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding:
              "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, var(--client-bottom-space, 80px)) max(16px, env(safe-area-inset-left))",
            boxSizing: "border-box",
          }}
          onClick={() => setParticipantsFinalizeModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-participants-blocked-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "22rem",
              background: "#fff",
              borderRadius: "12px",
              padding: "1.15rem",
              border: "1px solid #cbd5e1",
              boxShadow: "none",
              boxSizing: "border-box",
            }}
          >
            <h2 id="wizard-participants-blocked-title" style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>
              안내
            </h2>
            <p
              style={{
                margin: "0 0 0.85rem",
                fontSize: "0.88rem",
                lineHeight: 1.5,
                color: "#334155",
                whiteSpace: "pre-wrap",
              }}
            >
              {"참가자가 아직 확정되지 않았습니다.\n\n참가자 확정 후 대진표를 생성하세요."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="v3-btn"
                onClick={() => setParticipantsFinalizeModalOpen(false)}
                style={{ minHeight: 44, fontWeight: 700 }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
