import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isCommunityModerator } from "@/lib/community-roles";
import { loadCommunityPostPreview } from "@/lib/community-post-detail-server";
import { CommunityPostDetailView } from "@/components/community/CommunityPostDetailView";

export const revalidate = 60;

export default async function CommunityBoardSlugPostDetailPage({
  params,
}: {
  params: Promise<{ boardSlug: string; postId: string }>;
}) {
  const { boardSlug, postId } = await params;
  const previewResult = await loadCommunityPostPreview(postId);

  if (!previewResult.ok) {
    if (previewResult.reason === "no_db") {
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

  const preview = previewResult.post;
  const needsSession = preview.boardSlug === "trouble" || Boolean(preview.isHidden);
  const session = needsSession ? await getSession() : null;

  if (preview.boardSlug === "trouble" && !session) {
    redirect(`/login?next=${encodeURIComponent(`/community/${boardSlug}/${postId}`)}`);
  }

  if (preview.isHidden && !isCommunityModerator(session)) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/community" className="hover:text-site-primary">
              커뮤니티
            </Link>
            <span>/</span>
            <Link href={`/community/${boardSlug}`} className="hover:text-site-primary">
              {preview.boardName}
            </Link>
          </nav>
          <p className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-6 text-gray-600 dark:text-gray-400">
            {preview.hiddenMessage ?? "관리자에 의해 숨김 처리된 내용입니다."}
          </p>
          <Link href={`/community/${boardSlug}`} className="mt-4 inline-block text-site-primary underline">
            목록으로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <CommunityPostDetailView
      postId={postId}
      serverHydrated
      initialPostJson={preview}
      initialComments={[]}
      initialTroubleSolutions={[]}
      canCreateComment={false}
      linkOverrides={{
        listHref: `/community/${boardSlug}`,
        editHref: `/community/posts/${postId}/edit`,
        deleteRedirect: `/community/${boardSlug}`,
      }}
    />
  );
}
