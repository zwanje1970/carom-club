/**
 * 설정창 「설정 적용없이 경로선대로 움직이기」 — 브라우저에 유지(새로고침·재방문).
 * 서버에 저장된 해법 settings에 `ignorePhysics` 키가 있으면 그 값이 우선.
 */
const STORAGE_KEY = "carom_club_solution_ignore_physics_v1";

export function readIgnorePhysicsPreference(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* private mode 등 */
  }
  return null;
}

export function writeIgnorePhysicsPreference(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * @param rawSettingsFromApi `initialPersistedSettings` 또는 `initialSolutionData.settings` 원본(병합 전)
 */
export function pickInitialIgnorePhysics(
  rawSettingsFromApi: unknown,
  resolvedSettings: { ignorePhysics: boolean }
): boolean {
  if (
    rawSettingsFromApi &&
    typeof rawSettingsFromApi === "object" &&
    Object.prototype.hasOwnProperty.call(rawSettingsFromApi, "ignorePhysics")
  ) {
    const v = (rawSettingsFromApi as { ignorePhysics?: unknown }).ignorePhysics;
    if (typeof v === "boolean") return v;
  }
  const stored = readIgnorePhysicsPreference();
  if (stored !== null) return stored;
  return resolvedSettings.ignorePhysics;
}
