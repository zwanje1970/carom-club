"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MemberRow } from "@/app/api/admin/members/route";

const ROLE_TYPE_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "user", label: "일반회원" },
  { value: "client_general", label: "일반 클라이언트" },
  { value: "client_registered", label: "등록 클라이언트(연회원)" },
  { value: "admin", label: "관리자" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "active", label: "정상" },
  { value: "pending", label: "승인대기" },
  { value: "suspended", label: "정지" },
  { value: "withdrawn", label: "탈퇴" },
] as const;

const SORT_BY_OPTIONS = [
  { value: "createdAt", label: "날짜순" },
  { value: "name", label: "이름순" },
  { value: "role", label: "구분순" },
] as const;

const SORT_ORDER_OPTIONS = [
  { value: "desc", label: "내림차순" },
  { value: "asc", label: "오름차순" },
] as const;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function getRoleDisplayLabel(row: MemberRow): string {
  if (row.role === "PLATFORM_ADMIN") return "플랫폼 관리자";
  if (row.role === "ZONE_MANAGER") return "권역 관리자";
  if (row.role === "CLIENT_ADMIN") {
    if (row.orgClientType === "REGISTERED") return "등록 클라이언트(연회원)";
    return "일반 클라이언트";
  }
  return "일반회원";
}

function getStatusDisplayLabel(row: MemberRow): string {
  if (row.withdrawnAt) return "탈퇴";
  if (row.status === "SUSPENDED") return "정지";
  if (row.orgApprovalStatus === "PENDING" && row.role === "CLIENT_ADMIN") return "승인대기";
  if (row.orgStatus === "SUSPENDED") return "정지";
  return "정상";
}

function getDisplayName(row: MemberRow): string {
  const name = (row.name ?? "").trim();
  if (name) return name;
  return row.username?.trim() || row.email?.trim() || "-";
}

