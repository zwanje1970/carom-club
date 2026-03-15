/**
 * Web Push Service Worker
 * - push 이벤트 수신 시 알림 표시
 * - 알림 클릭 시 payload.url로 이동 (같은 origin이면 해당 경로, 아니면 절대 URL)
 */
self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "알림", body: event.data.text() || "" };
  }
  const title = data.title || "CAROM.CLUB";
  const body = data.body || "";
  const url = data.url || "/";
  const options = {
    body: body,
    data: { url: url },
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  const fullUrl = url.startsWith("http") ? url : self.location.origin + (url.startsWith("/") ? url : "/" + url);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url && clientList[i].focus) {
          clientList[i].navigate(fullUrl);
          return clientList[i].focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
    })
  );
});
