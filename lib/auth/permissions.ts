import type { SessionUser, UserRole } from "@/types/auth";

export const PERMISSION_KEYS = {
  COMMUNITY_POST_CREATE: "community.post.create",
  COMMUNITY_POST_EDIT_OWN: "community.post.edit.own",
  COMMUNITY_POST_DELETE_OWN: "community.post.delete.own",
  COMMUNITY_COMMENT_CREATE: "community.comment.create",
  COMMUNITY_COMMENT_EDIT_OWN: "community.comment.edit.own",
  COMMUNITY_COMMENT_DELETE_OWN: "community.comment.delete.own",
  COMMUNITY_VOTE_LIKE: "community.vote.like",
  SOLVER_SOLUTION_VIEW: "solver.solution.view",
  SOLVER_SOLUTION_CREATE: "solver.solution.create",
  SOLVER_SOLUTION_EDIT_OWN: "solver.solution.edit.own",
  SOLVER_SOLUTION_DELETE_OWN: "solver.solution.delete.own",
  SOLVER_SOLUTION_GOOD: "solver.solution.good",
  SOLVER_SOLUTION_BAD: "solver.solution.bad",
  SOLVER_SOLUTION_ACCEPT: "solver.solution.accept",
  NOTE_USE: "note.use",
  NOTE_SEND_TO_SOLVER: "note.send_to_solver",
  ADMIN_ACCESS: "admin.access",
  ADMIN_USER_MANAGE: "admin.user.manage",
  ADMIN_ROLE_MANAGE: "admin.role.manage",
  ADMIN_PERMISSION_MANAGE: "admin.permission.manage",
  ADMIN_POST_DELETE_ANY: "admin.post.delete.any",
  ADMIN_SOLUTION_DELETE_ANY: "admin.solution.delete.any",
  ADMIN_USER_BAN: "admin.user.ban",
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export const ALL_PERMISSION_KEYS = Object.values(PERMISSION_KEYS) as PermissionKey[];

export type PermissionSubject =
  | (Pick<SessionUser, "id" | "role"> & { roleId?: string | null })
  | null
  | undefined;

const USER_DEFAULT_PERMISSIONS: PermissionKey[] = [
  PERMISSION_KEYS.COMMUNITY_POST_CREATE,
  PERMISSION_KEYS.COMMUNITY_POST_EDIT_OWN,
  PERMISSION_KEYS.COMMUNITY_POST_DELETE_OWN,
  PERMISSION_KEYS.COMMUNITY_COMMENT_CREATE,
  PERMISSION_KEYS.COMMUNITY_COMMENT_EDIT_OWN,
  PERMISSION_KEYS.COMMUNITY_COMMENT_DELETE_OWN,
  PERMISSION_KEYS.COMMUNITY_VOTE_LIKE,
  PERMISSION_KEYS.SOLVER_SOLUTION_VIEW,
  PERMISSION_KEYS.SOLVER_SOLUTION_CREATE,
  PERMISSION_KEYS.SOLVER_SOLUTION_EDIT_OWN,
  PERMISSION_KEYS.SOLVER_SOLUTION_DELETE_OWN,
  PERMISSION_KEYS.SOLVER_SOLUTION_GOOD,
  PERMISSION_KEYS.SOLVER_SOLUTION_BAD,
];

const NOTE_USER_PERMISSIONS: PermissionKey[] = [
  ...USER_DEFAULT_PERMISSIONS,
  PERMISSION_KEYS.NOTE_USE,
  PERMISSION_KEYS.NOTE_SEND_TO_SOLVER,
  PERMISSION_KEYS.SOLVER_SOLUTION_ACCEPT,
];

const SOLVER_PERMISSIONS: PermissionKey[] = [...USER_DEFAULT_PERMISSIONS];

const LEGACY_ROLE_PERMISSION_FALLBACK: Record<string, PermissionKey[]> = {
  USER: USER_DEFAULT_PERMISSIONS,
  MODERATOR: USER_DEFAULT_PERMISSIONS,
  CLIENT_ADMIN: USER_DEFAULT_PERMISSIONS,
  ZONE_MANAGER: USER_DEFAULT_PERMISSIONS,
  PLATFORM_ADMIN: ALL_PERMISSION_KEYS,
  NOTE_USER: NOTE_USER_PERMISSIONS,
  SOLVER: SOLVER_PERMISSIONS,
  ADMIN: ALL_PERMISSION_KEYS,
};

export function dedupePermissionKeys(keys: string[]): PermissionKey[] {
  return [...new Set(keys.filter((key): key is PermissionKey => ALL_PERMISSION_KEYS.includes(key as PermissionKey)))];
}

export function getLegacyFallbackPermissions(
  role: UserRole | string | null | undefined
): PermissionKey[] {
  if (!role) return [];
  return [...(LEGACY_ROLE_PERMISSION_FALLBACK[role] ?? [])];
}
