import { redirect } from "next/navigation";

/** 레거시 /community/boards/[slug] → /community/[slug] 서버 리다이렉트 */
export default async function CommunityBoardsLegacyRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/community/${slug}`);
}
