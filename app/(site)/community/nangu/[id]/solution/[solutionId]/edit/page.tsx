import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import { prisma } from "@/lib/db";
import { NanguSolutionEditClient } from "./NanguSolutionEditClient";

export default async function NanguSolutionEditPage({
  params,
}: {
  params: Promise<{ id: string; solutionId: string }>;
}) {
  const { id: postId, solutionId } = await params;
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/community/nangu/${postId}/solution/${solutionId}/edit`)}`);
  }

  const canEditOwnSolution = await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_EDIT_OWN);
  if (!canEditOwnSolution) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600 dark:text-red-400">해법을 수정할 권한이 없습니다.</p>
          <Link href={`/community/nangu/${postId}`} className="mt-2 inline-block text-site-primary underline">
            게시글로
          </Link>
        </div>
      </main>
    );
  }

  const solution = await prisma.nanguSolution.findFirst({
    where: { id: solutionId, postId },
    select: { authorId: true },
  });
  if (!solution) notFound();

  if (solution.authorId !== session.id) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600 dark:text-red-400">본인 해법만 수정할 수 있습니다.</p>
          <Link href={`/community/nangu/${postId}`} className="mt-2 inline-block text-site-primary underline">
            게시글로
          </Link>
        </div>
      </main>
    );
  }

  return <NanguSolutionEditClient postId={postId} solutionId={solutionId} />;
}
