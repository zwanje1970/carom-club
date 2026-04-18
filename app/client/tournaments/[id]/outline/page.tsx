import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getTournamentById } from "../../../../../lib/server/dev-store";
import { isEmptyOutlineHtml } from "../../../../../lib/outline-content-helpers";

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

  if (pdf) {
    redirect(pdf);
  }

  const back = (
    <div className="v3-row" style={{ gap: "0.5rem" }}>
      <Link className="v3-btn" href={`/client/tournaments/${id}`} style={{ padding: "0.5rem 0.9rem" }}>
        ← 대회 상세
      </Link>
    </div>
  );

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
