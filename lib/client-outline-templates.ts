/**
 * 클라이언트 콘솔 — 저장된 경기요강 템플릿 (브라우저 localStorage, 조직 단위)
 * 원본은 저장 항목별로 유지되며, 대회 편집 시에는 복사본만 수정합니다.
 */

export type OutlineDisplayMode = "direct" | "load" | "image" | "pdf";

export type OutlineTemplateRecord = {
  id: string;
  /** 표시·중복 검사용 이름 (확장자 없음) */
  name: string;
  mode: Exclude<OutlineDisplayMode, "load">;
  promoContent: string | null;
  outlineImageUrl: string | null;
  outlinePdfUrl: string | null;
  savedAt: string;
};

const STORAGE_PREFIX = "carom_outline_templates_v1_";

function storageKey(orgId: string): string {
  return `${STORAGE_PREFIX}${orgId}`;
}

function safeNameBase(s: string): string {
  return s.replace(/[^\w\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3-]/g, "_").slice(0, 80);
}

/** 기본 파일명: YYYYMMDD대회요강 */
export function defaultOutlineTemplateName(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}대회요강`;
}

/** 동일 이름이 있으면 _2, _3 … 접미사 */
export function uniquifyTemplateName(existingNames: string[], requested: string): string {
  const base = safeNameBase(requested.trim()) || defaultOutlineTemplateName();
  const lower = new Set(existingNames.map((n) => n.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  let n = 2;
  while (lower.has(`${base}_${n}`.toLowerCase())) n += 1;
  return `${base}_${n}`;
}

export function listOutlineTemplates(orgId: string): OutlineTemplateRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is OutlineTemplateRecord => x != null && typeof x === "object" && typeof (x as OutlineTemplateRecord).id === "string");
  } catch {
    return [];
  }
}

export function saveOutlineTemplate(
  orgId: string,
  draft: Omit<OutlineTemplateRecord, "id" | "savedAt" | "name"> & { id?: string },
  requestedName: string
): OutlineTemplateRecord {
  const list = listOutlineTemplates(orgId);
  const names = list.map((t) => t.name);
  const name = uniquifyTemplateName(names, requestedName);
  const id = draft.id ?? `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const rec: OutlineTemplateRecord = {
    id,
    name,
    mode: draft.mode,
    promoContent: draft.promoContent,
    outlineImageUrl: draft.outlineImageUrl,
    outlinePdfUrl: draft.outlinePdfUrl,
    savedAt: new Date().toISOString(),
  };
  const next = [...list.filter((t) => t.id !== id), rec].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  localStorage.setItem(storageKey(orgId), JSON.stringify(next));
  return rec;
}

export function getOutlineTemplateById(orgId: string, id: string): OutlineTemplateRecord | null {
  return listOutlineTemplates(orgId).find((t) => t.id === id) ?? null;
}
