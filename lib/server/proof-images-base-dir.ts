import path from "path";

/**
 * 증빙·대회카드 배경 등 proof 이미지 파일의 공통 베이스 디렉터리.
 * 업로드(POST)와 GET(`/api/proof-images`, `/site-images`)이 동일 경로를 써야 한다.
 *
 * - CAROM_PROOF_IMAGES_BASE: 배포 환경에서 프로젝트 폴더가 읽기 전용일 때 절대 경로 지정
 * - VERCEL: 기본 배포 디스크가 쓰기 불가인 경우가 많아 /tmp 사용
 * - 그 외: `data/proof-images` (기존 동작)
 */
export function getProofImagesBaseDir(): string {
  const override = process.env.CAROM_PROOF_IMAGES_BASE?.trim();
  if (override) return path.resolve(override);
  if (process.env.VERCEL) {
    return path.join("/tmp", "carom-proof-images");
  }
  return path.join(process.cwd(), "data", "proof-images");
}
