"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MemberRow } from "@/app/api/admin/members/route";
import { formatKoreanDate } from "@/lib/format-date";

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
const CATEGORY_LABELS: Record<string, string> = {
  community: "커뮤니티",
  solver: "난구해결사",
  note: "당구노트",
  admin: "운영자",
};

const ROLE_ORDER: Record<string, number> = {
  PLATFORM_ADMIN: 0,
  CLIENT_ADMIN: 1,
  ZONE_MANAGER: 2,
  USER: 3,
};

type RoleSummary = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
};

type PermissionItem = {
  id: string;
  key: string;
  label: string;
  category: string;
  description?: string | null;
};

type SolverRankingRow = {
  rank: number;
  userId: string;
  name: string;
  username: string;
  currentRoleLabel: string | null;
  suggestedRoleLabel: string;
  solutionCount: number;
  acceptedCount: number;
  goodCount: number;
  activityPoint: number;
};

type UserActivityPointItem = {
  id: string;
  type: string;
  points: number;
  refType: string | null;
  refId: string | null;
  description: string | null;
  createdAt: string;
};

async function readJsonSafely<T>(res: Response): Promise<T | Record<string, never>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as T;
  } catch {
    return {};
  }
}

function sortRolesByPriority(roles: RoleSummary[]): RoleSummary[] {
  return [...roles].sort((a, b) => {
    const aKey = a.key;
    const bKey = b.key;
    return (ROLE_ORDER[aKey] ?? 999) - (ROLE_ORDER[bKey] ?? 999);
  });
}

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

function getResolvedRoleLabel(row: MemberRow): string {
  return row.rbacRoleLabel?.trim() || getRoleDisplayLabel(row);
}

function getCommunityLevelLabel(row: MemberRow): string {
  const level = row.communityLevel ?? 1;
  const tierName = row.communityTierName?.trim();
  return tierName ? `${level} (${tierName})` : String(level);
}

