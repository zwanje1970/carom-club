import { redirect } from "next/navigation";

/** 당구노트 작성은 마이페이지로 이동. 기존 URL 호환용 리다이렉트 */
export default function CommunityNotesNewPage() {
  redirect("/mypage/notes/new");
}
