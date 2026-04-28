import SiteMainLegacyHome from "../main-legacy/page";

export const dynamic = "force-dynamic";

export default async function SitePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const draftIdRaw = resolvedSearchParams.draftId;
  const draftId = Array.isArray(draftIdRaw) ? draftIdRaw[0] : draftIdRaw;
  const pageId = typeof draftId === "string" && draftId.trim() ? draftId.trim() : "home";

  return (
    <SiteMainLegacyHome
      searchParams={Promise.resolve({
        ...resolvedSearchParams,
        pageId,
        previewMode: "draft",
      })}
    />
  );
}
