import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ["application/pdf"];

export async function POST(request: Request) {
  const session = await getSession();
  const allowed = session?.role === "PLATFORM_ADMIN" || session?.role === "CLIENT_ADMIN";
  if (!session || !allowed) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.size) {
    return NextResponse.json(
      { error: "PDF 파일을 선택해주세요." },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "PDF 파일만 업로드 가능합니다." },
      { status: 400 }
    );
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json(
      { error: "파일 크기는 20MB 이하여야 합니다." },
      { status: 400 }
    );
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 10);
  const safeName = (file.name || "file").replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 50);
  const blobPath = `promo-pdf/${date}-${session.id.slice(0, 8)}-${random}-${safeName}`;

  const isDeploy = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  try {
    const [{ put }, fsPromises, pathModule] = await Promise.all([
      import("@vercel/blob"),
      import("fs/promises"),
      import("path"),
    ]);
    const { mkdir, writeFile } = fsPromises;
    const path = pathModule.default;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (hasBlobToken) {
      const blob = await put(blobPath, buffer, {
        access: "public",
        contentType: "application/pdf",
      });
      return NextResponse.json({ url: blob.url });
    }
    if (isDeploy) {
      return NextResponse.json(
        {
          error:
            "배포 환경에서는 PDF 저장이 되지 않습니다. Vercel Blob을 사용하려면 BLOB_READ_WRITE_TOKEN을 설정하세요.",
        },
        { status: 503 }
      );
    }
    const cwd = process.cwd();
    const dir = path.join(cwd, "public", "uploads", path.dirname(blobPath));
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, path.basename(blobPath));
    await writeFile(filePath, buffer);
    const url = `/uploads/${blobPath.replace(/\\/g, "/")}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[admin/upload-pdf] error:", e);
    return NextResponse.json(
      { error: "업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
