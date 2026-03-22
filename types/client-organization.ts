/**
 * 클라이언트 운영 콘솔에서 다루는 조직.
 * DB의 `Organization`과 1:1이며, 콘솔 전용 표현·권한 필드를 붙인 값 객체입니다.
 */
export type ClientOrganizationAccessRole = "OWNER" | "ADMIN" | "MEMBER";

export type ClientOrganization = {
  id: string;
  name: string;
  slug: string | null;
  type: string;
  /**
   * 이 사용자 기준 콘솔 접근 등급.
   * `OrganizationMember.role` 및 소유자(ownerUserId)를 반영합니다.
   * 이후 조직별 세분 권한은 별도 필드/테이블로 확장 가능.
   */
  accessRole: ClientOrganizationAccessRole;
};

/**
 * 사용자–조직 연결의 도메인 표현.
 * DB의 `OrganizationMember`와 대응합니다.
 */
export type ClientOrganizationMember = {
  organizationId: string;
  userId: string;
  role: string;
  status: string;
};
