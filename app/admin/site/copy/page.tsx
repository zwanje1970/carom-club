"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { mdiFormatListBulleted } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { ADMIN_COPY_GROUPS, DEFAULT_ADMIN_COPY } from "@/lib/admin-copy";
import type { AdminCopyKey } from "@/lib/admin-copy";

type SystemTextItem = {
  id: string;
  key: string;
  group: string;
  label: string;
  description: string | null;
  value: string | null;
  defaultValue: string | null;
  isEnabled: boolean;
  updatedAt: string;
};

type Row =
  | { type: "admin_copy"; key: string; group: string; label: string; value: string; defaultValue: string }
  | { type: "system_text"; id: string; key: string; group: string; label: string; value: string; defaultValue: string | null; isEnabled: boolean };

function matchSearch(row: Row, search: string): boolean {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  return (
    row.key.toLowerCase().includes(q) ||
    row.group.toLowerCase().includes(q) ||
    (row.label ?? "").toLowerCase().includes(q) ||
    (row.value ?? "").toLowerCase().includes(q) ||
    (row.defaultValue ?? "").toLowerCase().includes(q)
  );
}

export default function AdminSiteCopyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copy, setCopy] = useState<Record<string, string>>({ ...DEFAULT_ADMIN_COPY });
  const [systemTextItems, setSystemTextItems] = useState<SystemTextItem[]>([]);
  const [bulkFind, setBulkFind] = useState("");
  const [bulkReplace, setBulkReplace] = useState("");
  const [editSystemTextId, setEditSystemTextId] = useState<string | null>(null);
  const [editSystemTextValue, setEditSystemTextValue] = useState("");
  const [editSystemTextEnabled, setEditSystemTextEnabled] = useState(true);
  const [systemTextBulkFind, setSystemTextBulkFind] = useState("");
  const [systemTextBulkReplace, setSystemTextBulkReplace] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/copy").then((r) => r.json()),
      fetch("/api/admin/system-text").then((r) => r.json()),
    ])
      .then(([copyData, stData]) => {
        if (copyData && typeof copyData === "object" && !copyData.error) {
          setCopy({ ...DEFAULT_ADMIN_COPY, ...copyData });
        }
        setSystemTextItems(Array.isArray(stData?.items) ? stData.items : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadSystemText = () => {
    fetch("/api/admin/system-text")
      .then((r) => r.json())
      .then((data) => setSystemTextItems(Array.isArray(data?.items) ? data.items : []));
  };

  const rows: Row[] = useMemo(() => {
    const adminRows: Row[] = [];
    for (const { group, keys } of ADMIN_COPY_GROUPS) {
      for (const key of keys) {
        const k = key as AdminCopyKey;
        adminRows.push({
          type: "admin_copy",
          key: k,
          group,
          label: k,
          value: copy[k] ?? DEFAULT_ADMIN_COPY[k] ?? "",
          defaultValue: DEFAULT_ADMIN_COPY[k] ?? "",
        });
      }
    }
    const stRows: Row[] = systemTextItems.map((item) => ({
      type: "system_text",
      id: item.id,
      key: item.key,
      group: item.group,
      label: item.label,
      value: item.value ?? item.defaultValue ?? "",
      defaultValue: item.defaultValue,
      isEnabled: item.isEnabled,
    }));
    return [...adminRows, ...stRows];
  }, [copy, systemTextItems]);

  const filteredRows = useMemo(() => rows.filter((r) => matchSearch(r, searchQuery)), [rows, searchQuery]);

  const handleCopyChange = (key: string, value: string) => {
    setCopy((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveCopy = async () => {
    setError("");
    setSuccess("");
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
      setSuccess("메뉴·문구가 저장되었습니다.");
      if (data && typeof data === "object") setCopy(data);
      setTimeout(() => setSuccess(""), 2500);
      router.refresh();
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetCopy = () => {
    setCopy({ ...DEFAULT_ADMIN_COPY });
    setSuccess("기본값으로 되돌렸습니다. 저장 버튼을 누르면 반영됩니다.");
    setTimeout(() => setSuccess(""), 2500);
  };

  const handleBulkReplaceCopy = () => {
    const find = bulkFind.trim();
    if (!find) return;
    const replace = bulkReplace;
    setCopy((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        const val = next[key] ?? DEFAULT_ADMIN_COPY[key] ?? "";
        if (val.includes(find)) next[key] = val.split(find).join(replace);
      }
      return next;
    });
    setBulkFind("");
    setBulkReplace("");
    setSuccess("일괄 치환 적용됨. 저장 버튼을 누르면 반영됩니다.");
    setTimeout(() => setSuccess(""), 2500);
  };

  const openEditSystemText = (item: SystemTextItem) => {
    setEditSystemTextId(item.id);
    setEditSystemTextValue(item.value ?? item.defaultValue ?? "");
    setEditSystemTextEnabled(item.isEnabled);
  };

  const saveEditSystemText = async () => {
    if (!editSystemTextId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/system-text/${editSystemTextId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: editSystemTextValue, isEnabled: editSystemTextEnabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장 실패");
        return;
      }
      setSuccess("저장되었습니다.");
      setEditSystemTextId(null);
      loadSystemText();
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const doSystemTextAction = async (id: string, action: "clear" | "reset_default") => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/system-text/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "실패");
        return;
      }
      setSuccess(action === "clear" ? "비움" : "기본값 복원");
      setEditSystemTextId(null);
      loadSystemText();
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("실패");
    } finally {
      setSaving(false);
    }
  };

  const handleSystemTextBulkReplace = async () => {
    if (!systemTextBulkFind.trim()) {
      setError("찾을 문자열을 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/system-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ find: systemTextBulkFind, replace: systemTextBulkReplace }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "실패");
        return;
      }
      setSuccess(`${data.updatedCount ?? 0}건 치환되었습니다.`);
      setSystemTextBulkFind("");
      setSystemTextBulkReplace("");
      loadSystemText();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("실패");
    } finally {
      setSaving(false);
    }
  };

  const handleResetAllSystemText = async () => {
    if (!confirm("고정 문구를 모두 기본값으로 초기화할까요?")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/system-text/reset-defaults", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "실패");
        return;
      }
      setSuccess(`${data.resetCount ?? 0}건 초기화되었습니다.`);
      loadSystemText();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("실패");
    } finally {
      setSaving(false);
    }
  };

  const handleSeedSystemText = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/system-text/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "실패");
        return;
      }
      setSuccess(`기본 키 ${data.created ?? 0}개 생성되었습니다.`);
      loadSystemText();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("실패");
    } finally {
      setSaving(false);
    }
  };

  const currentSystemText = editSystemTextId ? systemTextItems.find((i) => i.id === editSystemTextId) : null;
  const hasCopyChanges = useMemo(() => {
    for (const k of Object.keys(DEFAULT_ADMIN_COPY)) {
      const current = copy[k];
      const def = DEFAULT_ADMIN_COPY[k];
      if ((current ?? "") !== (def ?? "")) return true;
    }
    return false;
  }, [copy]);

  if (loading) {
    return (
      <SectionMain>
        <p className="mb-4 text-sm">
          <Link href="/admin/site/main" className="text-site-primary hover:underline">
            ← 메인페이지 구성
          </Link>
        </p>
        <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="고정문구 · 페이지별 문구" />
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin/site/main" className="text-site-primary hover:underline">
          ← 메인페이지 구성
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="고정문구 · 페이지별 문구" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        <strong>페이지별 문구(메뉴·문구)</strong>와 <strong>고정문구</strong>를 한 화면에서 검색·수정합니다. 메뉴명·버튼·페이지 제목·에러 안내 등은 파란 유형 행에서 일괄 저장하고, 고정문구는 행별 수정·시드·치환 도구를 사용하세요.
      </p>

      <CardBox className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">검색 (키·그룹·라벨·문구)</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="키 또는 문구로 검색"
          className="w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 text-site-text placeholder:text-gray-400"
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          {filteredRows.length}개 문구 표시 (전체 {rows.length}개)
        </p>
      </CardBox>

      <CardBox className="mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">일괄 변경 (메뉴·문구)</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="text"
            value={bulkFind}
            onChange={(e) => setBulkFind(e.target.value)}
            placeholder="찾을 문자열"
            className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 w-48 text-site-text"
          />
          <input
            type="text"
            value={bulkReplace}
            onChange={(e) => setBulkReplace(e.target.value)}
            placeholder="바꿀 문자열"
            className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 w-48 text-site-text"
          />
          <Button label="치환 적용" color="info" onClick={handleBulkReplaceCopy} disabled={!bulkFind.trim()} />
        </div>
      </CardBox>

      <CardBox className="mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">고정 문구 도구</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <Button label="기본 키 시드" color="contrast" outline onClick={handleSeedSystemText} disabled={saving} />
          <Button label="전체 기본값 초기화" color="danger" outline onClick={handleResetAllSystemText} disabled={saving} />
          <span className="text-gray-500 dark:text-slate-400 text-sm">|</span>
          <input
            type="text"
            value={systemTextBulkFind}
            onChange={(e) => setSystemTextBulkFind(e.target.value)}
            placeholder="찾을 문자열"
            className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 w-40 text-site-text text-sm"
          />
          <input
            type="text"
            value={systemTextBulkReplace}
            onChange={(e) => setSystemTextBulkReplace(e.target.value)}
            placeholder="바꿀 문자열"
            className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 w-40 text-site-text text-sm"
          />
          <Button label="고정문구 치환" color="info" small onClick={handleSystemTextBulkReplace} disabled={saving || !systemTextBulkFind.trim()} />
        </div>
      </CardBox>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button
          label={saving ? "저장 중…" : "메뉴·문구 일괄 저장"}
          color="info"
          onClick={handleSaveCopy}
          disabled={saving || !hasCopyChanges}
        />
        <Button label="기본값으로 되돌리기" color="contrast" outline onClick={handleResetCopy} disabled={saving} />
        {error && <NotificationBar color="danger">{error}</NotificationBar>}
        {success && <NotificationBar color="success">{success}</NotificationBar>}
      </div>

      <CardBox>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-site-border">
                <th className="text-left p-2 w-24">유형</th>
                <th className="text-left p-2 w-28">그룹</th>
                <th className="text-left p-2 font-mono">키</th>
                <th className="text-left p-2">현재 문구</th>
                <th className="text-left p-2 max-w-[200px]">기본값</th>
                <th className="p-2 w-40">동작</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.type === "admin_copy" ? row.key : row.id} className="border-b border-site-border/50 align-top">
                  <td className="p-2">
                    <span className={row.type === "admin_copy" ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}>
                      {row.type === "admin_copy" ? "메뉴·문구" : "고정문구"}
                    </span>
                  </td>
                  <td className="p-2 text-gray-600 dark:text-slate-400">{row.group}</td>
                  <td className="p-2 font-mono text-xs break-all">{row.key}</td>
                  <td className="p-2">
                    {row.type === "admin_copy" ? (
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => handleCopyChange(row.key, e.target.value)}
                        className="w-full max-w-md rounded border border-site-border bg-white dark:bg-slate-800 px-2 py-1 text-site-text text-sm"
                        placeholder={row.defaultValue || "비움"}
                      />
                    ) : (
                      <span className="block max-w-md truncate" title={row.value}>
                        {row.value || "(비움)"}
                      </span>
                    )}
                  </td>
                  <td className="p-2 max-w-[200px] truncate text-gray-500 dark:text-slate-400" title={row.defaultValue ?? ""}>
                    {row.defaultValue ?? "—"}
                  </td>
                  <td className="p-2">
                    {row.type === "admin_copy" ? (
                      <span className="text-gray-400 text-xs">저장 버튼으로 일괄 저장</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditSystemText(systemTextItems.find((i) => i.id === row.id)!)}
                          className="text-site-primary hover:underline mr-2"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => doSystemTextAction(row.id, "clear")}
                          className="text-gray-500 hover:underline mr-2"
                        >
                          비우기
                        </button>
                        <button
                          type="button"
                          onClick={() => doSystemTextAction(row.id, "reset_default")}
                          className="text-gray-500 hover:underline"
                        >
                          기본복원
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <p className="p-4 text-gray-500 dark:text-slate-400">
              {searchQuery.trim() ? "검색 결과가 없습니다." : "문구가 없습니다. 고정 문구는 기본 키 시드를 실행하세요."}
            </p>
          )}
        </div>
      </CardBox>

      {currentSystemText && editSystemTextId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-4">
            <h3 className="font-semibold mb-2">{currentSystemText.label} ({currentSystemText.key})</h3>
            <textarea
              value={editSystemTextValue}
              onChange={(e) => setEditSystemTextValue(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 text-site-text mb-2"
            />
            <label className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={editSystemTextEnabled} onChange={(e) => setEditSystemTextEnabled(e.target.checked)} />
              <span>사용 (OFF 시 문구 숨김)</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button label="저장" color="info" onClick={saveEditSystemText} disabled={saving} />
              <Button label="취소" color="contrast" outline onClick={() => setEditSystemTextId(null)} />
            </div>
          </div>
        </div>
      )}
    </SectionMain>
  );
}
