import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCommunityBoardPageData } from "@/lib/community-board-page-data";
import { communityBoardSsrPerf } from "@/lib/community-board-ssr-perf";
import { CommunityBoardPageShell } from "@/components/community/CommunityBoardPageShell";
import { PageContentContainer } from "@/components/layout/PageContentContainer";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";

export const revalidate = 60;

function loginNextForBoard(
  boardSlug: string,
  sp: Record<string, string | string[] | undefined>
): string {
  const usp = new URLSearchParams();
  if (typeof sp.popular === "string") usp.set("popular", sp.popular);
  if (typeof sp.q === "string" && sp.q.trim()) usp.set("q", sp.q.trim());
  if (typeof sp.status === "string") usp.set("status", sp.status);
  if (typeof sp.cursor === "string" && sp.cursor.trim()) usp.set("cursor", sp.cursor.trim());
  if (typeof sp.page === "string") usp.set("page", sp.page);
  const suffix = usp.toString();
  const path = boardSlug === "trouble" ? "/community/trouble" : `/community/${boardSlug}`;
  return path + (suffix ? `?${suffix}` : "");
}

export default async function CommunityBoardSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  console.time("community_board_page_total");
  const { boardSlug } = await params;
  const sp = await searchParams;

  console.time("community_board_session");
  const session = await getSession();
  console.timeEnd("community_board_session");
  if (boardSlug === "trouble" && !session) {
    redirect(`/login?next=${encodeURIComponent(loginNextForBoard(boardSlug, sp))}`);
  }

  console.time("community_board_main_query");
  const endSsr = communityBoardSsrPerf(boardSlug);
  const result = await loadCommunityBoardPageData(boardSlug, sp, session);
  endSsr();
  console.timeEnd("community_board_main_query");

  if (result.ok === false) {
    if (result.reason === "no_db") {
      return (
        <main className="min-h-screen bg-site-bg text-site-text">
          <PageContentContainer className="py-6">
            <p className="text-gray-600 dark:text-slate-400">데이터베이스에 연결할 수 없습니다.</p>
            <Link href="/community" className="mt-2 inline-block text-site-primary underline">
              커뮤니티로
            </Link>
          </PageContentContainer>
        </main>
      );
    }
    notFound();
  }

  const showSolverEntry = session
    ? await hasPermission(session, PERMISSION_KEYS.COMMUNITY_POST_CREATE)
    : false;
  console.timeEnd("community_board_page_total");

  return (
    <CommunityBoardPageShell
      key={result.data.initialQueryKey}
      boardSlug={boardSlug}
      data={result.data}
      showSolverEntry={showSolverEntry}
    />
  );
}
