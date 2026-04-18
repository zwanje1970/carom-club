"use client";

import { useEffect, useMemo, useState } from "react";

type UserRole = "USER" | "CLIENT" | "PLATFORM";
type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";
type OrgClientType = "GENERAL" | "REGISTERED";
type OrgApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

type Row = {
  id: string;
  name: string;
  loginId: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  orgClientType: OrgClientType | null;
  orgApprovalStatus: OrgApprovalStatus | null;
  createdAt: string;
  updatedAt: string;
};

function roleLabel(role: UserRole): string {
  if (role === "PLATFORM") return "PLATFORM_ADMIN";
  if (role === "CLIENT") return "CLIENT_ADMIN";
  return "USER";
}

function statusLabel(status: UserStatus): string {
  if (status === "SUSPENDED") return "정지";
  if (status === "DELETED") return "삭제";
  return "정상";
}

export default function PlatformUsersClient() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | UserRole>("all");
  const [status, setStatus] = useState<"all" | UserStatus>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("USER");
  const [editStatus, setEditStatus] = useState<UserStatus>("ACTIVE");
  const [editOrgClientType, setEditOrgClientType] = useState<OrgClientType>("GENERAL");
  const [editOrgApprovalStatus, setEditOrgApprovalStatus] = useState<OrgApprovalStatus>("APPROVED");

  const emptyText = useMemo(() => (loading ? "불러오는 중..." : "조건에 맞는 회원이 없습니다."), [loading]);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (role !== "all") params.set("role", role);
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/platform/users?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as { items?: Row[]; error?: string };
      if (!response.ok) {
        setError(result.error ?? "회원목록을 불러오지 못했습니다.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(result.items) ? result.items : []);
    } catch {
      setError("회원목록을 불러오지 못했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function openManageModal(row: Row) {
    setSelected(row);
    setEditRole(row.role);
    setEditStatus(row.status);
    setEditOrgClientType(row.orgClientType ?? "GENERAL");
    setEditOrgApprovalStatus(row.orgApprovalStatus ?? "APPROVED");
    setMessage("");
    setError("");
    setSaveState("idle");
  }

  async function saveUser() {
    if (!selected || saving) return;
    setSaving(true);
    setSaveState("saving");
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/platform/users/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          status: editStatus,
          orgClientType: editRole === "CLIENT" ? editOrgClientType : undefined,
          orgApprovalStatus: editRole === "CLIENT" ? editOrgApprovalStatus : undefined,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "저장에 실패했습니다.");
        setSaveState("error");
        return;
      }
      setMessage("저장되었습니다.");
      setSaveState("success");
      setSelected(null);
      await loadUsers();
    } catch {
      setError("저장 중 오류가 발생했습니다.");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="v3-stack">
      <form
        className="v3-box v3-row"
        style={{ flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}
        onSubmit={(e) => {
          e.preventDefault();
          void loadUsers();
        }}
      >
        <label className="v3-stack" style={{ gap: "0.3rem" }}>
          <span style={{ fontWeight: 600 }}>검색</span>
          <input
            className="v3-input"
            placeholder="이름 / 아이디 / 이메일"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="v3-stack" style={{ gap: "0.3rem" }}>
          <span style={{ fontWeight: 600 }}>권한</span>
          <select className="v3-input" value={role} onChange={(e) => setRole(e.target.value as "all" | UserRole)}>
            <option value="all">전체</option>
            <option value="USER">USER</option>
            <option value="CLIENT">CLIENT_ADMIN</option>
            <option value="PLATFORM">PLATFORM_ADMIN</option>
          </select>
        </label>
        <label className="v3-stack" style={{ gap: "0.3rem" }}>
          <span style={{ fontWeight: 600 }}>상태</span>
          <select
            className="v3-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as "all" | UserStatus)}
          >
            <option value="all">전체</option>
            <option value="ACTIVE">정상</option>
            <option value="SUSPENDED">정지</option>
            <option value="DELETED">삭제</option>
          </select>
        </label>
        <button className="v3-btn" type="submit">
          조회
        </button>
      </form>

      <section className="v3-box v3-stack">
        {error ? <p className="v3-muted" style={{ color: "#b91c1c" }}>{error}</p> : null}
        {rows.length === 0 ? (
          <p className="v3-muted">{emptyText}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.45rem 0.3rem" }}>이름</th>
                  <th style={{ textAlign: "left", padding: "0.45rem 0.3rem" }}>아이디</th>
                  <th style={{ textAlign: "left", padding: "0.45rem 0.3rem" }}>이메일</th>
                  <th style={{ textAlign: "left", padding: "0.45rem 0.3rem" }}>권한</th>
                  <th style={{ textAlign: "left", padding: "0.45rem 0.3rem" }}>상태</th>
                  <th style={{ textAlign: "left", padding: "0.45rem 0.3rem" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "0.45rem 0.3rem" }}>{row.name}</td>
                    <td style={{ padding: "0.45rem 0.3rem" }}>{row.loginId}</td>
                    <td style={{ padding: "0.45rem 0.3rem" }}>{row.email ?? "-"}</td>
                    <td style={{ padding: "0.45rem 0.3rem" }}>{roleLabel(row.role)}</td>
                    <td style={{ padding: "0.45rem 0.3rem" }}>{statusLabel(row.status)}</td>
                    <td style={{ padding: "0.45rem 0.3rem" }}>
                      <button className="v3-btn" type="button" onClick={() => openManageModal(row)}>
                        관리
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setSelected(null)}
        >
          <div
            className="v3-box v3-stack"
            style={{ width: "100%", maxWidth: "34rem", maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="v3-h2" style={{ marginBottom: 0 }}>
              회원 관리
            </h2>

            <section className="v3-stack" style={{ gap: "0.35rem" }}>
              <p style={{ margin: 0 }}>이름: {selected.name}</p>
              <p style={{ margin: 0 }}>아이디: {selected.loginId}</p>
              <p style={{ margin: 0 }}>이메일: {selected.email ?? "-"}</p>
            </section>

            <label className="v3-stack" style={{ gap: "0.3rem" }}>
              <span style={{ fontWeight: 600 }}>권한 설정</span>
              <select className="v3-input" value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
                <option value="USER">USER</option>
                <option value="CLIENT">CLIENT_ADMIN</option>
                <option value="PLATFORM">PLATFORM_ADMIN</option>
              </select>
            </label>

            <label className="v3-stack" style={{ gap: "0.3rem" }}>
              <span style={{ fontWeight: 600 }}>상태 설정</span>
              <select
                className="v3-input"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as UserStatus)}
              >
                <option value="ACTIVE">정상</option>
                <option value="SUSPENDED">정지</option>
                <option value="DELETED">삭제</option>
              </select>
            </label>

            {editRole === "CLIENT" ? (
              <>
                <label className="v3-stack" style={{ gap: "0.3rem" }}>
                  <span style={{ fontWeight: 600 }}>클라이언트 유형</span>
                  <select
                    className="v3-input"
                    value={editOrgClientType}
                    onChange={(e) => setEditOrgClientType(e.target.value as OrgClientType)}
                  >
                    <option value="GENERAL">일반</option>
                    <option value="REGISTERED">연회원</option>
                  </select>
                </label>
                <label className="v3-stack" style={{ gap: "0.3rem" }}>
                  <span style={{ fontWeight: 600 }}>승인 상태</span>
                  <select
                    className="v3-input"
                    value={editOrgApprovalStatus}
                    onChange={(e) => setEditOrgApprovalStatus(e.target.value as OrgApprovalStatus)}
                  >
                    <option value="PENDING">대기</option>
                    <option value="APPROVED">승인</option>
                    <option value="REJECTED">거절</option>
                  </select>
                </label>
              </>
            ) : null}

            {message ? <p className="v3-muted">{message}</p> : null}
            {error ? <p className="v3-muted" style={{ color: "#b91c1c" }}>{error}</p> : null}

            <div className="v3-row" style={{ justifyContent: "flex-end", gap: "0.5rem", alignItems: "center" }}>
              <button className="v3-btn" type="button" onClick={() => setSelected(null)}>
                취소
              </button>
              <button className="v3-btn" type="button" onClick={saveUser} disabled={saving}>
                저장
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
