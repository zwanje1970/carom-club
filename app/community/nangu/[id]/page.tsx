import Link from "next/link";
import { NanguSolverIcon } from "@/components/community/NanguSolverIcon";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getLevelFromScore, getTierName, getTierColor } from "@/lib/community-level";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import { NanguPostDetailClient } from "./NanguPostDetailClient";

export default async function NanguPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const post = await prisma.nanguPost.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      title: true,
      content: true,
      ballPlacementJson: true,
      adoptedSolutionId: true,
      createdAt: true,
      author: { select: { name: true, communityScore: true } },
    },
  });
  if (!post) notFound();

  const solutions = await prisma.nanguSolution.findMany({
    where: { postId: id },
    select: {
      id: true,
      title: true,
      comment: true,
      dataJson: true,
      voteCount: true,
      goodCount: true,
      badCount: true,
      createdAt: true,
      author: { select: { name: true, communityScore: true } },
    },
  });
  const adoptedId = post.adoptedSolutionId ?? undefined;
  const sorted = [...solutions].sort((a, b) => {
    const aAdopted = a.id === adoptedId ? 1 : 0;
    const bAdopted = b.id === adoptedId ? 1 : 0;
    if (bAdopted !== aAdopted) return bAdopted - aAdopted;
    const aNet = (a.goodCount ?? 0) - (a.badCount ?? 0);
    const bNet = (b.goodCount ?? 0) - (b.badCount ?? 0);
    if (bNet !== aNet) return bNet - aNet;
    const aLv = a.author?.communityScore ?? 0;
    const bLv = b.author?.communityScore ?? 0;
    if (bLv !== aLv) return bLv - aLv;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const ballPlacement = JSON.parse(post.ballPlacementJson) as NanguBallPlacement;
  const isAuthor = session?.id === post.authorId;
  const postAuthorLevel = post.author ? getLevelFromScore(post.author.communityScore ?? 0) : 1;

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <Link href="/community/nangu" className="hover:text-site-primary">난구해결사</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">상세</span>
        </nav>
        <div className="flex items-start gap-0 mb-6">
          <NanguSolverIcon size={48} className="mt-0.5 shrink-0" />
          <h1 className="text-xl font-bold flex-1 min-w-0 break-words">{post.title}</h1>
        </div>
        <NanguPostDetailClient
          post={{
            id: post.id,
            authorName: post.author.name,
            authorLevel: postAuthorLevel,
            authorTierName: getTierName(postAuthorLevel),
            authorTierColor: getTierColor(postAuthorLevel),
            title: post.title,
            content: post.content,
            ballPlacement,
            createdAt: post.createdAt.toISOString(),
            isAuthor,
          }}
          solutions={sorted.map((s) => {
            const level = s.author ? getLevelFromScore(s.author.communityScore ?? 0) : 1;
            return {
              id: s.id,
              title: s.title,
              comment: s.comment,
              data: JSON.parse(s.dataJson),
              voteCount: s.voteCount,
              goodCount: s.goodCount ?? 0,
              badCount: s.badCount ?? 0,
              isAdopted: s.id === adoptedId,
              createdAt: s.createdAt.toISOString(),
              authorName: s.author?.name ?? "",
              authorLevel: level,
              authorTierName: getTierName(level),
              authorTierColor: getTierColor(level),
            };
          })}
        />
      </div>
    </main>
  );
}
