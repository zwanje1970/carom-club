import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 난구노트 상세는 마이페이지로 이동. 기존 URL 호환용 리다이렉트 */
export default async function CommunityNoteDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/mypage/notes/${id}`);
}
