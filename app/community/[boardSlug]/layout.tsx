import { getSession } from "@/lib/auth";
import { NanguTroubleLoginGate } from "@/components/community/NanguTroubleLoginGate";

/** 난구해결(trouble) 게시판만 비로그인 차단 — 자유게시판 등은 그대로 */
export default async function CommunityBoardSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ boardSlug: string }>;
}) {
  const { boardSlug } = await params;
  if (boardSlug !== "trouble") {
    return <>{children}</>;
  }
  const session = await getSession();
  if (!session) {
    return <NanguTroubleLoginGate />;
  }
  return <>{children}</>;
}
