import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import { isFeatureEnabled } from "@/lib/site-feature-flags";
import {
  getCommunityPostCommentsTree,
  getTroubleShotSolutionsForPost,
  loadCommunityPostDetail,
} from "@/lib/community-post-detail-server";
import { CommunityPostDetailView } from "@/components/community/CommunityPostDetailView";

export const revalidate = 60;

export default async function CommunityBoardSlugPostDetailPage({
  params,
}: {
  params: Promise<{ boardSlug: string; postId: string }>;
}) {
  const { boardSlug, postId } = await params;
  const session = await getSession();
  const result = await loadCommunityPostDetail(postId, session);

  if (!result.ok) {
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
    if (result.reason === "trouble_requires_login") {
      redirect(`/login?next=${encodeURIComponent(`/community/${boardSlug}/${postId}`)}`);
    }
    notFound();
  }

  const [comments, troubleSolutions] = await Promise.all([
    getCommunityPostCommentsTree(postId, session),
    result.post.boardSlug === "trouble" ? getTroubleShotSolutionsForPost(postId, session) : Promise.resolve([]),
  ]);
  const commentFeatureEnabled = await isFeatureEnabled("community_comment_enabled");
  const canCreateComment =
    !!session && commentFeatureEnabled && (await hasPermission(session, PERMISSION_KEYS.COMMUNITY_COMMENT_CREATE));

  return (
    <CommunityPostDetailView
      postId={postId}
      serverHydrated
      initialPostJson={result.post}
      initialComments={comments}
      initialTroubleSolutions={troubleSolutions}
      canCreateComment={canCreateComment}
      linkOverrides={{
        listHref: `/community/${boardSlug}`,
        editHref: `/community/posts/${postId}/edit`,
        deleteRedirect: `/community/${boardSlug}`,
      }}
    />
  );
}
