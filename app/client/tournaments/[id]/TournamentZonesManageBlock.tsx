"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AuthRole } from "../../../../lib/auth/roles";

export type TournamentZoneRow = {
  id: string;
  tournamentId: string;
  zoneName: string;
  zoneCode: string | null;
  sortOrder: number;
  zoneManagerUserIds: string[];
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  tvAccessToken?: string | null;
};

function parseManagerIdsFromText(text: string): string[] {
  const parts = text.split(/[\s,;]+/).map((s) => s.trim());
  const out: string[] = [];
  for (const p of parts) {
    if (p) out.push(p);
  }
  return out;
}

function managersToText(ids: string[]): string {
  return ids.join("\n");
}

function canShowZoneTvLinkButton(params: {
  viewerRole: AuthRole | null;
  tournamentCreatedBy: string;
  viewerCanonicalUserId: string;
  viewerSessionUserId: string;
  zone: TournamentZoneRow;
}): boolean {
  if (params.viewerRole === "PLATFORM") return true;
  const created = params.tournamentCreatedBy.trim();
  const can = params.viewerCanonicalUserId.trim();
  const sess = params.viewerSessionUserId.trim();
  if (created && (created === can || created === sess)) return true;
  return params.zone.zoneManagerUserIds.some((m) => {
    const t = m.trim();
    return t === can || t === sess;
  });
}

