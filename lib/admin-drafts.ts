/**
 * 관리자 편집 페이지 초안(드래프트) sessionStorage
 * - 저장 없이 나갔다가 다시 들어와도 최종 작업 단계 유지
 * - 로그아웃 시 초안 삭제, 로그아웃 전 미저장 시 확인
 */

const PREFIX = "admin-draft-";

export function getDraftKey(type: "outline" | "promo", id: string): string {
  return `${PREFIX}${type}-${id}`;
}

export function getDraft(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setDraft(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** 편집 초안이 하나라도 있는지 */
export function hasAnyDrafts(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 로그아웃 시 관리자 초안 전부 삭제 */
export function clearAllDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
