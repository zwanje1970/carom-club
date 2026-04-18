"use client";

import { useState } from "react";

type Props = {
  clientId: string;
  initial: {
    name: string;
    status: "ACTIVE" | "SUSPENDED" | "EXPELLED";
    clientType: "GENERAL" | "REGISTERED";
    membershipType: "NONE" | "ANNUAL";
    membershipExpireAt: string | null;
    adminRemarks: string | null;
  };
};

export default function ClientOrganizationDetailForm({ clientId, initial }: Props) {
  const [status, setStatus] = useState<Props["initial"]["status"]>(initial.status);
  const [clientType, setClientType] = useState<Props["initial"]["clientType"]>(initial.clientType);
  const [membershipType, setMembershipType] = useState<Props["initial"]["membershipType"]>(initial.membershipType);
  const [membershipExpireAt, setMembershipExpireAt] = useState(initial.membershipExpireAt ?? "");
  const [adminRemarks, setAdminRemarks] = useState(initial.adminRemarks ?? "");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveState("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/platform/client-organizations/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          clientType,
          membershipType,
          membershipExpireAt: membershipType === "ANNUAL" ? (membershipExpireAt || null) : null,
          adminRemarks: adminRemarks || null,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "저장에 실패했습니다.");
        setSaveState("error");
        return;
      }
      setMessage("저장되었습니다.");
      setSaveState("success");
    } catch {
      setMessage("저장 중 오류가 발생했습니다.");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="v3-box v3-stack">
      <h2 className="v3-h2">운영 관리</h2>
      <p>업체명: {initial.name}</p>
      <label className="v3-stack" style={{ gap: "0.3rem" }}>
        <span style={{ fontWeight: 600 }}>상태</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as Props["initial"]["status"])} className="v3-input">
          <option value="ACTIVE">정상</option>
          <option value="SUSPENDED">정지</option>
          <option value="EXPELLED">제명</option>
        </select>
      </label>
      <label className="v3-stack" style={{ gap: "0.3rem" }}>
        <span style={{ fontWeight: 600 }}>회원 유형</span>
        <select
          value={clientType}
          onChange={(e) => {
            const next = e.target.value === "REGISTERED" ? "REGISTERED" : "GENERAL";
            setClientType(next);
            if (next === "REGISTERED") setMembershipType("ANNUAL");
            if (next === "GENERAL") setMembershipType("NONE");
          }}
          className="v3-input"
        >
          <option value="GENERAL">일반</option>
          <option value="REGISTERED">연회원</option>
        </select>
      </label>
      <label className="v3-stack" style={{ gap: "0.3rem" }}>
        <span style={{ fontWeight: 600 }}>연회원 유형</span>
        <select
          value={membershipType}
          onChange={(e) => setMembershipType(e.target.value === "ANNUAL" ? "ANNUAL" : "NONE")}
          className="v3-input"
        >
          <option value="NONE">일반</option>
          <option value="ANNUAL">연회원</option>
        </select>
      </label>
      <label className="v3-stack" style={{ gap: "0.3rem" }}>
        <span style={{ fontWeight: 600 }}>연회원 만료일</span>
        <input
          type="date"
          value={membershipExpireAt}
          onChange={(e) => setMembershipExpireAt(e.target.value)}
          className="v3-input"
          disabled={membershipType !== "ANNUAL"}
        />
      </label>
      <label className="v3-stack" style={{ gap: "0.3rem" }}>
        <span style={{ fontWeight: 600 }}>관리자 비고</span>
        <textarea
          value={adminRemarks}
          onChange={(e) => setAdminRemarks(e.target.value)}
          className="v3-input"
          rows={4}
        />
      </label>
      <div className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
        <button type="button" className="v3-btn" disabled={saving} onClick={handleSave}>
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
      {message ? <p className="v3-muted">{message}</p> : null}
    </section>
  );
}
