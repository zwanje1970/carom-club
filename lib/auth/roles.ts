export const AUTH_ROLES = ["USER", "CLIENT", "PLATFORM"] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === "string" && AUTH_ROLES.includes(value as AuthRole);
}
