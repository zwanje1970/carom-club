import { isPlatformAdmin, type SessionUser } from "@/types/auth";

/**
 * Main-site exposure policy (UI only: nav, home cards, community tabs, FAB).
 * - Does NOT disable routes or APIs.
 * - Development (NODE_ENV !== "production"): note/solver entries visible to everyone.
 * - Production: visible only when `isPlatformAdmin(session)` — PLATFORM_ADMIN + admin login channel (`types/auth`, same idea as `/admin` middleware).
 */
export function isDevelopmentEntryExposure(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function canShowNoteEntry(isPlatformAdminUser: boolean): boolean {
  if (isDevelopmentEntryExposure()) return true;
  return isPlatformAdminUser;
}

export function canShowSolverEntry(isPlatformAdminUser: boolean): boolean {
  if (isDevelopmentEntryExposure()) return true;
  return isPlatformAdminUser;
}

export function canShowNoteEntryFromSession(session: SessionUser | null): boolean {
  return canShowNoteEntry(isPlatformAdmin(session));
}

export function canShowSolverEntryFromSession(session: SessionUser | null): boolean {
  return canShowSolverEntry(isPlatformAdmin(session));
}
