import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { hashPassword } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";

const DB_ERROR_CODES = ["P1001", "P1002", "P1017", "P1033"];

function isDbConnectionError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return (
    (typeof err?.code === "string" && DB_ERROR_CODES.includes(err.code)) ||
    (typeof err?.message === "string" &&
      /connect|ECONNREFUSED|timeout|database/i.test(err.message))
  );
}

const DB_UNAVAILABLE_MSG = "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요.";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: DB_UNAVAILABLE_MSG }, { status: 503 });
  }
  try {
    const body = await request.json();
    const {
      name,
      username,
      phone,
      password,
      handicap,
      avg,
      avgProofUrl,
      address,
      addressDetail,
    } = body as {
      name?: string;
      username?: string;
      phone?: string;
      password?: string;
      handicap?: string;
      avg?: string;
      avgProofUrl?: string;
      address?: string;
      addressDetail?: string;
    };

    if (!name?.trim() || !username?.trim() || !phone?.trim() || !password) {
      return NextResponse.json(
        { error: "이름, 닉네임, 연락처, 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const hashed = await hashPassword(password);
    const expiresAt = avgProofUrl
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : null;

    try {
      const existing = await prisma.user.findUnique({
        where: { username: username.trim() },
      });

      if (existing) {
        const withdrawnAt = (existing as { withdrawnAt?: Date | null }).withdrawnAt;
        if (!withdrawnAt) {
          return NextResponse.json(
            { error: "이미 사용 중인 닉네임입니다." },
            { status: 400 }
          );
        }
        const settings = await getSiteSettings();
        const rejoinDays = Math.max(0, Number(settings.withdrawRejoinDays) || 0);
        if (rejoinDays > 0) {
          const elapsedMs = Date.now() - withdrawnAt.getTime();
          const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);
          if (elapsedDays < rejoinDays) {
            return NextResponse.json(
              {
                error: `탈퇴 후 ${rejoinDays}일이 지나야 재가입할 수 있습니다.`,
              },
              { status: 400 }
            );
          }
        }
        // 재가입: 기존 계정 복구 (withdrawnAt 제거, 정보 갱신)
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: name.trim(),
            phone: phone.trim(),
            password: hashed,
            email: `${username.trim()}@carom.local`,
            withdrawnAt: null,
            ...(address !== undefined && { address: address?.trim() || null }),
            ...(addressDetail !== undefined && { addressDetail: addressDetail?.trim() || null }),
          },
        });
        const profile = await prisma.memberProfile.findUnique({
          where: { userId: existing.id },
        });
        if (profile) {
          await prisma.memberProfile.update({
            where: { id: profile.id },
            data: {
              handicap: handicap?.trim() || null,
              avg: avg?.trim() || null,
              avgProofUrl: avgProofUrl || null,
              avgProofExpiresAt: expiresAt,
            },
          });
        } else {
          await prisma.memberProfile.create({
            data: {
              userId: existing.id,
              handicap: handicap?.trim() || null,
              avg: avg?.trim() || null,
              avgProofUrl: avgProofUrl || null,
              avgProofExpiresAt: expiresAt,
            },
          });
        }
        return NextResponse.json({ ok: true, userId: existing.id });
      }

      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          username: username.trim(),
          email: `${username.trim()}@carom.local`,
          phone: phone.trim(),
          password: hashed,
          role: "USER",
          address: address?.trim() || null,
          addressDetail: addressDetail?.trim() || null,
        },
      });

      await prisma.memberProfile.create({
        data: {
          userId: user.id,
          handicap: handicap?.trim() || null,
          avg: avg?.trim() || null,
          avgProofUrl: avgProofUrl || null,
          avgProofExpiresAt: expiresAt,
        },
      });

      return NextResponse.json({ ok: true, userId: user.id });
    } catch (dbError) {
      console.error("[signup] DB error (create):", dbError);
      if (isDbConnectionError(dbError)) {
        return NextResponse.json(
          {
            error:
              "데이터베이스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          },
          { status: 503 }
        );
      }
      throw dbError;
    }
  } catch (e) {
    console.error("[signup] error:", e);
    return NextResponse.json(
      {
        error:
          "회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 }
    );
  }
}
