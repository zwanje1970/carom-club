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

export default async function CommunityPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const result = await loadCommunityPostDetail(id, session);

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
      redirect(`/login?next=${encodeURIComponent(`/community/trouble/${id}`)}`);
    }
    notFound();
  }

  const [comments, troubleSolutions] = await Promise.all([
    getCommunityPostCommentsTree(id, session),
    result.post.boardSlug === "trouble" ? getTroubleShotSolutionsForPost(id, session) : Promise.resolve([]),
  ]);
  const commentFeatureEnabled = await isFeatureEnabled("community_comment_enabled");
  const canCreateComment =
    !!session && commentFeatureEnabled && (await hasPermission(session, PERMISSION_KEYS.COMMUNITY_COMMENT_CREATE));

  return (
    <CommunityPostDetailView
      postId={id}
      serverHydrated
      initialPostJson={result.post}
      initialComments={comments}
      initialTroubleSolutions={troubleSolutions}
      canCreateComment={canCreateComment}
    />
  );
}
