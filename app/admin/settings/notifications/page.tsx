"use client";

import { useState, useEffect } from "react";
import { mdiCog } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type NotificationSettings = {
  adminEmail: string | null;
  notifyNewRegistration: boolean;
  notifyRegistrationConfirmed: boolean;
  notifyPaymentConfirmed: boolean;
  notifyAnnouncement: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  adminEmail: null,
  notifyNewRegistration: true,
  notifyRegistrationConfirmed: true,
  notifyPaymentConfirmed: true,
  notifyAnnouncement: true,
};

export default function AdminSettingsNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch("/api/admin/notification-settings")
      .then((res) => {
        if (!res.ok) throw new Error("불러오기 실패");
        return res.json();
      })
      .then((data: NotificationSettings) => {
        setForm({
          adminEmail: data.adminEmail ?? "",
          notifyNewRegistration: data.notifyNewRegistration ?? true,
          notifyRegistrationConfirmed: data.notifyRegistrationConfirmed ?? true,
          notifyPaymentConfirmed: data.notifyPaymentConfirmed ?? true,
          notifyAnnouncement: data.notifyAnnouncement ?? true,
        });
      })
      .catch(() => setForm(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: form.adminEmail?.trim() || null,
          notifyNewRegistration: form.notifyNewRegistration,
          notifyRegistrationConfirmed: form.notifyRegistrationConfirmed,
          notifyPaymentConfirmed: form.notifyPaymentConfirmed,
          notifyAnnouncement: form.notifyAnnouncement,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "저장에 실패했습니다.");
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiCog} title="알림 설정">
          <Button href="/admin/settings" label="← 설정" color="contrast" small />
        </SectionTitleLineWithButton>
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCog} title="알림 설정">
        <Button href="/admin/settings" label="← 설정" color="contrast" small />
      </SectionTitleLineWithButton>
      <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
        이메일·알림 발송 옵션을 설정합니다. 실제 발송은 추후 연동됩니다.
      </p>
      <CardBox className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <NotificationBar color="danger">{error}</NotificationBar>
        )}
        {success && (
          <NotificationBar color="success">저장되었습니다.</NotificationBar>
        )}

        <div>
          <label className="block text-sm font-medium text-site-text mb-1">
            관리자 알림 이메일 주소
          </label>
          <input
            type="email"
            value={form.adminEmail ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, adminEmail: e.target.value || null }))
            }
            className="w-full rounded-lg border border-site-border bg-white px-3 py-2.5 text-site-text placeholder-gray-400 focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
            placeholder="admin@example.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            참가 신청·입금 확인 등 관리자 알림을 받을 이메일입니다.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-site-border bg-site-card p-4">
          <h2 className="text-sm font-semibold text-site-text">
            알림 on/off
          </h2>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-site-text">
              참가 신청 접수 시 관리자 알림
            </span>
            <input
              type="checkbox"
              checked={form.notifyNewRegistration}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  notifyNewRegistration: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-site-border text-site-primary focus:ring-site-primary"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-site-text">
              참가자 신청 완료 이메일 발송
            </span>
            <input
              type="checkbox"
              checked={form.notifyRegistrationConfirmed}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  notifyRegistrationConfirmed: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-site-border text-site-primary focus:ring-site-primary"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-site-text">
              입금 확인 알림
            </span>
            <input
              type="checkbox"
              checked={form.notifyPaymentConfirmed}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  notifyPaymentConfirmed: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-site-border text-site-primary focus:ring-site-primary"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-site-text">
              공지사항 알림
            </span>
            <input
              type="checkbox"
              checked={form.notifyAnnouncement}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  notifyAnnouncement: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-site-border text-site-primary focus:ring-site-primary"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            label={saving ? "저장중" : "저장"}
            color="info"
            disabled={saving}
          />
          <Button href="/admin/settings" label="취소" color="contrast" outline />
        </div>
      </form>
      </CardBox>
    </SectionMain>
  );
}
