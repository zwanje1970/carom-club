import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNanguSolutionAccessState } from "@/lib/nangu-solution-policy.server";

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

  const accessState = await getNanguSolutionAccessState(session);

  if (!accessState.allowed) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text py-10">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          <h1 className="mb-4 text-2xl font-bold">해법 작성 권한이 없습니다.</h1>
          <p className="text-sm text-site-text-muted">
            {accessState.reason === "level_too_low" && accessState.appliesUserLevelPolicy
              ? `일반회원은 LEVEL ${accessState.minSolutionLevelForUser} 이상부터 난구해결사 해법을 등록할 수 있습니다.`
              : "현재 계정에는 난구해결사 해법 작성 권한이 없습니다."}
          </p>
          <Link href={`/community/nangu/${id}`} className="mt-3 inline-block text-site-primary underline">
            게시글로
          </Link>
        </div>
      </main>
    );
  }

  redirect(`/community/nangu/${id}/solution/new`);
}
