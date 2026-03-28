import { prisma } from "@/lib/db";
import { ALL_PERMISSION_KEYS } from "@/lib/auth/permissions";

type PermissionSeed = {
  key: string;
  label: string;
  category: string;
  description: string;
};

const RBAC_PERMISSIONS: PermissionSeed[] = [
  {
    key: "community.post.create",
    label: "커뮤니티 글 작성",
    category: "community",
    description: "커뮤니티 게시글 작성",
  },
  {
    key: "community.post.edit.own",
    label: "내 글 수정",
    category: "community",
    description: "본인 게시글 수정",
  },
  {
    key: "community.post.delete.own",
    label: "내 글 삭제",
    category: "community",
    description: "본인 게시글 삭제",
  },
  {
    key: "community.comment.create",
    label: "댓글 작성",
    category: "community",
    description: "커뮤니티 댓글 작성",
  },
  {
    key: "community.comment.edit.own",
    label: "내 댓글 수정",
    category: "community",
    description: "본인 댓글 수정",
  },
  {
    key: "community.comment.delete.own",
    label: "내 댓글 삭제",
    category: "community",
    description: "본인 댓글 삭제",
  },
  {
    key: "community.vote.like",
    label: "추천/좋아요",
    category: "community",
    description: "게시글/댓글 추천",
  },
  {
    key: "solver.solution.view",
    label: "해법 조회",
    category: "solver",
    description: "난구해결사 해법 조회",
  },
  {
    key: "solver.solution.create",
    label: "해법 작성",
    category: "solver",
    description: "난구해결사 해법 작성",
  },
  {
    key: "solver.solution.edit.own",
    label: "내 해법 수정",
    category: "solver",
    description: "본인 해법 수정",
  },
  {
    key: "solver.solution.delete.own",
    label: "내 해법 삭제",
    category: "solver",
    description: "본인 해법 삭제",
  },
  {
    key: "solver.solution.good",
    label: "해법 GOOD",
    category: "solver",
    description: "해법 GOOD 평가",
  },
  {
    key: "solver.solution.bad",
    label: "해법 BAD",
    category: "solver",
    description: "해법 BAD 평가",
  },
  {
    key: "solver.solution.accept",
    label: "해법 채택",
    category: "solver",
    description: "질문자의 해법 채택",
  },
  {
    key: "note.use",
    label: "당구노트 사용",
    category: "note",
    description: "당구노트 사용",
  },
  {
    key: "note.send_to_solver",
    label: "노트에서 난구해결로 보내기",
    category: "note",
    description: "노트를 난구해결사로 전송",
  },
  {
    key: "admin.access",
    label: "관리자 접근",
    category: "admin",
    description: "관리자 콘솔 접근",
  },
  {
    key: "admin.user.manage",
    label: "회원 관리",
    category: "admin",
    description: "회원 레벨/상태 관리",
  },
  {
    key: "admin.role.manage",
    label: "레벨(Role) 관리",
    category: "admin",
    description: "역할 조회/관리",
  },
  {
    key: "admin.permission.manage",
    label: "권한 관리",
    category: "admin",
    description: "레벨별 권한 저장",
  },
  {
    key: "admin.post.delete.any",
    label: "게시글 임의 삭제",
    category: "admin",
    description: "모든 게시글 삭제",
  },
  {
    key: "admin.solution.delete.any",
    label: "해법 임의 삭제",
    category: "admin",
    description: "모든 해법 삭제",
  },
  {
    key: "admin.user.ban",
    label: "회원 차단",
    category: "admin",
    description: "회원 정지/차단",
  },
];

const RBAC_ROLES = [
  {
    key: "USER",
    label: "일반회원",
    description: "기본 커뮤니티/해법 작성 권한",
  },
  {
    key: "CLIENT_ADMIN",
    label: "클라이언트 관리자",
    description: "클라이언트 콘솔 접근 권한",
  },
  {
    key: "ZONE_MANAGER",
    label: "권역 관리자",
    description: "권역 관리 권한",
  },
  {
    key: "PLATFORM_ADMIN",
    label: "플랫폼 관리자",
    description: "전체 관리자 권한",
  },
] as const;

let bootstrapPromise: Promise<void> | null = null;

export function ensureRbacBootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await prisma.permission.createMany({
        data: RBAC_PERMISSIONS.map((permission) => ({
          key: permission.key,
          label: permission.label,
          category: permission.category,
        })),
        skipDuplicates: true,
      });

      await Promise.all(
        RBAC_PERMISSIONS.map((permission) =>
          prisma.$executeRaw`
            UPDATE "Permission"
            SET "label" = ${permission.label}, "category" = ${permission.category}
            WHERE "key" = ${permission.key}
          `
        )
      );

      await prisma.role.createMany({
        data: RBAC_ROLES.map((role) => ({
          key: role.key,
          label: role.label,
          description: role.description,
          isSystem: true,
        })),
        skipDuplicates: true,
      });

      const [platformAdmin, permissions] = await Promise.all([
        prisma.role.findUnique({
          where: { key: "PLATFORM_ADMIN" },
          select: { id: true },
        }),
        prisma.permission.findMany({
          where: { key: { in: ALL_PERMISSION_KEYS } },
          select: { id: true },
        }),
      ]);

      if (!platformAdmin || permissions.length === 0) {
        return;
      }

      await prisma.$transaction(
        permissions.map((permission) =>
          prisma.$executeRaw`
            INSERT INTO "RolePermission" ("roleId", "permissionId")
            VALUES (${platformAdmin.id}, ${permission.id})
            ON CONFLICT ("roleId", "permissionId") DO NOTHING
          `
        )
      );
    })().finally(() => {
      bootstrapPromise = null;
    });
  }

  return bootstrapPromise;
}
