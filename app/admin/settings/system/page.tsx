"use client";

import { useState } from "react";
import { mdiCogRefresh } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

export default function AdminSettingsSystemPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [path, setPath] = useState("/");

  const run = async (action: "revalidate_all" | "revalidate_path", pathValue?: string) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, path: pathValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "실패");
        return;
      }
      setSuccess(action === "revalidate_all" ? `캐시 재검증 완료 (${data.revalidated ?? 0} 경로)` : `경로 재검증: ${data.revalidated ?? pathValue}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("요청 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCogRefresh} title="시스템 관리" />

      <CardBox>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
          Next.js 캐시를 초기화하거나 특정 경로를 재검증합니다. 설정 변경 후 화면이 반영되지 않을 때 사용하세요.
        </p>
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm mb-1">경로 재검증</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/ 또는 /community"
                className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 w-48 text-site-text"
              />
              <Button
                label="해당 경로만 재검증"
                color="info"
                onClick={() => run("revalidate_path", path)}
                disabled={loading}
              />
            </div>
          </div>
          <Button
            label="전체 주요 경로 캐시 초기화"
            color="info"
            onClick={() => run("revalidate_all")}
            disabled={loading}
          />
          {error && <NotificationBar color="danger">{error}</NotificationBar>}
          {success && <NotificationBar color="success">{success}</NotificationBar>}
        </div>
        <p className="mt-2 text-xs text-gray-500">전체 초기화 시 /, /tournaments, /venues, /community, /mypage, /notice, /login, /signup 이 재검증됩니다.</p>
      </CardBox>
    </SectionMain>
  );
}
