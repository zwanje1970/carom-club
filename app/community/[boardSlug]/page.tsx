import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCommunityBoardPageData } from "@/lib/community-board-page-data";
import { communityBoardSsrPerf } from "@/lib/community-board-ssr-perf";
import { CommunityBoardPageShell } from "@/components/community/CommunityBoardPageShell";
import { isPlatformAdmin } from "@/types/auth";
import { canShowSolverEntry } from "@/lib/entry-visibility";

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
  const { boardSlug } = await params;
  const sp = await searchParams;

  const session = await getSession();
  if (boardSlug === "trouble" && !session) {
    redirect(`/login?next=${encodeURIComponent(loginNextForBoard(boardSlug, sp))}`);
  }

  const endSsr = communityBoardSsrPerf(boardSlug);
  const result = await loadCommunityBoardPageData(boardSlug, sp, session);
  endSsr();

  if (result.ok === false) {
    if (result.reason === "no_db") {
      return (
        <main className="min-h-screen bg-site-bg text-site-text">
          <div className="mx-auto max-w-3xl px-4 py-6">
            <p className="text-gray-600 dark:text-slate-400">데이터베이스에 연결할 수 없습니다.</p>
            <Link href="/community" className="mt-2 inline-block text-site-primary underline">
              커뮤니티로
            </Link>
          </div>
        </main>
      );
    }
    notFound();
  }

  const showSolverEntry = canShowSolverEntry(isPlatformAdmin(session));

  return (
    <CommunityBoardPageShell
      key={result.data.initialQueryKey}
      boardSlug={boardSlug}
      data={result.data}
      showSolverEntry={showSolverEntry}
    />
  );
}
