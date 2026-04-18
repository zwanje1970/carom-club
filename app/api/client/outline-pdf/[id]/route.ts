import { readFile } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  canUserAccessOutlinePdfAsset,
  getUserById,
  isOutlinePdfLinkedToAnyTournament,
} from "../../../../../lib/server/dev-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const pdfId = id?.trim() ?? "";
  if (!pdfId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const user = session ? await getUserById(session.userId) : null;

  let allowed = false;
  if (user) {
    allowed = await canUserAccessOutlinePdfAsset({ userId: user.id, userRole: user.role, pdfId });
  }
  if (!allowed) {
    allowed = await isOutlinePdfLinkedToAnyTournament(pdfId);
  }
  if (!allowed) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const filePath = path.join(process.cwd(), "data", "outline-pdfs", `${pdfId}.pdf`);
  try {
    const fileBuffer = await readFile(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="outline.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }
}
