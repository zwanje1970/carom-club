import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNanguSolutionAccessState } from "@/lib/nangu-solution-policy.server";
import { NanguSolutionNewClient } from "./NanguSolutionNewClient";

export default async function NanguSolutionNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: postId } = await params;
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/community/nangu/${postId}/solution/new`)}`);
  }

  const accessState = await getNanguSolutionAccessState(session);
  if (!accessState.allowed) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600 dark:text-red-400">
            {accessState.reason === "level_too_low" && accessState.appliesUserLevelPolicy
              ? `일반회원은 LEVEL ${accessState.minSolutionLevelForUser} 이상부터 해법을 제시할 수 있습니다.`
              : "해법을 제시할 권한이 없습니다."}
          </p>
          <Link href={`/community/nangu/${postId}`} className="mt-2 inline-block text-site-primary underline">
            게시글로
          </Link>
        </div>
      </main>
    );
  }

  return <NanguSolutionNewClient postId={postId} />;
}
