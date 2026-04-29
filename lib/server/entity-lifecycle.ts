/** 소프트 삭제 등 공통 라이프사이클 값 (저장·API와 무관한 순수 헬퍼) */

export type EntityLifecycleStatus = "ACTIVE" | "DELETED";

export function normalizeEntityLifecycleStatus(value: unknown): EntityLifecycleStatus {
  return value === "DELETED" ? "DELETED" : "ACTIVE";
}

export function isEntityLifecycleVisibleForList(
  lifecycle: unknown,
  options?: { legacyIsDeleted?: boolean },
): boolean {
  if (options?.legacyIsDeleted === true) return false;
  return normalizeEntityLifecycleStatus(lifecycle) !== "DELETED";
}
