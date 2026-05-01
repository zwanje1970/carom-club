import Link from "next/link";
import { notFound } from "next/navigation";
import { outlineFileKindFromAsset, outlinePdfIdFromPublicUrl } from "../../../../../lib/outline-pdf-helpers";
import { getOutlinePdfAssetById, getTournamentByIdForPublicSitePage } from "../../../../../lib/surface-read";
import { isEmptyOutlineHtml } from "../../../../../lib/outline-content-helpers";
import SiteOutlineDocumentCard from "../../../components/SiteOutlineDocumentCard";
import SiteShellFrame from "../../../components/SiteShellFrame";

export default async function TournamentOutlineViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTournamentByIdForPublicSitePage(id);
  if (!t) notFound();

  const pdf = t.outlinePdfUrl?.trim();
  const img = t.outlineImageUrl?.trim();
  const htmlRaw = t.outlineHtml?.trim() ?? "";
  const hasText = htmlRaw !== "" && !isEmptyOutlineHtml(htmlRaw);
  const mode = t.outlineDisplayMode;

  const outlinePdfId = outlinePdfIdFromPublicUrl(t.outlinePdfUrl);
  const outlinePdfAsset = outlinePdfId ? await getOutlinePdfAssetById(outlinePdfId) : null;
  const outlinePdfFileKind = outlineFileKindFromAsset(outlinePdfAsset);

  const back = (
    <div className="v3-row" style={{ gap: "0.5rem" }}>
      <Link prefetch={false} className="v3-btn" href={`/site/tournaments/${id}`} style={{ padding: "0.5rem 0.9rem" }}>
        ← 대회 상세
      </Link>
    </div>
  );

  if (pdf) {
    return (
      <SiteShellFrame brandTitle="대회요강">
        <section className="site-site-gray-main v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
          {back}
          <div style={{ marginTop: "0.75rem" }}>
            <SiteOutlineDocumentCard url={pdf} fileKind={outlinePdfFileKind} caption="요강 보기" />
          </div>
        </section>
      </SiteShellFrame>
    );
  }

  if (mode === "TEXT" && hasText) {
    return (
      <SiteShellFrame brandTitle="대회요강">
        <section className="site-site-gray-main v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
          {back}
          <div
            className="v3-box v3-stack outline-view-html"
            style={{ marginTop: "0.75rem" }}
            dangerouslySetInnerHTML={{ __html: t.outlineHtml ?? "" }}
          />
        </section>
      </SiteShellFrame>
    );
  }
  if (mode === "IMAGE" && img) {
    return (
      <SiteShellFrame brandTitle="대회요강">
        <section className="site-site-gray-main v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
          {back}
          <div className="v3-box v3-stack" style={{ marginTop: "0.75rem" }}>
            <img
              src={img}
              alt="대회요강"
              style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block" }}
            />
          </div>
        </section>
      </SiteShellFrame>
    );
  }
  if (hasText) {
    return (
      <SiteShellFrame brandTitle="대회요강">
        <section className="site-site-gray-main v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
          {back}
          <div
            className="v3-box v3-stack outline-view-html"
            style={{ marginTop: "0.75rem" }}
            dangerouslySetInnerHTML={{ __html: t.outlineHtml ?? "" }}
          />
        </section>
      </SiteShellFrame>
    );
  }
  if (img) {
    return (
      <SiteShellFrame brandTitle="대회요강">
        <section className="site-site-gray-main v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
          {back}
          <div className="v3-box v3-stack" style={{ marginTop: "0.75rem" }}>
            <img
              src={img}
              alt="대회요강"
              style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block" }}
            />
          </div>
        </section>
      </SiteShellFrame>
    );
  }

  notFound();
}
