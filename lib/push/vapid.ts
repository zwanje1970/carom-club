/**
 * Web Push VAPID keys. 배포 시 환경 변수로 설정.
 * 로컬 생성: npx web-push generate-vapid-keys
 */
export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null;
}

export function getVapidPrivateKey(): string | null {
  return process.env.VAPID_PRIVATE_KEY ?? null;
}

export function isPushConfigured(): boolean {
  return !!(getVapidPublicKey() && getVapidPrivateKey());
}
