import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getSiteCommunityConfig,
  parseCommunityBoardTypeParam,
  type SiteCommunityBoardKey,
} from "../../../../../lib/server/dev-store";
import CommunityPostWriteForm from "./CommunityPostWriteForm";

type Props = {
  params: Promise<{ boardType: string }>;
};

export default async function SiteCommunityWritePage({ params }: Props) {
  const { boardType: raw } = await params;
  const boardType = parseCommunityBoardTypeParam(raw);
  if (!boardType) notFound();

  const config = await getSiteCommunityConfig();
  const board = config[boardType as SiteCommunityBoardKey];
  if (!board.visible) notFound();

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/site/community/${boardType}/write`)}`);
  }

  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1" style={{ fontSize: "1.4rem" }}>
        글쓰기 · {board.label}
      </h1>
      <CommunityPostWriteForm boardType={boardType} />
      <div className="v3-row">
        <Link className="v3-btn" href={`/site/community/${boardType}`}>
          목록
        </Link>
      </div>
    </main>
  );
}
