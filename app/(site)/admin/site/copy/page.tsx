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
  const tokens = search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const haystack = [
    row.key.toLowerCase(),
    row.group.toLowerCase(),
    (row.label ?? "").toLowerCase(),
    (row.value ?? "").toLowerCase(),
    (row.defaultValue ?? "").toLowerCase(),
  ].join(" ");
  return tokens.every((token) => haystack.includes(token));
}

function keyScope(key: string): string {
  const idx = key.lastIndexOf(".");
  return idx > 0 ? key.slice(0, idx) : key;
}

export default function AdminSiteCopyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  /** 레거시 히어로(구 copy 키) — 기본 숨김, 히어로 설정이 정본 */
  const [showLegacyHeroKeys, setShowLegacyHeroKeys] = useState(false);
  const [copy, setCopy] = useState<Record<string, string>>({ ...DEFAULT_ADMIN_COPY });
  const [baselineCopy, setBaselineCopy] = useState<Record<string, string>>({ ...DEFAULT_ADMIN_COPY });
  const [systemTextItems, setSystemTextItems] = useState<SystemTextItem[]>([]);
  const [bulkFind, setBulkFind] = useState("");
  const [bulkReplace, setBulkReplace] = useState("");
  const [editSystemTextId, setEditSystemTextId] = useState<string | null>(null);
  const [editSystemTextValue, setEditSystemTextValue] = useState("");
  const [editSystemTextEnabled, setEditSystemTextEnabled] = useState(true);
  const [systemTextBulkFind, setSystemTextBulkFind] = useState("");
  const [systemTextBulkReplace, setSystemTextBulkReplace] = useState("");
  const [selectedCopyKey, setSelectedCopyKey] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileStep, setMobileStep] = useState<"search" | "list" | "edit" | "confirm">("search");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/copy").then((r) => r.json()),
      fetch("/api/admin/system-text").then((r) => r.json()),
    ])
      .then(([copyData, stData]) => {
        if (copyData && typeof copyData === "object" && !copyData.error) {
          const merged = { ...DEFAULT_ADMIN_COPY, ...copyData };
          setCopy(merged);
          setBaselineCopy(merged);
        }
        setSystemTextItems(Array.isArray(stData?.items) ? stData.items : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
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

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!showLegacyHeroKeys && r.type === "admin_copy" && r.key.startsWith("site.hero.")) {
        return false;
      }
      return matchSearch(r, searchQuery);
    });
  }, [rows, searchQuery, showLegacyHeroKeys]);

  const copyRows = useMemo(
    () => filteredRows.filter((r): r is Extract<Row, { type: "admin_copy" }> => r.type === "admin_copy"),
    [filteredRows]
  );

  const selectedCopyRow = useMemo(
    () => copyRows.find((r) => r.key === selectedCopyKey) ?? null,
    [copyRows, selectedCopyKey]
  );

  const relatedCopyRows = useMemo(() => {
    if (!selectedCopyRow) return [];
    const scope = keyScope(selectedCopyRow.key);
    return copyRows
      .filter((r) => r.key !== selectedCopyRow.key)
      .filter((r) => keyScope(r.key) === scope || r.group === selectedCopyRow.group)
      .slice(0, 8);
  }, [copyRows, selectedCopyRow]);

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
      if (data && typeof data === "object") {
        const next = { ...DEFAULT_ADMIN_COPY, ...data };
        setCopy(next);
        setBaselineCopy(next);
      }
      setTimeout(() => setSuccess(""), 2500);
      router.refresh();
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetCopy = () => {
    setCopy({ ...baselineCopy });
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
    for (const k of Object.keys(copy)) {
      const current = copy[k];
      const def = baselineCopy[k] ?? DEFAULT_ADMIN_COPY[k];
      if ((current ?? "") !== (def ?? "")) return true;
    }
    return false;
  }, [copy, baselineCopy]);

  useEffect(() => {
    if (!selectedCopyKey && copyRows.length > 0) setSelectedCopyKey(copyRows[0].key);
    if (selectedCopyKey && !copyRows.some((r) => r.key === selectedCopyKey)) {
      setSelectedCopyKey(copyRows[0]?.key ?? null);
    }
  }, [copyRows, selectedCopyKey]);

  if (loading) {
    return (
      <SectionMain>
        <p className="mb-4 text-sm">
          <Link href="/admin/page-builder" className="text-site-primary hover:underline">
            ← 페이지 빌더
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
        <Link href="/admin" className="text-site-primary hover:underline">
          ← 관리자 홈
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="문구 관리" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
        메뉴명·페이지 안내·버튼 문구·상태 메시지 등 <strong>사이트 운영 문구</strong>를 다룹니다. 콘텐츠 본문·섹션 데이터는{" "}
        <Link href="/admin/page-builder" className="text-site-primary underline font-medium">
          페이지 빌더
        </Link>
        가 정본입니다. 아래 목록에서 일괄 저장(메뉴·문구) 또는 고정문구 행 편집을 사용하세요.
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
        <label className="mt-3 flex items-center gap-2 text-sm text-site-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showLegacyHeroKeys}
            onChange={(e) => setShowLegacyHeroKeys(e.target.checked)}
            className="rounded border-site-border"
          />
          <span>
            레거시 히어로 문구 키(<code className="text-xs bg-gray-100 dark:bg-slate-700 px-1 rounded">site.hero.*</code>) 표시
          </span>
        </label>
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          {filteredRows.length}개 문구 표시 (전체 {rows.length}개, 부분 검색 지원)
        </p>
      </CardBox>

      {selectedCopyRow ? (
        <CardBox className="mb-6">
          <h3 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">선택 문구 정보</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            위치: <strong>{selectedCopyRow.group}</strong> &gt; <code>{selectedCopyRow.key}</code>
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-site-border p-2">
              <p className="mb-1 text-xs text-gray-500">수정 전</p>
              <p className="text-sm text-site-text break-words">{baselineCopy[selectedCopyRow.key] ?? ""}</p>
            </div>
            <div className="rounded border border-site-border p-2">
              <p className="mb-1 text-xs text-gray-500">수정 후</p>
              <p className="text-sm text-site-text break-words">{copy[selectedCopyRow.key] ?? ""}</p>
            </div>
          </div>
          {relatedCopyRows.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs text-gray-500">연관 문구</p>
              <div className="flex flex-wrap gap-1">
                {relatedCopyRows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    className="rounded border border-site-border px-2 py-1 text-xs text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
                    onClick={() => setSelectedCopyKey(row.key)}
                  >
                    {row.key}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </CardBox>
      ) : null}

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
        {isMobile ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1 rounded border border-site-border p-1 text-xs">
              <button type="button" className={`rounded px-2 py-1 ${mobileStep === "search" ? "bg-site-primary text-white" : ""}`} onClick={() => setMobileStep("search")}>검색</button>
              <button type="button" className={`rounded px-2 py-1 ${mobileStep === "list" ? "bg-site-primary text-white" : ""}`} onClick={() => setMobileStep("list")}>목록</button>
              <button type="button" className={`rounded px-2 py-1 ${mobileStep === "edit" ? "bg-site-primary text-white" : ""}`} onClick={() => setMobileStep("edit")} disabled={!selectedCopyRow}>편집</button>
              <button type="button" className={`rounded px-2 py-1 ${mobileStep === "confirm" ? "bg-site-primary text-white" : ""}`} onClick={() => setMobileStep("confirm")}>확인</button>
            </div>

            {mobileStep === "search" ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="부분 검색 (예: tournament status)"
                  className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                />
                <Button label="목록 보기" color="info" small onClick={() => setMobileStep("list")} />
              </div>
            ) : null}

            {mobileStep === "list" ? (
              <div className="space-y-2">
                {copyRows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    className="w-full rounded border border-site-border p-3 text-left"
                    onClick={() => {
                      setSelectedCopyKey(row.key);
                      setMobileStep("edit");
                    }}
                  >
                    <p className="text-xs text-gray-500">{row.group}</p>
                    <p className="text-xs font-mono text-gray-500">{row.key}</p>
                    <p className="mt-1 text-sm text-site-text">{row.value || "(비움)"}</p>
                  </button>
                ))}
              </div>
            ) : null}

            {mobileStep === "edit" && selectedCopyRow ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">위치: {selectedCopyRow.group} &gt; {selectedCopyRow.key}</p>
                <input
                  type="text"
                  value={copy[selectedCopyRow.key] ?? ""}
                  onChange={(e) => handleCopyChange(selectedCopyRow.key, e.target.value)}
                  className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                />
                <Button label="확인 단계로" color="info" small onClick={() => setMobileStep("confirm")} />
              </div>
            ) : null}

            {mobileStep === "confirm" ? (
              <div className="space-y-2">
                <p className="text-sm text-site-text">변경된 문구 {hasCopyChanges ? "있음" : "없음"}</p>
                {selectedCopyRow ? (
                  <div className="grid gap-2">
                    <div className="rounded border border-site-border p-2">
                      <p className="text-xs text-gray-500">수정 전</p>
                      <p className="text-sm">{baselineCopy[selectedCopyRow.key] ?? ""}</p>
                    </div>
                    <div className="rounded border border-site-border p-2">
                      <p className="text-xs text-gray-500">수정 후</p>
                      <p className="text-sm">{copy[selectedCopyRow.key] ?? ""}</p>
                    </div>
                  </div>
                ) : null}
                <Button label={saving ? "저장 중…" : "저장"} color="info" small disabled={saving || !hasCopyChanges} onClick={() => void handleSaveCopy()} />
              </div>
            ) : null}
          </div>
        ) : (
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
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) => handleCopyChange(row.key, e.target.value)}
                          onFocus={() => setSelectedCopyKey(row.key)}
                          className="w-full max-w-md rounded border border-site-border bg-white dark:bg-slate-800 px-2 py-1 text-site-text text-sm"
                          placeholder={row.defaultValue || "비움"}
                        />
                        <p className="text-[11px] text-gray-500">위치: {row.group} &gt; {row.key}</p>
                      </div>
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
        )}
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
