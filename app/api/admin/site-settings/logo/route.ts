import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processUploadedImage, uploadToBlob } from "@/lib/image-upload";
import { IMAGE_POLICIES } from "@/lib/image-policies";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.size) {
    return NextResponse.json(
      { error: "이미지 파일을 선택해주세요." },
      { status: 400 }
    );
  }

  try {
    const policy = IMAGE_POLICIES.logo;
    const processed = await processUploadedImage(file, policy);
    const { url } = await uploadToBlob(processed);
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.";
    if (message.includes("허용") || message.includes("MB") || message.includes("선택")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[site-settings logo] upload error:", e);
    return NextResponse.json(
      { error: "업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
