/**
 * 연동 설정은 lib/integration-settings.ts (DB + env)를 사용하세요.
 * 이 파일은 레거시 env 전용 체크가 필요할 때만 사용합니다.
 */
export function isNaverMapConfiguredFromEnv(): boolean {
  const id = process.env.NAVER_MAP_CLIENT_ID;
  return typeof id === "string" && id.trim().length > 0;
}
