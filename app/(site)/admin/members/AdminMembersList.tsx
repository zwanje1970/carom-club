"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MemberRow } from "@/app/api/admin/members/route";
import { formatKoreanDate } from "@/lib/format-date";
import { DEFAULT_ADMIN_COPY, fillAdminCopyTemplate, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

/** API/DB에서 오는 동적 문자열(이번 배치에서 copy로 치환하지 않음): rbacRoleLabel, RBAC 역할 목록 option label, permission.label·description, 활동 점수 행 description·type, 해결사 랭킹 suggestedRoleLabel·currentRoleLabel 등 */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
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

function getRoleDisplayLabel(row: MemberRow, copy: Record<string, string>): string {
  if (row.role === "PLATFORM_ADMIN") return getCopyValue(copy, "admin.members.role.platformAdmin");
  if (row.role === "ZONE_MANAGER") return getCopyValue(copy, "admin.members.role.zoneManager");
  if (row.role === "CLIENT_ADMIN") {
    if (row.orgClientType === "REGISTERED") return getCopyValue(copy, "admin.members.role.clientRegistered");
    return getCopyValue(copy, "admin.members.role.clientGeneral");
  }
  return getCopyValue(copy, "admin.members.role.user");
}

function getStatusDisplayLabel(row: MemberRow, copy: Record<string, string>): string {
  if (row.withdrawnAt) return getCopyValue(copy, "admin.members.status.withdrawn");
  if (row.status === "SUSPENDED") return getCopyValue(copy, "admin.members.status.suspended");
  if (row.orgApprovalStatus === "PENDING" && row.role === "CLIENT_ADMIN")
    return getCopyValue(copy, "admin.members.status.pendingApproval");
  if (row.orgStatus === "SUSPENDED") return getCopyValue(copy, "admin.members.status.suspended");
  return getCopyValue(copy, "admin.members.status.active");
}

function getDisplayName(row: MemberRow, copy: Record<string, string>): string {
  const name = (row.name ?? "").trim();
  if (name) return name;
  const u = row.username?.trim() || row.email?.trim();
  if (u) return u;
  return getCopyValue(copy, "admin.members.display.nameFallback");
}

function getResolvedRoleLabel(row: MemberRow, copy: Record<string, string>): string {
  return row.rbacRoleLabel?.trim() || getRoleDisplayLabel(row, copy);
}

function getCommunityLevelLabel(row: MemberRow, copy: Record<string, string>): string {
  const level = row.communityLevel ?? 1;
  const tierName = row.communityTierName?.trim();
  return tierName
    ? fillAdminCopyTemplate(getCopyValue(copy, "admin.members.display.levelWithTier"), { level, tierName })
    : String(level);
}

function getPermissionDisplayLabel(permission: PermissionItem): string {
  return permission.label?.trim() || permission.description?.trim() || permission.key;
}

function getPermissionCategoryLabel(copy: Record<string, string>, category: string): string {
  const k = `admin.members.permCategory.${category}` as AdminCopyKey;
  if (k in DEFAULT_ADMIN_COPY) return getCopyValue(copy, k);
  return category;
}

type MembersFilterPanelProps = {
  copy: Record<string, string>;
  search: string;
  roleType: string;
  status: string;
  sortBy: string;
  sortOrder: string;
  pageSize: number;
  setParams: (updates: Record<string, string | number>) => void;
  roleTypeOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  sortByOptions: { value: string; label: string }[];
  sortOrderOptions: { value: string; label: string }[];
  sortByLabel: string;
  sortOrderLabel: string;
  /** 모바일 터치 영역 확대 */
  touchFriendly?: boolean;
};

function AdminMembersFilterPanel({
  copy,
  search,
  roleType,
  status,
  sortBy,
  sortOrder,
  pageSize,
  setParams,
  roleTypeOptions,
  statusOptions,
  sortByOptions,
  sortOrderOptions,
  sortByLabel,
  sortOrderLabel,
  touchFriendly,
}: MembersFilterPanelProps) {
  const inputClass = touchFriendly
    ? "w-full rounded border border-site-border bg-site-card px-3 py-3 text-base text-site-text min-h-[44px] focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary md:min-h-0 md:py-2 md:text-sm"
    : "w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary";
  const selectClass = touchFriendly
    ? "w-full rounded border border-site-border bg-site-card px-3 py-3 text-base text-site-text min-h-[44px] focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary md:min-h-0 md:py-2 md:text-sm"
    : "w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary";
  const sortSelectClass = touchFriendly
    ? "rounded border border-site-border bg-site-card px-3 py-2.5 text-base text-site-text min-h-[44px] focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary md:min-h-0 md:py-1.5 md:text-sm"
    : "rounded border border-site-border bg-site-card px-3 py-1.5 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary";
  const pageSizeSelectClass = touchFriendly
    ? "mx-1 rounded border border-site-border bg-site-card px-2 py-2 text-base min-h-[44px] md:min-h-0 md:py-1 md:text-sm"
    : "mx-1 rounded border border-site-border bg-site-card px-2 py-1 text-sm";

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-site-text-muted">
            {getCopyValue(copy, "admin.members.searchLabel")}
          </label>
          <input
            type="search"
            placeholder={getCopyValue(copy, "admin.members.searchPlaceholder")}
            aria-label={getCopyValue(copy, "admin.members.searchPlaceholder")}
            value={search}
            onChange={(e) => setParams({ search: e.target.value, page: 1 })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-site-text-muted">
            {getCopyValue(copy, "admin.members.filterRoleTypeLabel")}
          </label>
          <select
            value={roleType}
            onChange={(e) => setParams({ roleType: e.target.value, page: 1 })}
            className={selectClass}
          >
            {roleTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-site-text-muted">
            {getCopyValue(copy, "admin.members.filterStatusLabel")}
          </label>
          <select
            value={status}
            onChange={(e) => setParams({ status: e.target.value, page: 1 })}
            className={selectClass}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-xs font-medium text-site-text-muted">{getCopyValue(copy, "admin.list.sortLabel")}</span>
        <select value={sortBy} onChange={(e) => setParams({ sortBy: e.target.value })} className={sortSelectClass}>
          {sortByOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={sortOrder} onChange={(e) => setParams({ sortOrder: e.target.value })} className={sortSelectClass}>
          {sortOrderOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-site-text-muted">
          {fillAdminCopyTemplate(getCopyValue(copy, "admin.members.sortCurrent"), {
            sortBy: sortByLabel,
            sortOrder: sortOrderLabel,
          })}
        </span>
        <button
          type="button"
          onClick={() => setParams({ status: "pending", page: 1 })}
          className={`rounded border border-amber-200 bg-amber-50 font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 ${
            touchFriendly ? "min-h-[44px] px-4 py-2.5 text-sm md:min-h-0 md:px-2.5 md:py-1.5 md:text-xs" : "px-2.5 py-1.5 text-xs"
          }`}
        >
          {getCopyValue(copy, "admin.members.quickPendingOnly")}
        </button>
        <span className={`text-xs text-site-text-muted ${touchFriendly ? "sm:ml-auto" : "ml-auto"}`}>
          {getCopyValue(copy, "admin.list.perPageLabel")}
          <select
            value={pageSize}
            onChange={(e) => setParams({ pageSize: e.target.value, page: 1 })}
            className={pageSizeSelectClass}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {getCopyValue(copy, "admin.list.perPageSuffix")}
        </span>
      </div>
    </>
  );
}

export function AdminMembersList({
  copy,
  view = "full",
  basePath = "/admin/members",
}: {
  copy: Record<string, string>;
  view?: "full" | "membersOnly" | "permissionsOnly";
  basePath?: string;
}) {
  const showMembersArea = view !== "permissionsOnly";
  const showPermissionsArea = view !== "membersOnly";
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

  const roleTypeOptions = useMemo(
    () => [
      { value: "all", label: getCopyValue(copy, "admin.list.filter.all") },
      { value: "user", label: getCopyValue(copy, "admin.members.filter.roleType.user") },
      { value: "client_general", label: getCopyValue(copy, "admin.members.filter.roleType.client_general") },
      { value: "client_registered", label: getCopyValue(copy, "admin.members.filter.roleType.client_registered") },
      { value: "admin", label: getCopyValue(copy, "admin.members.filter.roleType.admin") },
    ],
    [copy]
  );
  const statusOptions = useMemo(
    () => [
      { value: "all", label: getCopyValue(copy, "admin.list.filter.all") },
      { value: "active", label: getCopyValue(copy, "admin.members.filter.status.active") },
      { value: "pending", label: getCopyValue(copy, "admin.members.filter.status.pending") },
      { value: "suspended", label: getCopyValue(copy, "admin.members.filter.status.suspended") },
      { value: "withdrawn", label: getCopyValue(copy, "admin.members.filter.status.withdrawn") },
    ],
    [copy]
  );
  const sortByOptions = useMemo(
    () => [
      { value: "createdAt", label: getCopyValue(copy, "admin.members.sortBy.createdAt") },
      { value: "name", label: getCopyValue(copy, "admin.members.sortBy.name") },
      { value: "role", label: getCopyValue(copy, "admin.members.sortBy.role") },
    ],
    [copy]
  );
  const sortOrderOptions = useMemo(
    () => [
      { value: "desc", label: getCopyValue(copy, "admin.members.sortOrder.desc") },
      { value: "asc", label: getCopyValue(copy, "admin.members.sortOrder.asc") },
    ],
    [copy]
  );

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
      router.push(`${basePath}?${next.toString()}`);
    },
    [router, searchParams, basePath]
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
          return Promise.reject(new Error(data.error ?? getCopyValue(copy, "admin.members.errorListQuery")));
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
        if (!cancelled) setError(err.message ?? getCopyValue(copy, "admin.members.errorListLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, roleType, status, sortBy, sortOrder, page, pageSize, refreshKey, copy]);

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
          return Promise.reject(new Error(data.error ?? getCopyValue(copy, "admin.members.errorRolesQuery")));
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
        if (!cancelled) setRolesError(err.message ?? getCopyValue(copy, "admin.members.errorRolesQuery"));
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [copy]);

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
          return Promise.reject(new Error(data.error ?? getCopyValue(copy, "admin.members.errorPermissionsQuery")));
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
          setPermissionLoadError(err.message ?? getCopyValue(copy, "admin.members.errorPermissionsLoad"));
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
  }, [selectedRoleId, copy]);

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
          return Promise.reject(new Error(data.error ?? getCopyValue(copy, "admin.members.errorRankingQuery")));
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setRanking(Array.isArray(data.data) ? (data.data as SolverRankingRow[]) : []);
        }
      })
      .catch((err) => {
        if (!cancelled) setRankingError(err.message ?? getCopyValue(copy, "admin.members.errorRankingQuery"));
      })
      .finally(() => {
        if (!cancelled) setRankingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, copy]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortByLabel =
    sortByOptions.find((o) => o.value === sortBy)?.label ?? getCopyValue(copy, "admin.members.sortBy.createdAt");
  const sortOrderLabel =
    sortOrderOptions.find((o) => o.value === sortOrder)?.label ?? getCopyValue(copy, "admin.members.sortOrder.desc");

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
          throw new Error(data?.error ?? getCopyValue(copy, "admin.members.patchSaveFailed"));
        }
        setManageRow(null);
        setRefreshKey((k) => k + 1);
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [router, copy]
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
        throw new Error(data.error ?? getCopyValue(copy, "admin.members.roleSaveFailed"));
      }
    },
    [copy]
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
      const confirmed = window.confirm(getCopyValue(copy, "admin.members.confirmAdminPermissionChange"));
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
        setPermissionMessage(data.error ?? getCopyValue(copy, "admin.members.permissionSaveFailed"));
        return;
      }
      setPermissionMessage(getCopyValue(copy, "admin.members.permissionSaved"));
    } finally {
      setPermissionSaving(false);
    }
  }, [roles, selectedPermissionKeys, selectedRoleId, copy]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const permissionsByCategory = allPermissions.reduce<Record<string, PermissionItem[]>>((acc, permission) => {
    const category = permission.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(permission);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {showMembersArea ? (
        <>
          {/* 검색 / 필터 / 정렬 — 모바일: 접기, md+: 항상 표시 */}
          <details className="rounded-lg border border-site-border bg-site-bg/50 md:hidden">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-site-text outline-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-site-primary/70 focus-visible:ring-offset-2">
              <span className="min-w-0 flex-1">{getCopyValue(copy, "admin.list.searchAria")}</span>
              <span className="shrink-0 text-site-text-muted" aria-hidden>
                ▼
              </span>
            </summary>
            <div className="space-y-4 border-t border-site-border p-4">
              <AdminMembersFilterPanel
                copy={copy}
                search={search}
                roleType={roleType}
                status={status}
                sortBy={sortBy}
                sortOrder={sortOrder}
                pageSize={pageSize}
                setParams={setParams}
                roleTypeOptions={roleTypeOptions}
                statusOptions={statusOptions}
                sortByOptions={sortByOptions}
                sortOrderOptions={sortOrderOptions}
                sortByLabel={sortByLabel}
                sortOrderLabel={sortOrderLabel}
                touchFriendly
              />
            </div>
          </details>
          <div className="hidden flex-col gap-4 rounded-lg border border-site-border bg-site-bg/50 p-4 md:flex">
            <AdminMembersFilterPanel
              copy={copy}
              search={search}
              roleType={roleType}
              status={status}
              sortBy={sortBy}
              sortOrder={sortOrder}
              pageSize={pageSize}
              setParams={setParams}
              roleTypeOptions={roleTypeOptions}
              statusOptions={statusOptions}
              sortByOptions={sortByOptions}
              sortOrderOptions={sortOrderOptions}
              sortByLabel={sortByLabel}
              sortOrderLabel={sortOrderLabel}
            />
          </div>
        </>
      ) : null}

      {loading && <p className="text-sm text-site-text-muted">{getCopyValue(copy, "admin.list.loading")}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {flashMessage && <p className="text-sm text-emerald-600 dark:text-emerald-400">{flashMessage}</p>}

      {showMembersArea && !loading && !error && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-site-border bg-site-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
                  <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.thName")}</th>
                  <th className="p-3 text-left font-medium text-site-text">
                    {getCopyValue(copy, "admin.members.thUsernameEmail")}
                  </th>
                  <th className="p-3 text-left font-medium text-site-text">
                    {getCopyValue(copy, "admin.members.thMemberCategory")}
                  </th>
                  <th className="p-3 text-left font-medium text-site-text">
                    {getCopyValue(copy, "admin.members.thActivityScore")}
                  </th>
                  <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.thLevel")}</th>
                  <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.list.thStatus")}</th>
                  <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.thJoined")}</th>
                  <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.thUpdated")}</th>
                  <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.thManage")}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-site-text-muted">
                      {getCopyValue(copy, "admin.members.emptyFiltered")}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-site-border last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="p-3 text-site-text">{getDisplayName(row, copy)}</td>
                      <td className="p-3 text-site-text">
                        {row.username || "-"} {row.username && row.email ? " / " : ""} {row.email || ""}
                      </td>
                      <td className="p-3 text-site-text">{getResolvedRoleLabel(row, copy)}</td>
                      <td className="p-3 text-site-text">{row.activityPoint ?? 0}</td>
                      <td
                        className="p-3 text-site-text"
                        title={fillAdminCopyTemplate(getCopyValue(copy, "admin.members.display.communityScoreTooltip"), {
                          score: row.communityScore ?? 0,
                        })}
                      >
                        {getCommunityLevelLabel(row, copy)}
                      </td>
                      <td className="p-3 text-site-text">{getStatusDisplayLabel(row, copy)}</td>
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
                          {getCopyValue(copy, "admin.members.btnManage")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {items.length === 0 ? (
              <p className="rounded-lg border border-site-border bg-site-card p-6 text-center text-sm text-site-text-muted">
                {getCopyValue(copy, "admin.members.emptyFiltered")}
              </p>
            ) : (
              items.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-site-border bg-site-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-snug text-site-text">{getDisplayName(row, copy)}</p>
                      <p className="mt-1 break-words text-sm text-site-text-muted">
                        {row.username || "-"}
                        {row.username && row.email ? " · " : ""}
                        {row.email || ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-site-border bg-site-bg px-2.5 py-1 text-xs font-medium text-site-text whitespace-nowrap">
                      {getStatusDisplayLabel(row, copy)}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-site-text-muted">{getCopyValue(copy, "admin.members.thMemberCategory")}</dt>
                      <dd className="font-medium text-site-text">{getResolvedRoleLabel(row, copy)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-site-text-muted">{getCopyValue(copy, "admin.members.thActivityScore")}</dt>
                      <dd className="text-site-text">{row.activityPoint ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-site-text-muted">{getCopyValue(copy, "admin.members.thLevel")}</dt>
                      <dd className="text-site-text">{getCommunityLevelLabel(row, copy)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-site-text-muted">{getCopyValue(copy, "admin.members.thJoined")}</dt>
                      <dd className="text-site-text-muted">{row.createdAt ? formatKoreanDate(row.createdAt) : "-"}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => setManageRow(row)}
                    className="mt-4 flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-lg bg-site-primary/10 px-4 text-sm font-medium text-site-primary hover:bg-site-primary/20"
                  >
                    {getCopyValue(copy, "admin.members.btnManage")}
                  </button>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-site-text-muted">
                {fillAdminCopyTemplate(getCopyValue(copy, "admin.members.paginationSummary"), {
                  total,
                  page,
                  totalPages,
                })}
              </p>
              <div className="flex gap-1">
                <nav className="flex gap-1" aria-label={getCopyValue(copy, "admin.list.paginationNavAria")}>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setParams({ page: page - 1 })}
                    className="min-h-[44px] rounded border border-site-border bg-site-card px-3 py-2 text-sm disabled:opacity-50 md:min-h-0 md:py-1.5"
                  >
                    {getCopyValue(copy, "admin.list.paginationPrev")}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setParams({ page: page + 1 })}
                    className="min-h-[44px] rounded border border-site-border bg-site-card px-3 py-2 text-sm disabled:opacity-50 md:min-h-0 md:py-1.5"
                  >
                    {getCopyValue(copy, "admin.list.paginationNext")}
                  </button>
                </nav>
              </div>
            </div>
          )}

          {manageRow && (
            <ManageModal
              copy={copy}
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

      {showPermissionsArea ? (
      <>
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <section className="rounded-lg border border-site-border bg-site-card p-4">
          <h2 className="text-base font-semibold text-site-text">{getCopyValue(copy, "admin.members.rolesSectionTitle")}</h2>
          <p className="mt-1 text-xs text-site-text-muted">{getCopyValue(copy, "admin.members.rolesSectionHint")}</p>
          {rolesLoading && <p className="mt-3 text-sm text-site-text-muted">{getCopyValue(copy, "admin.list.loading")}</p>}
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
                    {fillAdminCopyTemplate(getCopyValue(copy, "admin.members.roleCardMeta"), {
                      userCount: role.userCount,
                      permCount: role.permissionCount,
                    })}
                  </p>
                </button>
              );
            })}
            {!rolesLoading && !rolesError && roles.length === 0 && (
              <p className="text-sm text-site-text-muted">{getCopyValue(copy, "admin.members.rolesEmpty")}</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-site-border bg-site-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-site-text">
                {selectedRole
                  ? `${selectedRole.label}${getCopyValue(copy, "admin.members.permissionTitleSuffix")}`
                  : getCopyValue(copy, "admin.members.permissionTitleFallback")}
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
              {permissionSaving
                ? getCopyValue(copy, "admin.members.permissionSaving")
                : getCopyValue(copy, "admin.members.permissionSave")}
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
            <p className="mt-4 text-sm text-site-text-muted">{getCopyValue(copy, "admin.members.permissionsLoading")}</p>
          ) : permissionLoadError ? null : allPermissions.length === 0 ? (
            <p className="mt-4 text-sm text-site-text-muted">{getCopyValue(copy, "admin.members.permissionsEmpty")}</p>
          ) : (
            <div className="mt-4 space-y-5">
              {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-semibold text-site-text">
                    {getPermissionCategoryLabel(copy, category)}
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
            <h2 className="text-base font-semibold text-site-text">{getCopyValue(copy, "admin.members.rankingTitle")}</h2>
            <p className="mt-1 text-xs text-site-text-muted">{getCopyValue(copy, "admin.members.rankingSubtitle")}</p>
          </div>
        </div>
        {rankingLoading ? (
          <p className="mt-4 text-sm text-site-text-muted">{getCopyValue(copy, "admin.members.rankingLoading")}</p>
        ) : rankingError ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{rankingError}</p>
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
                    <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.rankingThRank")}</th>
                    <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.rankingThMember")}</th>
                    <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.rankingThRoles")}</th>
                    <th className="p-3 text-left font-medium text-site-text">
                      {getCopyValue(copy, "admin.members.rankingThSolutions")}
                    </th>
                    <th className="p-3 text-left font-medium text-site-text">
                      {getCopyValue(copy, "admin.members.rankingThAccepted")}
                    </th>
                    <th className="p-3 text-left font-medium text-site-text">{getCopyValue(copy, "admin.members.rankingThGood")}</th>
                    <th className="p-3 text-left font-medium text-site-text">
                      {getCopyValue(copy, "admin.members.rankingThActivity")}
                    </th>
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
                        {getCopyValue(copy, "admin.members.rankingEmpty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-3 md:hidden">
              {ranking.length === 0 ? (
                <p className="rounded-lg border border-site-border bg-site-bg p-4 text-center text-sm text-site-text-muted">
                  {getCopyValue(copy, "admin.members.rankingEmpty")}
                </p>
              ) : (
                ranking.map((item) => (
                  <div key={item.userId} className="rounded-lg border border-site-border bg-site-bg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold text-site-text">
                        {getCopyValue(copy, "admin.members.rankingThRank")} #{item.rank}
                      </p>
                      <span className="shrink-0 rounded-full border border-site-border px-2 py-0.5 text-xs font-medium text-site-text">
                        {getCopyValue(copy, "admin.members.rankingThActivity")} {item.activityPoint}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-site-text">
                      {item.name || item.username}{" "}
                      <span className="text-site-text-muted">({item.username})</span>
                    </p>
                    <p className="mt-2 text-xs text-site-text-muted">
                      {getCopyValue(copy, "admin.members.rankingThRoles")}: {(item.currentRoleLabel ?? "-") + " / " + item.suggestedRoleLabel}
                    </p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <dt className="text-[10px] uppercase text-site-text-muted">{getCopyValue(copy, "admin.members.rankingThSolutions")}</dt>
                        <dd className="font-semibold text-site-text">{item.solutionCount}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase text-site-text-muted">{getCopyValue(copy, "admin.members.rankingThAccepted")}</dt>
                        <dd className="font-semibold text-site-text">{item.acceptedCount}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase text-site-text-muted">{getCopyValue(copy, "admin.members.rankingThGood")}</dt>
                        <dd className="font-semibold text-site-text">{item.goodCount}</dd>
                      </div>
                    </dl>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>
      </>
      ) : null}
    </div>
  );
}

function ManageModal({
  copy,
  row,
  roles,
  onClose,
  onSave,
  onSaveRoleAssignment,
  saving,
  onSuccess,
}: {
  copy: Record<string, string>;
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
          return Promise.reject(new Error(data.error ?? getCopyValue(copy, "admin.members.modalPointsQueryFailed")));
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setPointRows(Array.isArray(data.recentPoints) ? (data.recentPoints as UserActivityPointItem[]) : []);
      })
      .catch((err) => {
        if (!cancelled) setPointError(err.message ?? getCopyValue(copy, "admin.members.modalPointsLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setPointLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.id, copy]);

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
        onSuccess(getCopyValue(copy, "admin.members.patchSaveSuccess"));
      }
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : getCopyValue(copy, "admin.members.patchSaveFailed"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-site-border bg-site-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-site-text mb-4">{getCopyValue(copy, "admin.members.modalTitle")}</h3>
        <p className="text-sm text-site-text-muted mb-4">
          {getDisplayName(row, copy)} ({row.username})
        </p>

        <div className="space-y-4">
          <div className="rounded-lg border border-site-border bg-site-bg p-3 text-sm">
            <p className="text-site-text">
              {getCopyValue(copy, "admin.members.info.lineMemberCategory")}{" "}
              <strong>{getResolvedRoleLabel(row, copy)}</strong>
            </p>
            <p className="mt-1 text-site-text">
              {getCopyValue(copy, "admin.members.info.lineActivityScore")}{" "}
              <strong>{row.activityPoint ?? 0}</strong>
            </p>
            <p className="mt-1 text-site-text">
              {getCopyValue(copy, "admin.members.info.lineCommunityLevel")}{" "}
              <strong>{getCommunityLevelLabel(row, copy)}</strong>
            </p>
            <p className="mt-1 text-site-text-muted">
              {getCopyValue(copy, "admin.members.info.lineCommunityScore")} {row.communityScore ?? 0}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-site-text-muted mb-1">
              {getCopyValue(copy, "admin.members.modalChangeRbac")}
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
            >
              <option value="">{getCopyValue(copy, "admin.members.modalRbacNone")}</option>
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
            <span className="text-sm text-site-text">{getCopyValue(copy, "admin.members.modalManualLock")}</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-site-text-muted mb-1">
              {getCopyValue(copy, "admin.members.modalRoleLabel")}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
            >
              <option value="USER">{getCopyValue(copy, "admin.members.modal.option.role.USER")}</option>
              <option value="CLIENT_ADMIN">{getCopyValue(copy, "admin.members.modal.option.role.CLIENT_ADMIN")}</option>
              <option value="ZONE_MANAGER">{getCopyValue(copy, "admin.members.modal.option.role.ZONE_MANAGER")}</option>
              <option value="PLATFORM_ADMIN">{getCopyValue(copy, "admin.members.modal.option.role.PLATFORM_ADMIN")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-site-text-muted mb-1">
              {getCopyValue(copy, "admin.members.modalStatusLabel")}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
            >
              <option value="ACTIVE">{getCopyValue(copy, "admin.members.modal.option.memberStatus.ACTIVE")}</option>
              <option value="SUSPENDED">{getCopyValue(copy, "admin.members.modal.option.memberStatus.SUSPENDED")}</option>
              <option value="DELETED">{getCopyValue(copy, "admin.members.modal.option.memberStatus.DELETED")}</option>
            </select>
          </div>
          {role === "CLIENT_ADMIN" && (
            <>
              <div>
                <label className="block text-xs font-medium text-site-text-muted mb-1">
                  {getCopyValue(copy, "admin.members.modalClientTier")}
                </label>
                <select
                  value={orgClientType}
                  onChange={(e) => setOrgClientType(e.target.value)}
                  className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
                >
                  <option value="GENERAL">{getCopyValue(copy, "admin.members.modal.option.orgClient.GENERAL")}</option>
                  <option value="REGISTERED">
                    {getCopyValue(copy, "admin.members.modal.option.orgClient.REGISTERED")}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-site-text-muted mb-1">
                  {getCopyValue(copy, "admin.members.modalApprovalStatus")}
                </label>
                <select
                  value={orgApprovalStatus}
                  onChange={(e) => setOrgApprovalStatus(e.target.value)}
                  className="w-full rounded border border-site-border bg-site-card px-3 py-2 text-sm text-site-text"
                >
                  <option value="PENDING">{getCopyValue(copy, "admin.members.modal.option.orgApproval.PENDING")}</option>
                  <option value="APPROVED">{getCopyValue(copy, "admin.members.modal.option.orgApproval.APPROVED")}</option>
                  <option value="REJECTED">{getCopyValue(copy, "admin.members.modal.option.orgApproval.REJECTED")}</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-site-border bg-site-bg p-3">
          <h4 className="text-sm font-semibold text-site-text">{getCopyValue(copy, "admin.members.modalRecentPoints")}</h4>
          {pointLoading ? (
            <p className="mt-2 text-xs text-site-text-muted">{getCopyValue(copy, "admin.list.loading")}</p>
          ) : pointError ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{pointError}</p>
          ) : pointRows.length === 0 ? (
            <p className="mt-2 text-xs text-site-text-muted">{getCopyValue(copy, "admin.members.modalPointsEmpty")}</p>
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
            {getCopyValue(copy, "admin.members.modalConfirmApply")}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-site-border px-4 py-2 text-sm font-medium text-site-text hover:bg-site-bg"
          >
            {getCopyValue(copy, "admin.common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || (!hasChanges && !confirmChange)}
            className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving
              ? getCopyValue(copy, "admin.members.permissionSaving")
              : hasChanges && !confirmChange
                ? getCopyValue(copy, "admin.members.modalBtnConfirm")
                : getCopyValue(copy, "admin.common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