function getPermissionDisplayLabel(permission: PermissionItem): string {
  return permission.label?.trim() || permission.description?.trim() || permission.key;
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
  const [flashMessage, setFlashMessage] = useState("");
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionLoadError, setPermissionLoadError] = useState("");
  const [permissionMessage, setPermissionMessage] = useState("");
  const [ranking, setRanking] = useState<SolverRankingRow[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState("");

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
      .then(async (res) => {
        const data = (await readJsonSafely<{ items?: MemberRow[]; total?: number; error?: string }>(res)) as {
          items?: MemberRow[];
          total?: number;
          error?: string;
        };
        if (!res.ok) {
          return Promise.reject(new Error(data.error ?? "목록 조회 실패"));
        }
        return data;
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

  useEffect(() => {
    let cancelled = false;
    setRolesLoading(true);
    setRolesError("");
    fetch("/api/admin/rbac/roles")
      .then(async (res) => {
        const data = (await readJsonSafely<{ data?: RoleSummary[]; error?: string }>(res)) as {
          data?: RoleSummary[];
          error?: string;
        };
        if (!res.ok) {
          return Promise.reject(new Error(data.error ?? "레벨 조회 실패"));
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const nextRoles = sortRolesByPriority(Array.isArray(data.data) ? (data.data as RoleSummary[]) : []);
        setRoles(nextRoles);
        setSelectedRoleId((prev) => prev || nextRoles[0]?.id || "");
      })
      .catch((err) => {
        if (!cancelled) setRolesError(err.message ?? "레벨 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRoleId) return;
    let cancelled = false;
    setPermissionsLoading(true);
    setPermissionLoadError("");
    fetch(`/api/admin/rbac/roles/${selectedRoleId}/permissions`)
      .then(async (res) => {
        const data = (await readJsonSafely<{
          data?: PermissionItem[];
          permissionKeys?: string[];
          allPermissions?: PermissionItem[];
          error?: string;
        }>(res)) as {
          data?: PermissionItem[];
          permissionKeys?: string[];
          allPermissions?: PermissionItem[];
          error?: string;
        };
        if (!res.ok) {
          return Promise.reject(new Error(data.error ?? "권한 목록 조회 실패"));
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setPermissionLoadError("");
        setSelectedPermissionKeys(Array.isArray(data.permissionKeys) ? data.permissionKeys : []);
        setAllPermissions(
          Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.allPermissions)
              ? data.allPermissions
              : []
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setPermissionLoadError(err.message ?? "권한 목록을 불러올 수 없습니다.");
          setSelectedPermissionKeys([]);
          setAllPermissions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRoleId]);

  useEffect(() => {
    let cancelled = false;
    setRankingLoading(true);
    setRankingError("");
    fetch("/api/admin/rbac/solver-ranking?take=10")
      .then(async (res) => {
        const data = (await readJsonSafely<{ data?: SolverRankingRow[]; error?: string }>(res)) as {
          data?: SolverRankingRow[];
          error?: string;
        };
        if (!res.ok) {
          return Promise.reject(new Error(data.error ?? "랭킹 조회 실패"));
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setRanking(Array.isArray(data.data) ? (data.data as SolverRankingRow[]) : []);
        }
      })
      .catch((err) => {
        if (!cancelled) setRankingError(err.message ?? "랭킹 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setRankingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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
          throw new Error(data?.error ?? "저장에 실패했습니다.");
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

  const handleRoleAssignment = useCallback(
    async (userId: string, body: { targetRoleId?: string; roleManualLocked?: boolean }) => {
      const res = await fetch(`/api/admin/rbac/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "레벨 저장에 실패했습니다.");
      }
    },
    []
  );

  const togglePermission = useCallback((permissionKey: string) => {
    setSelectedPermissionKeys((prev) =>
      prev.includes(permissionKey)
        ? prev.filter((key) => key !== permissionKey)
        : [...prev, permissionKey]
    );
  }, []);

  const handleSavePermissions = useCallback(async () => {
    if (!selectedRoleId) return;
    const selectedRole = roles.find((role) => role.id === selectedRoleId);
    if (selectedRole?.key === "ADMIN") {
      const confirmed = window.confirm("ADMIN 권한을 변경하면 관리자 기능에 직접 영향을 줄 수 있습니다. 계속하시겠습니까?");
      if (!confirmed) return;
    }

    setPermissionSaving(true);
    setPermissionMessage("");
    try {
      const res = await fetch(`/api/admin/rbac/roles/${selectedRoleId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: selectedPermissionKeys }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; permissionKeys?: string[] };
      if (!res.ok) {
        setPermissionMessage(data.error ?? "권한 저장에 실패했습니다.");
        return;
      }
      setPermissionMessage("권한이 저장되었습니다.");
    } finally {
      setPermissionSaving(false);
    }
  }, [roles, selectedPermissionKeys, selectedRoleId]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const permissionsByCategory = allPermissions.reduce<Record<string, PermissionItem[]>>((acc, permission) => {
    const category = permission.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(permission);
    return acc;
  }, {});

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
      {flashMessage && <p className="text-sm text-emerald-600 dark:text-emerald-400">{flashMessage}</p>}

      {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-lg border border-site-border bg-site-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
                  <th className="p-3 text-left font-medium text-site-text">이름</th>
                  <th className="p-3 text-left font-medium text-site-text">아이디 / 이메일</th>
                  <th className="p-3 text-left font-medium text-site-text">회원구분</th>
                  <th className="p-3 text-left font-medium text-site-text">활동 점수</th>
                  <th className="p-3 text-left font-medium text-site-text">LEVEL</th>
                  <th className="p-3 text-left font-medium text-site-text">상태</th>
                  <th className="p-3 text-left font-medium text-site-text">가입일</th>
                  <th className="p-3 text-left font-medium text-site-text">최근 수정일</th>
                  <th className="p-3 text-left font-medium text-site-text">관리</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-site-text-muted">
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
                      <td className="p-3 text-site-text">{getResolvedRoleLabel(row)}</td>
                      <td className="p-3 text-site-text">{row.activityPoint ?? 0}</td>
                      <td className="p-3 text-site-text" title={`communityScore ${row.communityScore ?? 0}`}>
                        {getCommunityLevelLabel(row)}
                      </td>
                      <td className="p-3 text-site-text">{getStatusDisplayLabel(row)}</td>
                      <td className="p-3 text-site-text-muted">
                        {row.createdAt ? formatKoreanDate(row.createdAt) : "-"}
                      </td>
                      <td className="p-3 text-site-text-muted">
                        {row.updatedAt ? formatKoreanDate(row.updatedAt) : "-"}
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
              roles={roles}
              onClose={() => setManageRow(null)}
              onSave={handlePatch}
              onSaveRoleAssignment={handleRoleAssignment}
              saving={saving}
              onSuccess={(message) => {
                setFlashMessage(message);
                setRefreshKey((k) => k + 1);
                router.refresh();
              }}
            />
          )}
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <section className="rounded-lg border border-site-border bg-site-card p-4">
          <h2 className="text-base font-semibold text-site-text">권한 역할 목록</h2>
          <p className="mt-1 text-xs text-site-text-muted">권한을 볼 회원구분을 선택하세요.</p>
          {rolesLoading && <p className="mt-3 text-sm text-site-text-muted">불러오는 중...</p>}
          {rolesError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{rolesError}</p>}
          <div className="mt-3 space-y-2">
            {roles.map((role) => {
              const active = role.id === selectedRoleId;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    active
                      ? "border-site-primary bg-site-primary/10 text-site-primary"
                      : "border-site-border bg-site-bg text-site-text hover:bg-site-bg/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{role.label}</span>
                    <span className="text-xs text-site-text-muted">{role.key}</span>
                  </div>
                  <p className="mt-1 text-xs text-site-text-muted">
                    회원 {role.userCount}명 · 권한 {role.permissionCount}개
                  </p>
                </button>
              );
            })}
            {!rolesLoading && !rolesError && roles.length === 0 && (
              <p className="text-sm text-site-text-muted">권한 역할이 없습니다.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-site-border bg-site-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-site-text">
                {selectedRole ? `${selectedRole.label} 권한` : "권한 체크리스트"}
              </h2>
              {selectedRole?.description && (
                <p className="mt-1 text-sm text-site-text-muted">{selectedRole.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSavePermissions}
              disabled={!selectedRoleId || permissionsLoading || permissionSaving}
              className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {permissionSaving ? "저장 중..." : "권한 저장"}
            </button>
          </div>

          {permissionLoadError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {permissionLoadError}
            </p>
          )}

          {permissionMessage && (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              {permissionMessage}
            </p>
          )}

          {permissionsLoading ? (
            <p className="mt-4 text-sm text-site-text-muted">권한 목록을 불러오는 중...</p>
          ) : permissionLoadError ? null : allPermissions.length === 0 ? (
            <p className="mt-4 text-sm text-site-text-muted">권한이 없습니다.</p>
          ) : (
            <div className="mt-4 space-y-5">
              {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-semibold text-site-text">
                    {CATEGORY_LABELS[category] ?? category}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {permissions.map((permission) => {
                      const checked = selectedPermissionKeys.includes(permission.key);
                      return (
                        <label
                          key={permission.id}
                          className="flex items-start gap-3 rounded-lg border border-site-border bg-site-bg px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(permission.key)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-site-text">
                              {getPermissionDisplayLabel(permission)}
                            </span>
                            <span className="block text-xs text-site-text-muted">{permission.key}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-site-border bg-site-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-site-text">해결사 랭킹</h2>
            <p className="mt-1 text-xs text-site-text-muted">
              채택 수, GOOD 수, 해법 수, 활동 점수 기준 상위 10명
            </p>
          </div>
        </div>
        {rankingLoading ? (
          <p className="mt-4 text-sm text-site-text-muted">랭킹을 불러오는 중...</p>
        ) : rankingError ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{rankingError}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
                  <th className="p-3 text-left font-medium text-site-text">순위</th>
                  <th className="p-3 text-left font-medium text-site-text">회원</th>
                  <th className="p-3 text-left font-medium text-site-text">현재 ROLE / 추천 ROLE</th>
                  <th className="p-3 text-left font-medium text-site-text">해법 수</th>
                  <th className="p-3 text-left font-medium text-site-text">채택 수</th>
                  <th className="p-3 text-left font-medium text-site-text">GOOD 수</th>
                  <th className="p-3 text-left font-medium text-site-text">활동 점수</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((item) => (
                  <tr key={item.userId} className="border-b border-site-border last:border-0">
                    <td className="p-3 text-site-text">{item.rank}</td>
                    <td className="p-3 text-site-text">
                      {item.name || item.username} ({item.username})
                    </td>
                    <td className="p-3 text-site-text">
                      {(item.currentRoleLabel ?? "-") + " / " + item.suggestedRoleLabel}
                    </td>
                    <td className="p-3 text-site-text">{item.solutionCount}</td>
                    <td className="p-3 text-site-text">{item.acceptedCount}</td>
                    <td className="p-3 text-site-text">{item.goodCount}</td>
                    <td className="p-3 text-site-text">{item.activityPoint}</td>
                  </tr>
                ))}
                {ranking.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-site-text-muted">
                      랭킹이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ManageModal({
  row,
  roles,
  onClose,
  onSave,
  onSaveRoleAssignment,
  saving,
  onSuccess,
}: {
  row: MemberRow;
  roles: RoleSummary[];
  onClose: () => void;
  onSave: (id: string, body: Record<string, string>) => Promise<void>;
  onSaveRoleAssignment: (
    id: string,
    body: { targetRoleId?: string; roleManualLocked?: boolean }
  ) => Promise<void>;
  saving: boolean;
  onSuccess: (message: string) => void;
}) {
  const [role, setRole] = useState(row.role);
  const [roleId, setRoleId] = useState(row.roleId ?? "");
  const [roleManualLocked, setRoleManualLocked] = useState(!!row.roleManualLocked);
  const [status, setStatus] = useState(row.withdrawnAt ? "DELETED" : row.status ?? "ACTIVE");
  const [orgClientType, setOrgClientType] = useState(row.orgClientType ?? "GENERAL");
  const [orgApprovalStatus, setOrgApprovalStatus] = useState(row.orgApprovalStatus ?? "APPROVED");
  const [confirmChange, setConfirmChange] = useState(false);
  const [pointRows, setPointRows] = useState<UserActivityPointItem[]>([]);
  const [pointLoading, setPointLoading] = useState(true);
  const [pointError, setPointError] = useState("");

  const roleChanged = role !== row.role;
  const roleIdChanged = roleId !== (row.roleId ?? "");
  const roleManualLockChanged = roleManualLocked !== !!row.roleManualLocked;
  const statusChanged = status !== (row.withdrawnAt ? "DELETED" : row.status ?? "ACTIVE");
  const orgChanged =
    row.role === "CLIENT_ADMIN" &&
    (orgClientType !== (row.orgClientType ?? "GENERAL") || orgApprovalStatus !== (row.orgApprovalStatus ?? "APPROVED"));
  const hasChanges = roleChanged || roleIdChanged || roleManualLockChanged || statusChanged || orgChanged;

  useEffect(() => {
    let cancelled = false;
    setPointLoading(true);
    setPointError("");
    fetch(`/api/admin/rbac/users/${row.id}/activity-points`)
      .then(async (res) => {
        const data = (await readJsonSafely<{ recentPoints?: UserActivityPointItem[]; error?: string }>(res)) as {
          recentPoints?: UserActivityPointItem[];
          error?: string;
        };
        if (!res.ok) {
          return Promise.reject(new Error(data.error ?? "점수 이력 조회 실패"));
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setPointRows(Array.isArray(data.recentPoints) ? (data.recentPoints as UserActivityPointItem[]) : []);
      })
      .catch((err) => {
        if (!cancelled) setPointError(err.message ?? "점수 이력을 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setPointLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  const handleSubmit = async () => {
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
    try {
      if (Object.keys(body).length > 0) {
        await onSave(row.id, body);
      }
      if (roleIdChanged || roleManualLockChanged) {
        await onSaveRoleAssignment(row.id, {
          ...(roleId ? { targetRoleId: roleId } : {}),
          ...(roleManualLockChanged ? { roleManualLocked } : {}),
        });
      }
      if (Object.keys(body).length > 0 || roleIdChanged || roleManualLockChanged) {
        onSuccess("회원 레벨/상태가 저장되었습니다.");
      }
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
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
          <div className="rounded-lg border border-site-border bg-site-bg p-3 text-sm">
            <p className="text-site-text">
              회원구분: <strong>{getResolvedRoleLabel(row)}</strong>
            </p>
            <p className="mt-1 text-site-text">
              활동 점수: <strong>{row.activityPoint ?? 0}</strong>
            </p>
            <p className="mt-1 text-site-text">
              커뮤니티 LEVEL: <strong>{getCommunityLevelLabel(row)}</strong>
            </p>
            <p className="mt-1 text-site-text-muted">
              communityScore: {row.communityScore ?? 0}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-site-text-muted mb-1">변경할 RBAC 역할</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
            >
              <option value="">선택 안 함</option>
              {roles.map((roleOption) => (
                <option key={roleOption.id} value={roleOption.id}>
                  {roleOption.label} ({roleOption.key})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-site-border bg-site-bg px-3 py-2">
            <input
              type="checkbox"
              checked={roleManualLocked}
              onChange={(e) => setRoleManualLocked(e.target.checked)}
            />
            <span className="text-sm text-site-text">관리자 수동 고정</span>
          </label>
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

        <div className="mt-4 rounded-lg border border-site-border bg-site-bg p-3">
          <h4 className="text-sm font-semibold text-site-text">최근 활동 점수</h4>
          {pointLoading ? (
            <p className="mt-2 text-xs text-site-text-muted">불러오는 중...</p>
          ) : pointError ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{pointError}</p>
          ) : pointRows.length === 0 ? (
            <p className="mt-2 text-xs text-site-text-muted">점수 이력이 없습니다.</p>
          ) : (
            <div className="mt-2 max-h-48 overflow-auto">
              <table className="w-full text-xs">
                <tbody>
                  {pointRows.map((pointRow) => (
                    <tr key={pointRow.id} className="border-b border-site-border last:border-0">
                      <td className="py-2 pr-3 text-site-text">
                        {pointRow.description ?? pointRow.type}
                      </td>
                      <td className="py-2 pr-3 text-site-text-muted">
                        {pointRow.points > 0 ? `+${pointRow.points}` : pointRow.points}
                      </td>
                      <td className="py-2 text-site-text-muted">
                        {formatKoreanDate(pointRow.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
