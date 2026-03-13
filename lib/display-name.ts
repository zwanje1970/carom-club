/**
 * 게시글/댓글/신청 등 작성자 표시 시 사용.
 * 탈퇴 회원은 "탈퇴회원"으로 통일 표시하고, 그 외에는 기존 이름을 사용합니다.
 */
export type UserForDisplay = {
  name: string;
  status?: string | null;
  withdrawnAt?: Date | string | null;
};

export function getDisplayName(user: UserForDisplay | null | undefined): string {
  if (!user) return "";
  if (user.withdrawnAt != null || user.status === "DELETED") return "탈퇴회원";
  return user.name ?? "";
}
