import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/types/auth";
import { getAllFeatureFlags, setFeatureFlag, getFeatureLabel, FEATURE_KEYS, type SiteFeatureKey } from "@/lib/site-feature-flags";
import { createAdminLog } from "@/lib/admin-log";

/** 목록 */
export async function GET() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const flags = await getAllFeatureFlags();
  const items = FEATURE_KEYS.map((key) => ({
    key,
    label: getFeatureLabel(key),
    enabled: flags[key] ?? true,
  }));
  return NextResponse.json({ items });
}

/** 일괄 업데이트. body: { key: boolean } */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: Record<string, boolean>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  for (const key of FEATURE_KEYS) {
    if (typeof body[key] === "boolean") {
      await setFeatureFlag(key as SiteFeatureKey, body[key]);
      await createAdminLog({
        adminId: session.id,
        actionType: "update",
        targetType: "site_feature",
        targetId: key,
        afterValue: JSON.stringify({ enabled: body[key] }),
      });
    }
  }
  return NextResponse.json({ ok: true });
}
