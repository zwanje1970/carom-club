import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  buildOutlinePdfPublicUrl,
  createOutlinePdfAsset,
  getClientStatusByUserId,
  getUserById,
} from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function detectOutlineFileKind(file: File): "pdf" | "docx" | null {
  const name = file.name.trim().toLowerCase();
  if (file.type === PDF_MIME || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX_MIME || name.endsWith(".docx")) return "docx";
  return null;
}

async function getAuthorizedUploader() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user) return null;

  if (user.role === "PLATFORM") {
    return { user, allowed: true as const };
  }

  if (user.role !== "CLIENT") {
    return { user, allowed: false as const };
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { user, allowed: false as const };
  }

  return { user, allowed: true as const };
}

export async function POST(request: Request) {
  const auth = await getAuthorizedUploader();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
  }

  const fileKind = detectOutlineFileKind(file);
  if (!fileKind) {
    return NextResponse.json({ error: "PDF 또는 DOCX 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "빈 파일입니다." }, { status: 400 });
  }
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "문서는 15MB 이하만 업로드할 수 있습니다." }, { status: 400 });
  }

  const pdfId = randomUUID();
  const dir = path.join(process.cwd(), "data", "outline-pdfs");
  await mkdir(dir, { recursive: true });
  const ext = fileKind === "docx" ? "docx" : "pdf";
  const filePath = path.join(dir, `${pdfId}.${ext}`);
  await writeFile(filePath, buf);

  const meta = await createOutlinePdfAsset({ pdfId, uploaderUserId: auth.user.id, fileKind });
  if (!meta.ok) {
    return NextResponse.json({ error: meta.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: buildOutlinePdfPublicUrl(pdfId) });
}
