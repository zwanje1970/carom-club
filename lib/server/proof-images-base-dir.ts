import path from "path";

/**
 * 증빙·대회카드 배경 등 proof 이미지 파일의 공통 베이스 디렉터리.
 * 업로드(POST)와 GET(`/api/proof-images`, `/site-images`)이 동일 경로를 써야 한다.
 *
 * - 운영: 바이트는 Firebase Storage에만 두고, 이 경로는 **개발·레거시 디스크 읽기**에만 사용한다(/tmp 미사용).
 * - CAROM_PROOF_IMAGES_BASE: 로컬/스테이징에서 절대 경로 지정
 * - 그 외: `data/proof-images` (개발 기본)
 */
export function getProofImagesBaseDir(): string {
  const override = process.env.CAROM_PROOF_IMAGES_BASE?.trim();
  if (override) return path.resolve(override);
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "proof-images");
}
