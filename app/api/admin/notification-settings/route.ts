import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/notification-settings";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const settings = await getNotificationSettings();
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[notification-settings] GET error:", e);
    return NextResponse.json(
      { error: "설정을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: {
    adminEmail?: string | null;
    notifyNewRegistration?: boolean;
    notifyRegistrationConfirmed?: boolean;
    notifyPaymentConfirmed?: boolean;
    notifyAnnouncement?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  try {
    const settings = await updateNotificationSettings({
      adminEmail: body.adminEmail,
      notifyNewRegistration: body.notifyNewRegistration,
      notifyRegistrationConfirmed: body.notifyRegistrationConfirmed,
      notifyPaymentConfirmed: body.notifyPaymentConfirmed,
      notifyAnnouncement: body.notifyAnnouncement,
    });
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[notification-settings] PUT error:", e);
    return NextResponse.json(
      { error: "설정 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
