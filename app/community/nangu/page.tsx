import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getCachedNanguBoardList } from "@/lib/community-nangu-list-server";
import { formatKoreanDate } from "@/lib/format-date";
import { NanguSolverIcon } from "@/components/community/NanguSolverIcon";

export const dynamic = "force-dynamic";

export default async function NanguBoardPage() {
  if (!isDatabaseConfigured()) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <p className="text-gray-600 dark:text-slate-400">데이터베이스에 연결할 수 없습니다.</p>
          <Link href="/community" className="mt-2 inline-block text-site-primary underline">
            커뮤니티로
          </Link>
        </div>
      </main>
    );
  }

  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/community/nangu")}`);
  }

  const canCreatePost = await hasPermission(session, PERMISSION_KEYS.COMMUNITY_POST_CREATE);
  const posts = await getCachedNanguBoardList();

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 md:flex hidden" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">
            커뮤니티
          </Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">난구해결사</span>
        </nav>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-0 min-w-0">
            <NanguSolverIcon size={56} />
            <h1 className="text-xl font-bold truncate md:block hidden">난구해결사</h1>
          </div>
          {canCreatePost && (
            <Link
              href="/community/nangu/write"
              className="shrink-0 py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium"
            >
              글쓰기
            </Link>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">문제구 질문 및 해법 토론용 게시판입니다.</p>
        {posts.length === 0 ? (
          <p className="text-gray-500">아직 글이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="게시글 목록">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/community/nangu/${p.id}`}
                  className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-site-text line-clamp-2 leading-snug">{p.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {p.authorName} · {formatKoreanDate(p.createdAt)} · 해법 {p.solutionCount}개
                    </p>
                  </div>
                  <span className="shrink-0 self-start rounded-md border border-gray-200 dark:border-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                    {p.solutionCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
