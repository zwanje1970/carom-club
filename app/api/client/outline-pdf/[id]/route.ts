import { readFile } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  canUserAccessOutlinePdfAsset,
  getOutlinePdfAssetById,
  getUserById,
  isOutlinePdfLinkedForPublicSite,
} from "../../../../../lib/server/dev-store";

export const runtime = "nodejs";

const PDF_TYPE = "application/pdf";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
    allowed = await isOutlinePdfLinkedForPublicSite(pdfId);
  }
  if (!allowed) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const asset = await getOutlinePdfAssetById(pdfId);
  const dir = path.join(process.cwd(), "data", "outline-pdfs");

  const tryRead = async (
    relName: string
  ): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> => {
    try {
      const filePath = path.join(dir, relName);
      const buffer = await readFile(filePath);
      const isDocx = relName.endsWith(".docx");
      return {
        buffer,
        contentType: isDocx ? DOCX_TYPE : PDF_TYPE,
        filename: isDocx ? "outline.docx" : "outline.pdf",
      };
    } catch {
      return null;
    }
  };

  const preferDocx = asset?.fileKind === "docx";
  const first = preferDocx ? `${pdfId}.docx` : `${pdfId}.pdf`;
  const second = preferDocx ? `${pdfId}.pdf` : `${pdfId}.docx`;

  let resolved = await tryRead(first);
  if (!resolved) {
    resolved = await tryRead(second);
  }
  if (!resolved) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(resolved.buffer), {
    status: 200,
    headers: {
      "Content-Type": resolved.contentType,
      "Content-Disposition": `inline; filename="${resolved.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
