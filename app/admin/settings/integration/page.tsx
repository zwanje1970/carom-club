"use client";

import { useState, useEffect } from "react";
import { mdiCog } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import PillTag from "@/components/admin/_components/PillTag";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type IntegrationStatus = {
  naverMapConfigured: boolean;
};

export default function AdminSettingsIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [naverMapInput, setNaverMapInput] = useState("");

  const loadStatus = () => {
    fetch("/api/admin/integration-status")
      .then((res) => {
        if (!res.ok) throw new Error("불러오기 실패");
        return res.json();
      })
      .then((data: IntegrationStatus) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSaveNaverMap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/integration-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naverMapClientId: naverMapInput.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "저장에 실패했습니다.");
        return;
      }
      setNaverMapInput("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      loadStatus();
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCog} title="연동 설정" />
      <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
        API·외부 서비스 연동을 설정합니다. 저장된 키 값은 화면에 표시되지 않습니다.
      </p>

      {loading ? (
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      ) : (
        <CardBox className="max-w-xl">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              네이버 지도
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              당구장 소개·오시는 길 페이지에서 지도 표시, 주소·위도·경도·길찾기
              링크 등에 사용됩니다. 네이버 클라우드 플랫폼에서 JavaScript API
              클라이언트 ID를 발급받아 아래에 입력 후 저장하세요.
            </p>

            <div className="flex items-center justify-between gap-4 mb-4">
              <span className="text-sm text-gray-700 dark:text-slate-300">현재 설정 상태</span>
              {status?.naverMapConfigured ? (
                <PillTag color="success" label="설정됨" small />
              ) : (
                <PillTag color="light" label="미설정" small />
              )}
            </div>

            <form onSubmit={handleSaveNaverMap} className="space-y-3">
              {error && (
                <NotificationBar color="danger">{error}</NotificationBar>
              )}
              {success && (
                <NotificationBar color="success">저장되었습니다.</NotificationBar>
              )}
              <div>
                <label className="block text-sm font-medium text-site-text mb-1">
                  네이버 지도 클라이언트 ID (NAVER_MAP_CLIENT_ID)
                </label>
                <input
                  type="password"
                  value={naverMapInput}
                  onChange={(e) => setNaverMapInput(e.target.value)}
                  className="w-full rounded-lg border border-site-border bg-white px-3 py-2.5 text-site-text placeholder-gray-400 focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
                  placeholder="설정하거나 변경하려면 입력 후 저장 (저장된 값은 표시되지 않음)"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-gray-500">
                  비워두고 저장하면 저장된 키를 삭제합니다. 환경변수
                  NAVER_MAP_CLIENT_ID가 있으면 DB에 없을 때 그 값을 사용합니다.
                </p>
              </div>
              <Button
                type="submit"
                label={saving ? "저장중" : "저장"}
                color="info"
                small
                disabled={saving}
              />
            </form>
          </section>
        </CardBox>
      )}
    </SectionMain>
  );
}
