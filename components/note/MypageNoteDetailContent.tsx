import Link from "next/link";
import { BilliardNoteDetailClient } from "@/components/community/BilliardNoteDetailClient";

interface MypageNoteDetailContentProps {
  note: {
    id: string;
    authorName: string;
    title: string | null;
    noteDate: Date | null;
    redBall: { x: number; y: number };
    yellowBall: { x: number; y: number };
    whiteBall: { x: number; y: number };
    cueBall: "white" | "yellow";
    memo: string | null;
    imageUrl: string | null;
    visibility: string;
    createdAt: Date;
    isAuthor: boolean;
  };
  linkedNanguPostId?: string | null;
  /** 구 trouble 게시판(CommunityPost id)만 연결된 경우 — nangu가 없을 때만 사용 */
  linkedTroublePostId?: string | null;
  basePath?: string;
}

export function MypageNoteDetailContent({
  note,
  linkedNanguPostId = null,
  linkedTroublePostId = null,
  basePath = "/mypage/notes",
}: MypageNoteDetailContentProps) {
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/mypage" className="hover:text-site-primary">마이페이지</Link>
          <span aria-hidden>/</span>
          <Link href="/mypage/notes" className="hover:text-site-primary">난구노트</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">상세</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">{note.title || "난구노트"}</h1>
        <BilliardNoteDetailClient
          note={note}
          linkedNanguPostId={linkedNanguPostId}
          linkedTroublePostId={linkedTroublePostId}
          basePath={basePath}
        />
      </div>
    </main>
  );
}
