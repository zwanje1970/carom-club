import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processUploadedImage, uploadToBlob, isBlobConfigError, BLOB_SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/image-upload";
import { IMAGE_POLICIES, type ImageKind } from "@/lib/image-policies";

const ALLOWED_POLICIES: ImageKind[] = ["content", "section", "banner", "logo", "thumbnail", "venue", "tournament"];

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
      { error: "이미지 파일을 선택해주세요." },
      { status: 400 }
    );
  }

  if (process.env.VERCEL === "1" && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[admin/upload-image] BLOB_READ_WRITE_TOKEN is not set in deployment.");
    return NextResponse.json(
      { error: BLOB_SERVICE_UNAVAILABLE_MESSAGE },
      { status: 503 }
    );
  }

  const policyKey = (formData.get("policy") as string) || "content";
  const policy = ALLOWED_POLICIES.includes(policyKey as ImageKind)
    ? IMAGE_POLICIES[policyKey as ImageKind]
    : IMAGE_POLICIES.content;

  try {
    const processed = await processUploadedImage(file, policy, session.id);
    const { url } = await uploadToBlob(processed);
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.";
    if (message.includes("허용") || message.includes("MB") || message.includes("선택")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[admin/upload-image] error:", e);
    if (isBlobConfigError(message)) {
      return NextResponse.json(
        { error: BLOB_SERVICE_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
