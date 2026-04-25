/** 자산 fileKind에서 문서 뷰어 선택용 */
export function outlineFileKindFromAsset(asset: { fileKind?: "pdf" | "docx" } | null): "pdf" | "docx" {
  return asset?.fileKind === "docx" ? "docx" : "pdf";
}

/** 저장된 공개 URL(`/api/client/outline-pdf/{id}`)에서 자산 id 추출 */
export function outlinePdfIdFromPublicUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  try {
    const pathPart = u.startsWith("http://") || u.startsWith("https://") ? new URL(u).pathname : u;
    const m = pathPart.match(/\/api\/client\/outline-pdf\/([^/?]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
