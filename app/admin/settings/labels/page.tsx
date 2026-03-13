"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { mdiFormatListBulleted } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import FormField from "@/components/admin/_components/FormField";
import Buttons from "@/components/admin/_components/Buttons";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { ADMIN_COPY_GROUPS, DEFAULT_ADMIN_COPY } from "@/lib/admin-copy";

export default function AdminSettingsLabelsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copy, setCopy] = useState<Record<string, string>>({ ...DEFAULT_ADMIN_COPY });

  useEffect(() => {
    fetch("/api/admin/copy")
      .then((res) => res.json())
      .then((data: Record<string, string>) => {
        if (data && typeof data === "object" && !data.error) {
          setCopy({ ...DEFAULT_ADMIN_COPY, ...data });
        }
      })
      .catch(() => setCopy({ ...DEFAULT_ADMIN_COPY }))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setCopy((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/copy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copy }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다.");
        return;
      }
      setSuccess(true);
      if (data && typeof data === "object") setCopy(data);
      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 2000);
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCopy({ ...DEFAULT_ADMIN_COPY });
  };

  if (loading) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="메뉴/문구" />
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="메뉴/문구" />

      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        관리자 화면의 메뉴명·버튼 문구를 수정할 수 있습니다. 저장 후 새로고침하면 반영됩니다.
      </p>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-6">
            <NotificationBar color="danger">{error}</NotificationBar>
          </div>
        )}
        {success && (
          <div className="mb-6">
            <NotificationBar color="success">저장되었습니다.</NotificationBar>
          </div>
        )}

        {ADMIN_COPY_GROUPS.map(({ group, keys }) => (
          <CardBox key={group} className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-slate-100">
              {group}
            </h2>
            <div className="space-y-4">
              {keys.map((key) => (
                <FormField
                  key={key}
                  label={key}
                  labelFor={`copy-${key}`}
                  help={`기본값: ${DEFAULT_ADMIN_COPY[key] ?? ""}`}
                >
                  {({ className }) => (
                    <input
                      id={`copy-${key}`}
                      type="text"
                      value={copy[key] ?? ""}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className={className}
                      placeholder={DEFAULT_ADMIN_COPY[key]}
                    />
                  )}
                </FormField>
              ))}
            </div>
          </CardBox>
        ))}

        <Buttons>
          <Button
            type="submit"
            label={saving ? "저장중" : "저장"}
            color="info"
            disabled={saving}
          />
          <Button type="button" label="기본값으로 되돌리기" color="contrast" outline onClick={handleReset} />
        </Buttons>
      </form>
    </SectionMain>
  );
}
