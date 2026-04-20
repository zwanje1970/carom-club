"use client";

import { useState } from "react";

type Props = {
  applicationId: string;
  initialStatus: "PENDING" | "APPROVED" | "REJECTED";
  initialRejectedReason: string;
};

export default function ApplicationStatusUpdateForm({
  applicationId,
  initialStatus,
  initialRejectedReason,
}: Props) {
  const [status, setStatus] = useState<Props["initialStatus"]>(initialStatus);
  const [rejectedReason, setRejectedReason] = useState(initialRejectedReason);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorDetail, setErrorDetail] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveState("saving");
    setErrorDetail("");
    try {
      const formData = new FormData();
      formData.set("status", status);
      formData.set("rejectedReason", rejectedReason);
      const response = await fetch(`/api/platform/client-applications/${encodeURIComponent(applicationId)}/status`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        step?: string;
      };
      if (!response.ok) {
        setSaveState("error");
        const parts = [
          data.error ?? `요청 실패 (${response.status})`,
          data.step ? `[${data.step}]` : "",
        ].filter(Boolean);
        setErrorDetail(parts.join(" "));
        return;
      }
      if (!data.ok) {
        setSaveState("error");
        setErrorDetail(data.error ?? "저장에 실패했습니다.");
        return;
      }
      setSaveState("success");
      window.setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch {
      setSaveState("error");
      setErrorDetail("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="v3-stack">
      <label className="v3-stack" style={{ gap: "0.3rem" }}>
        <span style={{ fontWeight: 600 }}>상태 변경</span>
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as Props["initialStatus"])}
          className="v3-input"
          style={{ maxWidth: "12rem", padding: "0.45rem 0.5rem" }}
        >
          <option value="PENDING">미확인</option>
          <option value="APPROVED">승인</option>
          <option value="REJECTED">거절</option>
        </select>
      </label>
      <label className="v3-stack" style={{ gap: "0.3rem" }}>
        <span style={{ fontWeight: 600 }}>거절 사유(거절 시)</span>
        <input
          name="rejectedReason"
          value={rejectedReason}
          onChange={(event) => setRejectedReason(event.target.value)}
          className="v3-input"
          placeholder="거절 사유를 입력하세요"
          style={{ maxWidth: "28rem", padding: "0.45rem 0.5rem" }}
        />
      </label>
      <div className="v3-row" style={{ alignItems: "center", gap: "0.5rem" }}>
        <button className="v3-btn" type="submit" style={{ padding: "0.55rem 0.9rem" }} disabled={saving}>
          저장
        </button>
        {saveState !== "idle" ? (
          <span
            className="v3-muted"
            style={{ color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280" }}
          >
            {saveState === "success" ? "저장성공" : saveState === "error" ? "저장실패" : "저장중"}
            {saveState === "error" && errorDetail ? ` — ${errorDetail}` : ""}
          </span>
        ) : null}
      </div>
    </form>
  );
}
