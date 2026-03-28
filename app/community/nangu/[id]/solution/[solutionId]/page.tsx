import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getLevelFromScore, getTierName, getTierColor } from "@/lib/community-level";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import { isFeatureEnabled } from "@/lib/site-feature-flags";
import type { NanguSolutionData } from "@/lib/nangu-types";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import { NanguSolutionDetailClient } from "./NanguSolutionDetailClient";

export default async function NanguSolutionDetailPage({
  params,
}: {
  params: Promise<{ id: string; solutionId: string }>;
}) {
  const { id: postId, solutionId } = await params;
  const session = await getSession();

  const post = await prisma.nanguPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      title: true,
      ballPlacementJson: true,
      adoptedSolutionId: true,
    },
  });
  if (!post) notFound();

  const solution = await prisma.nanguSolution.findFirst({
    where: { id: solutionId, postId },
    select: {
      id: true,
      title: true,
      comment: true,
      dataJson: true,
      authorId: true,
      voteCount: true,
      goodCount: true,
      badCount: true,
      createdAt: true,
      author: { select: { name: true, communityScore: true } },
    },
  });
  if (!solution) notFound();

  const ballPlacement = JSON.parse(post.ballPlacementJson) as NanguBallPlacement;
  const adoptedId = post.adoptedSolutionId ?? undefined;
  const isAdopted = solution.id === adoptedId;
  const level = solution.author ? getLevelFromScore(solution.author.communityScore ?? 0) : 1;
  const isAuthor = session?.id === post.authorId;
  const canAcceptSolution =
    !!session &&
    isAuthor &&
    (await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_ACCEPT));
  const viewer = session
    ? await prisma.user.findUnique({
        where: { id: session.id },
        select: { communityScore: true },
      })
    : null;
  const viewerLevel = viewer ? getLevelFromScore(viewer.communityScore ?? 0) : 1;
  const canVoteGood =
    !!session &&
    session.id !== solution.authorId &&
    viewerLevel >= 2 &&
    (await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_GOOD));
  const canVoteBad =
    !!session &&
    session.id !== solution.authorId &&
    viewerLevel >= 2 &&
    (await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_BAD));
  const voteBlockedReason = !session
    ? "로그인 후 평가할 수 있습니다."
    : session.id === solution.authorId
      ? "본인 해법은 평가할 수 없습니다."
      : viewerLevel < 2
        ? "평가는 레벨 2 이상부터 가능합니다."
        : !canVoteGood && !canVoteBad
          ? "해법 평가 권한이 없습니다."
          : null;
  const commentFeatureEnabled = await isFeatureEnabled("community_comment_enabled");
  const canCreateComment =
    !!session && commentFeatureEnabled && (await hasPermission(session, PERMISSION_KEYS.COMMUNITY_COMMENT_CREATE));
  const canDeleteOwnComment =
    !!session && (await hasPermission(session, PERMISSION_KEYS.COMMUNITY_COMMENT_DELETE_OWN));

  const data = JSON.parse(solution.dataJson) as NanguSolutionData;

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4"
          aria-label="breadcrumb"
        >
          <Link href="/community" className="hover:text-site-primary">
            커뮤니티
          </Link>
          <span aria-hidden>/</span>
          <Link href="/community/nangu" className="hover:text-site-primary">
            난구해결사
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/community/nangu/${postId}`} className="hover:text-site-primary line-clamp-1">
            {post.title}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">해법</span>
        </nav>

        <h1 className="text-xl font-bold mb-6 break-words">
          {solution.title ?? "해법"}
        </h1>

        <NanguSolutionDetailClient
          postId={post.id}
          postTitle={post.title}
          ballPlacement={ballPlacement}
          canAcceptSolution={canAcceptSolution}
          isLoggedIn={!!session}
          canVoteGood={canVoteGood}
          canVoteBad={canVoteBad}
          voteBlockedReason={voteBlockedReason}
          commentFeatureEnabled={commentFeatureEnabled}
          canCreateComment={canCreateComment}
          canDeleteOwnComment={canDeleteOwnComment}
          solution={{
            id: solution.id,
            title: solution.title,
            comment: solution.comment,
            data,
            voteCount: solution.voteCount,
            goodCount: solution.goodCount ?? 0,
            badCount: solution.badCount ?? 0,
            isAdopted,
            createdAt: solution.createdAt.toISOString(),
            authorName: solution.author?.name ?? "",
            authorLevel: level,
            authorTierName: getTierName(level),
            authorTierColor: getTierColor(level),
          }}
        />
      </div>
    </main>
  );
}
