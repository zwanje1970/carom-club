import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import { NanguSolutionEditorShell } from "@/components/nangu/NanguSolutionEditorShell";

export default async function NanguSolvePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  if (!session?.id) {
    redirect(`/login?next=${encodeURIComponent(`/community/nangu/${id}/solve`)}`);
  }

  const post = await prisma.nanguPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      ballPlacementJson: true,
    },
  });

  if (!post) notFound();

  const placement = JSON.parse(post.ballPlacementJson) as NanguBallPlacement;
  const cueBall = placement.cueBall === "white" ? placement.whiteBall : placement.yellowBall;
  const objectBall1 = placement.cueBall === "white" ? placement.yellowBall : placement.whiteBall;
  const objectBall2 = placement.redBall;

  return (
    <main className="min-h-screen bg-site-bg text-site-text py-10">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold">{post.title}</h1>
        <NanguSolutionEditorShell
          postId={post.id}
          cueBall={cueBall}
          objectBall1={objectBall1}
          objectBall2={objectBall2}
        />
      </div>
    </main>
  );
}
