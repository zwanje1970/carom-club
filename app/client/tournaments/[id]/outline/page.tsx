import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getOutlinePdfAssetById,
  getTournamentById,
  outlineFileKindFromAsset,
  outlinePdfIdFromPublicUrl,
} from "../../../../../lib/server/dev-store";
import { isEmptyOutlineHtml } from "../../../../../lib/outline-content-helpers";
import SiteOutlineDocumentCard from "../../../../site/components/SiteOutlineDocumentCard";

export default async function ClientTournamentOutlinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const t = await getTournamentById(id);
  if (!t) notFound();
  const canView = Boolean(session && t.createdBy === session.userId);
  if (!canView) {
    notFound();
  }

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
      <Link className="v3-btn" href={`/client/tournaments/${id}`} style={{ padding: "0.5rem 0.9rem" }}>
        ← 대회 상세
      </Link>
    </div>
  );

  if (pdf) {
    return (
      <main className="v3-page v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
        {back}
        <div style={{ marginTop: "0.75rem" }}>
          <SiteOutlineDocumentCard url={pdf} fileKind={outlinePdfFileKind} caption="요강 보기" />
        </div>
      </main>
    );
  }

  if (mode === "TEXT" && hasText) {
    return (
      <main className="v3-page v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
        {back}
        <div
          className="v3-box v3-stack outline-view-html"
          style={{ marginTop: "0.75rem" }}
          dangerouslySetInnerHTML={{ __html: t.outlineHtml ?? "" }}
        />
      </main>
    );
  }
  if (mode === "IMAGE" && img) {
    return (
      <main className="v3-page v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
        {back}
        <div className="v3-box v3-stack" style={{ marginTop: "0.75rem" }}>
          <img
            src={img}
            alt="대회요강"
            style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block" }}
          />
        </div>
      </main>
    );
  }
  if (hasText) {
    return (
      <main className="v3-page v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
        {back}
        <div
          className="v3-box v3-stack outline-view-html"
          style={{ marginTop: "0.75rem" }}
          dangerouslySetInnerHTML={{ __html: t.outlineHtml ?? "" }}
        />
      </main>
    );
  }
  if (img) {
    return (
      <main className="v3-page v3-stack" style={{ maxWidth: "48rem", margin: "0 auto" }}>
        {back}
        <div className="v3-box v3-stack" style={{ marginTop: "0.75rem" }}>
          <img
            src={img}
            alt="대회요강"
            style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block" }}
          />
        </div>
      </main>
    );
  }

  notFound();
}
