import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isPlatformAdmin } from "@/types/auth";

/** 기본 키 목록 시드 (없으면 생성). 플랫폼 관리자 전용 */
const DEFAULT_TEXTS: { key: string; group: string; label: string; description: string; defaultValue: string }[] = [
  { key: "home.hero.title", group: "home", label: "메인 히어로 제목", description: "메인 상단 히어로 영역 제목", defaultValue: "캐롬클럽" },
  { key: "home.hero.subtitle", group: "home", label: "메인 히어로 부제목", description: "메인 상단 히어로 부제목", defaultValue: "당구 대회와 당구장 정보를 한곳에서" },
  { key: "community.emptyMessage", group: "community", label: "커뮤니티 빈 목록 안내", description: "글이 없을 때 안내 문구", defaultValue: "아직 글이 없습니다." },
  { key: "community.searchNoResult", group: "community", label: "검색 결과 없음", description: "검색 결과 없을 때", defaultValue: "검색 결과가 없습니다." },
  { key: "auth.login.subtitle", group: "auth", label: "로그인 안내", description: "로그인 페이지 부제목", defaultValue: "로그인하여 서비스를 이용하세요." },
  { key: "auth.signup.subtitle", group: "auth", label: "회원가입 안내", description: "회원가입 페이지 부제목", defaultValue: "회원가입하여 다양한 서비스를 이용하세요." },
  { key: "error.notFound", group: "error", label: "404 안내", description: "페이지 없음", defaultValue: "요청한 페이지를 찾을 수 없습니다." },
  { key: "error.serverError", group: "error", label: "500 안내", description: "서버 오류", defaultValue: "일시적인 오류가 발생했습니다." },
  { key: "footer.copyright", group: "footer", label: "푸터 저작권", description: "푸터 하단 문구", defaultValue: "© CAROM.CLUB" },
  { key: "mypage.emptyMessage", group: "mypage", label: "마이페이지 빈 안내", description: "마이페이지 빈 목록", defaultValue: "내용이 없습니다." },
];

export async function POST() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  let created = 0;
  for (const t of DEFAULT_TEXTS) {
    const existing = await prisma.systemText.findUnique({ where: { key: t.key } });
    if (!existing) {
      await prisma.systemText.create({
        data: {
          key: t.key,
          group: t.group,
          label: t.label,
          description: t.description,
          defaultValue: t.defaultValue,
          value: null,
          isEnabled: true,
        },
      });
      created++;
    }
  }
  return NextResponse.json({ ok: true, created });
}