export default function TournamentZonesManageBlock({
  tournamentId,
  zonesEnabled,
  tournamentEditHref,
  tournamentCreatedBy,
  viewerRole,
  viewerCanonicalUserId,
  viewerSessionUserId,
}: {
  tournamentId: string;
  zonesEnabled: boolean;
  tournamentEditHref: string;
  tournamentCreatedBy: string;
  viewerRole: AuthRole | null;
  viewerCanonicalUserId: string;
  viewerSessionUserId: string;
}) {
  const [zones, setZones] = useState<TournamentZoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tvBusyZoneId, setTvBusyZoneId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TournamentZoneRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formSort, setFormSort] = useState("0");
  const [formManagers, setFormManagers] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const id = tournamentId.trim();
    if (!id || !zonesEnabled) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(id)}/zones`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as { zones?: TournamentZoneRow[]; error?: string };
      if (!res.ok) {
        setZones([]);
        setMessage(json.error ?? "권역 목록을 불러오지 못했습니다.");
        return;
      }
      const list = Array.isArray(json.zones) ? json.zones : [];
      setZones([...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)));
    } catch {
      setZones([]);
      setMessage("네트워크 오류로 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId, zonesEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormCode("");
    setFormSort(String(zones.length > 0 ? Math.max(...zones.map((z) => z.sortOrder)) + 1 : 0));
    setFormManagers("");
    setModalOpen(true);
    setMessage(null);
  };

  const openEdit = (z: TournamentZoneRow) => {
    setEditing(z);
    setFormName(z.zoneName);
    setFormCode(z.zoneCode ?? "");
    setFormSort(String(z.sortOrder));
    setFormManagers(managersToText(z.zoneManagerUserIds));
    setModalOpen(true);
    setMessage(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onSave = async () => {
    const id = tournamentId.trim();
    if (!id) return;
    const name = formName.trim();
    if (!name) {
      setMessage("권역명을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const sortNum = Number(formSort);
      const sortOrder = Number.isFinite(sortNum) ? Math.floor(sortNum) : 0;
      const zoneManagerUserIds = parseManagerIdsFromText(formManagers);

      if (editing) {
        const res = await fetch(
          `/api/client/tournaments/${encodeURIComponent(id)}/zones/${encodeURIComponent(editing.id)}`,
          {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              zoneName: name,
              zoneCode: formCode.trim() === "" ? null : formCode.trim(),
              sortOrder,
              zoneManagerUserIds,
            }),
          }
        );
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMessage(json.error ?? "저장에 실패했습니다.");
          return;
        }
      } else {
        const res = await fetch(`/api/client/tournaments/${encodeURIComponent(id)}/zones`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zoneName: name,
            zoneCode: formCode.trim() === "" ? null : formCode.trim(),
            sortOrder,
            zoneManagerUserIds,
          }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMessage(json.error ?? "추가에 실패했습니다.");
          return;
        }
      }
      closeModal();
      await load();
    } catch {
      setMessage("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const onDeactivate = async (z: TournamentZoneRow) => {
    if (z.status !== "ACTIVE") return;
    if (!window.confirm(`「${z.zoneName}」권역을 비활성화할까요?`)) return;
    const id = tournamentId.trim();
    setMessage(null);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(id)}/zones/${encodeURIComponent(z.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INACTIVE" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "비활성화에 실패했습니다.");
        return;
      }
      await load();
    } catch {
      setMessage("네트워크 오류로 비활성화하지 못했습니다.");
    }
  };

  const onTvLinkClick = async (z: TournamentZoneRow) => {
    const tid = tournamentId.trim();
    if (!tid) return;
    setTvBusyZoneId(z.id);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/client/tournaments/${encodeURIComponent(tid)}/zones/${encodeURIComponent(z.id)}/tv-access-token`,
        { method: "POST", credentials: "same-origin" }
      );
      const json = (await res.json()) as { token?: string; url?: string; error?: string };
      if (!res.ok || typeof json.url !== "string" || !json.url.trim()) {
        setMessage(json.error ?? "TV 링크를 가져오지 못했습니다.");
        return;
      }
      const url = json.url.trim();
      try {
        await navigator.clipboard.writeText(url);
        setMessage("TV 링크가 복사되었습니다.");
      } catch {
        window.alert(`클립보드 복사에 실패했습니다. 아래 주소를 수동으로 복사해 주세요.\n\n${url}`);
      }
      const tok = typeof json.token === "string" && json.token.trim() !== "" ? json.token.trim() : z.tvAccessToken ?? null;
      setZones((prev) => prev.map((r) => (r.id === z.id ? { ...r, tvAccessToken: tok } : r)));
    } catch {
      setMessage("네트워크 오류로 TV 링크를 가져오지 못했습니다.");
    } finally {
      setTvBusyZoneId(null);
    }
  };

  if (!zonesEnabled) {
    return (
      <section className="v3-box v3-stack" style={{ gap: "0.65rem", padding: "1rem" }} aria-label="권역 관리">
        <h2 className="v3-h2" style={{ margin: 0, fontSize: "1.05rem" }}>
          권역 관리
        </h2>
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          권역 운영을 사용하려면 대회 정보에서 권역 모드를 활성화하세요.
        </p>
        <div>
          <Link prefetch={false} href={tournamentEditHref} className="v3-btn">
            대회 정보 수정
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="v3-box v3-stack" style={{ gap: "0.65rem", padding: "1rem" }} aria-label="권역 관리">
      <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 className="v3-h2" style={{ margin: 0, fontSize: "1.05rem" }}>
          권역 관리
        </h2>
        <button type="button" className="v3-btn" disabled={loading} onClick={() => openAdd()}>
          권역 추가
        </button>
      </div>
      <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        참가자 배정·대진표·TV 연결은 이후 단계에서 제공됩니다.
      </p>

      {loading && zones.length === 0 ? (
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          불러오는 중…
        </p>
      ) : zones.length === 0 ? (
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          등록된 권역이 없습니다. 권역 추가로 만들 수 있습니다.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "28rem",
              borderCollapse: "collapse",
              fontSize: "0.84rem",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "0.35rem 0.5rem" }}>정렬</th>
                <th style={{ padding: "0.35rem 0.5rem" }}>권역명</th>
                <th style={{ padding: "0.35rem 0.5rem" }}>코드</th>
                <th style={{ padding: "0.35rem 0.5rem" }}>관리자</th>
                <th style={{ padding: "0.35rem 0.5rem" }}>상태</th>
                <th style={{ padding: "0.35rem 0.5rem", whiteSpace: "nowrap" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} style={{ borderBottom: "1px solid #eef2f7", opacity: z.status === "INACTIVE" ? 0.65 : 1 }}>
                  <td style={{ padding: "0.35rem 0.5rem" }}>{z.sortOrder}</td>
                  <td style={{ padding: "0.35rem 0.5rem" }}>{z.zoneName}</td>
                  <td style={{ padding: "0.35rem 0.5rem" }}>{z.zoneCode ?? "—"}</td>
                  <td style={{ padding: "0.35rem 0.5rem", maxWidth: "12rem", wordBreak: "break-all" }}>
                    {z.zoneManagerUserIds.length ? z.zoneManagerUserIds.join(", ") : "—"}
                  </td>
                  <td style={{ padding: "0.35rem 0.5rem" }}>{z.status === "ACTIVE" ? "활성" : "비활성"}</td>
                  <td style={{ padding: "0.35rem 0.5rem" }}>
                    <div
                      className="v3-row"
                      style={{
                        gap: "0.35rem",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div className="v3-row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                        <button type="button" className="v3-btn" style={{ fontSize: "0.78rem", padding: "0.2rem 0.45rem" }} onClick={() => openEdit(z)}>
                          수정
                        </button>
                        {z.status === "ACTIVE" ? (
                          <button
                            type="button"
                            className="v3-btn"
                            style={{ fontSize: "0.78rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => void onDeactivate(z)}
                          >
                            비활성화
                          </button>
                        ) : null}
                      </div>
                      {canShowZoneTvLinkButton({
                        viewerRole,
                        tournamentCreatedBy,
                        viewerCanonicalUserId,
                        viewerSessionUserId,
                        zone: z,
                      }) ? (
                        <button
                          type="button"
                          className="v3-btn"
                          style={{ fontSize: "0.75rem", padding: "0.18rem 0.4rem", whiteSpace: "nowrap" }}
                          disabled={tvBusyZoneId === z.id}
                          onClick={() => void onTvLinkClick(z)}
                        >
                          {tvBusyZoneId === z.id
                            ? "처리 중…"
                            : z.tvAccessToken && String(z.tvAccessToken).trim() !== ""
                              ? "TV 링크 복사"
                              : "TV 링크 생성"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message ? (
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {message}
        </p>
      ) : null}

      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing ? "권역 수정" : "권역 추가"}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="v3-box v3-stack"
            style={{
              width: "100%",
              maxWidth: "26rem",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "1rem",
              gap: "0.55rem",
              background: "#fff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
              {editing ? "권역 수정" : "권역 추가"}
            </h3>
            <label className="v3-stack" style={{ gap: "0.2rem" }}>
              <span className="v3-muted" style={{ fontSize: "0.82rem" }}>
                권역명
              </span>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ width: "100%", padding: "0.45rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
            <label className="v3-stack" style={{ gap: "0.2rem" }}>
              <span className="v3-muted" style={{ fontSize: "0.82rem" }}>
                코드 (선택)
              </span>
              <input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                style={{ width: "100%", padding: "0.45rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
            <label className="v3-stack" style={{ gap: "0.2rem" }}>
              <span className="v3-muted" style={{ fontSize: "0.82rem" }}>
                정렬값 (sortOrder)
              </span>
              <input
                inputMode="numeric"
                value={formSort}
                onChange={(e) => setFormSort(e.target.value)}
                style={{ width: "100%", padding: "0.45rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
            <label className="v3-stack" style={{ gap: "0.2rem" }}>
              <span className="v3-muted" style={{ fontSize: "0.82rem" }}>
                관리자 userId (줄바꿈·쉼표·세미콜론으로 구분)
              </span>
              <textarea
                value={formManagers}
                onChange={(e) => setFormManagers(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  resize: "vertical",
                  padding: "0.45rem 0.55rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              />
            </label>
            <div className="v3-row" style={{ gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.35rem" }}>
              <button type="button" className="v3-btn" disabled={saving} onClick={() => closeModal()}>
                취소
              </button>
              <button type="button" className="v3-btn" disabled={saving} onClick={() => void onSave()}>
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
