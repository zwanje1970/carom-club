import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import { TroubleSolutionNewClient } from "./TroubleSolutionNewClient";

export default async function TroubleSolutionNewPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const session = await getSession();

  if (!session) return null;

  const canCreateSolution = await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_CREATE);
  if (!canCreateSolution) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600 dark:text-red-400">해법 작성 권한이 없습니다.</p>
          <Link href={`/community/trouble/${postId}`} className="mt-2 inline-block text-site-primary underline">
            글로
          </Link>
        </div>
      </main>
    );
  }

  return <TroubleSolutionNewClient postId={postId} />;
}
