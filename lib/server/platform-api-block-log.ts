export type PlatformApiBlockEvent =
  | "blocked_platform_api_unauthenticated"
  | "blocked_platform_api_from_app"
  | "blocked_platform_api_non_platform_role";

export function logPlatformApiBlock(
  event: PlatformApiBlockEvent,
  details: { path: string; method?: string; userId?: string | null },
): void {
  console.warn(`[platform-api-access] ${event}`, {
    path: details.path,
    method: details.method ?? null,
    userId: details.userId ?? null,
    at: new Date().toISOString(),
  });
}
