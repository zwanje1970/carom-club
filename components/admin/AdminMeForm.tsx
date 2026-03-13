"use client";

import { useState } from "react";
import FormField from "./_components/FormField";
import Button from "./_components/Button";
import NotificationBar from "./_components/NotificationBar";

export function AdminMeForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "새 비밀번호는 6자 이상이어야 합니다." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "새 비밀번호 확인이 일치하지 않습니다." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "변경에 실패했습니다." });
        return;
      }
      setMessage({ type: "ok", text: "비밀번호가 변경되었습니다." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-3">
      {message &&
        (message.type === "ok" ? (
          <NotificationBar color="success">{message.text}</NotificationBar>
        ) : (
          <NotificationBar color="danger">{message.text}</NotificationBar>
        ))}
      <FormField label="현재 비밀번호" labelFor="me-current-pw">
        {({ className }) => (
          <input
            id="me-current-pw"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={className}
          />
        )}
      </FormField>
      <FormField label="새 비밀번호" labelFor="me-new-pw" help="6자 이상">
        {({ className }) => (
          <input
            id="me-new-pw"
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={className}
          />
        )}
      </FormField>
      <FormField label="새 비밀번호 확인" labelFor="me-confirm-pw">
        {({ className }) => (
          <input
            id="me-confirm-pw"
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={className}
          />
        )}
      </FormField>
      <Button
        type="submit"
        label={loading ? "저장중" : "비밀번호 변경"}
        color="info"
        disabled={loading}
      />
    </form>
  );
}
