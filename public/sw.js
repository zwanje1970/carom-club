/* 비활성화: SW 등록 안 함. FCM 앱푸시로 전환. 파일만 유지. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", () => {
  /* 발송 단계에서 구현 */
});