export function AdminMembersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manageRow, setManageRow] = useState<MemberRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const search = searchParams.get("search") ?? "";
  const roleType = searchParams.get("roleType") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder = searchParams.get("sortOrder") ?? "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.max(10, Math.min(100, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

  const setParams = useCallback(
    (updates: Record<string, string | number>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        const s = String(v);
        if (s === "" || s === "all" || (k === "page" && s === "1") || (k === "pageSize" && s === "20")) {
          next.delete(k);
        } else {
          next.set(k, s);
        }
      });
      router.push(`/admin/members?${next.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleType !== "all") params.set("roleType", roleType);
    if (status !== "all") params.set("status", status);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`/api/admin/members?${params.toString()}`)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error ?? "목록 조회 실패")));
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setTotal(Number(data.total) ?? 0);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "목록을 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, roleType, status, sortBy, sortOrder, page, pageSize, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortByLabel = SORT_BY_OPTIONS.find((o) => o.value === sortBy)?.label ?? "날짜순";
  const sortOrderLabel = SORT_ORDER_OPTIONS.find((o) => o.value === sortOrder)?.label ?? "내림차순";

  const handlePatch = useCallback(
    async (id: string, body: { role?: string; status?: string; orgClientType?: string; orgApprovalStatus?: string }) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/members/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          alert(data?.error ?? "저장에 실패했습니다.");
          return;
        }
        setManageRow(null);
        setRefreshKey((k) => k + 1);
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  return (
    <div className="space-y-4">
      {/* 검색 / 필터 / 정렬 — 상단, 모바일 2줄·아코디언 가능 */}
      <div className="flex flex-col gap-4 rounded-lg border border-site-border bg-site-bg/50 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-site-text-muted mb-1">검색 (이름·아이디·이메일)</label>
            <input
              type="search"
              placeholder="이름, 아이디 또는 이메일"
              value={search}
              onChange={(e) => setParams({ search: e.target.value, page: 1 })}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-site-text-muted mb-1">구분</label>
            <select
              value={roleType}
              onChange={(e) => setParams({ roleType: e.target.value, page: 1 })}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
            >
              {ROLE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-site-text-muted mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => setParams({ status: e.target.value, page: 1 })}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-site-text-muted">정렬</span>
          <select
            value={sortBy}
            onChange={(e) => setParams({ sortBy: e.target.value })}
            className="rounded border border-site-border bg-site-card px-3 py-1.5 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
          >
            {SORT_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setParams({ sortOrder: e.target.value })}
            className="rounded border border-site-border bg-site-card px-3 py-1.5 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
          >
            {SORT_ORDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-site-text-muted">
            현재: {sortByLabel} / {sortOrderLabel}
          </span>
          <button
            type="button"
            onClick={() => setParams({ status: "pending", page: 1 })}
            className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
          >
            승인대기만 보기
          </button>
          <span className="ml-auto text-xs text-site-text-muted">
            페이지당
            <select
              value={pageSize}
              onChange={(e) => setParams({ pageSize: e.target.value, page: 1 })}
              className="mx-1 rounded border border-site-border bg-site-card px-2 py-1 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            건
          </span>
        </div>
      </div>

      {loading && <p className="text-sm text-site-text-muted">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-lg border border-site-border bg-site-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
                  <th className="p-3 text-left font-medium text-site-text">이름</th>
                  <th className="p-3 text-left font-medium text-site-text">아이디 / 이메일</th>
                  <th className="p-3 text-left font-medium text-site-text">구분</th>
                  <th className="p-3 text-left font-medium text-site-text">상태</th>
                  <th className="p-3 text-left font-medium text-site-text">가입일</th>
                  <th className="p-3 text-left font-medium text-site-text">최근 수정일</th>
                  <th className="p-3 text-left font-medium text-site-text">관리</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-site-text-muted">
                      조건에 맞는 회원이 없습니다. 검색·필터를 바꿔 보세요.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-site-border last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="p-3 text-site-text">{getDisplayName(row)}</td>
                      <td className="p-3 text-site-text">
                        {row.username || "-"} {row.username && row.email ? " / " : ""} {row.email || ""}
                      </td>
                      <td className="p-3 text-site-text">{getRoleDisplayLabel(row)}</td>
                      <td className="p-3 text-site-text">{getStatusDisplayLabel(row)}</td>
                      <td className="p-3 text-site-text-muted">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString("ko-KR") : "-"}
                      </td>
                      <td className="p-3 text-site-text-muted">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString("ko-KR") : "-"}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setManageRow(row)}
                          className="rounded bg-site-primary/10 px-2.5 py-1.5 text-xs font-medium text-site-primary hover:bg-site-primary/20"
                        >
                          관리
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-site-text-muted">
                전체 {total}명 · {page} / {totalPages} 페이지
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setParams({ page: page - 1 })}
                  className="rounded border border-site-border bg-site-card px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setParams({ page: page + 1 })}
                  className="rounded border border-site-border bg-site-card px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {manageRow && (
            <ManageModal
              row={manageRow}
              onClose={() => setManageRow(null)}
              onSave={handlePatch}
              saving={saving}
            />
          )}
        </>
      )}
    </div>
  );
}

function ManageModal({
  row,
  onClose,
  onSave,
  saving,
}: {
  row: MemberRow;
  onClose: () => void;
  onSave: (id: string, body: Record<string, string>) => Promise<void>;
  saving: boolean;
}) {
  const [role, setRole] = useState(row.role);
  const [status, setStatus] = useState(row.withdrawnAt ? "DELETED" : row.status ?? "ACTIVE");
  const [orgClientType, setOrgClientType] = useState(row.orgClientType ?? "GENERAL");
  const [orgApprovalStatus, setOrgApprovalStatus] = useState(row.orgApprovalStatus ?? "APPROVED");
  const [confirmChange, setConfirmChange] = useState(false);

  const roleChanged = role !== row.role;
  const statusChanged = status !== (row.withdrawnAt ? "DELETED" : row.status ?? "ACTIVE");
  const orgChanged =
    row.role === "CLIENT_ADMIN" &&
    (orgClientType !== (row.orgClientType ?? "GENERAL") || orgApprovalStatus !== (row.orgApprovalStatus ?? "APPROVED"));
  const hasChanges = roleChanged || statusChanged || orgChanged;

  const handleSubmit = () => {
    if (hasChanges && !confirmChange) {
      setConfirmChange(true);
      return;
    }
    const body: Record<string, string> = {};
    if (roleChanged) body.role = role;
    if (statusChanged) body.status = status;
    if (orgChanged) {
      body.orgClientType = orgClientType;
      body.orgApprovalStatus = orgApprovalStatus;
    }
    if (Object.keys(body).length > 0) onSave(row.id, body);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-site-border bg-site-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-site-text mb-4">권한 · 상태 변경</h3>
        <p className="text-sm text-site-text-muted mb-4">
          {getDisplayName(row)} ({row.username})
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-site-text-muted mb-1">구분 (권한)</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
            >
              <option value="USER">일반회원</option>
              <option value="CLIENT_ADMIN">일반 클라이언트 / 등록 클라이언트</option>
              <option value="ZONE_MANAGER">권역 관리자</option>
              <option value="PLATFORM_ADMIN">플랫폼 관리자</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-site-text-muted mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
            >
              <option value="ACTIVE">정상</option>
              <option value="SUSPENDED">정지</option>
              <option value="DELETED">탈퇴</option>
            </select>
          </div>
          {role === "CLIENT_ADMIN" && (
            <>
              <div>
                <label className="block text-xs font-medium text-site-text-muted mb-1">클라이언트 등급</label>
                <select
                  value={orgClientType}
                  onChange={(e) => setOrgClientType(e.target.value)}
                  className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
                >
                  <option value="GENERAL">일반 클라이언트</option>
                  <option value="REGISTERED">등록 클라이언트(연회원)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-site-text-muted mb-1">승인 상태</label>
                <select
                  value={orgApprovalStatus}
                  onChange={(e) => setOrgApprovalStatus(e.target.value)}
                  className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
                >
                  <option value="PENDING">승인대기</option>
                  <option value="APPROVED">승인</option>
                  <option value="REJECTED">반려</option>
                </select>
              </div>
            </>
          )}
        </div>

        {hasChanges && confirmChange && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
            변경 내용을 적용하시겠습니까? 잘못 변경하면 서비스 이용에 영향을 줄 수 있습니다.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-site-border px-4 py-2 text-sm font-medium text-site-text hover:bg-site-bg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || (!hasChanges && !confirmChange)}
            className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "저장 중..." : hasChanges && !confirmChange ? "변경 확인" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
