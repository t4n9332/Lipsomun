// 입소문 서비스 워커 — 웹푸시 알림 처리
self.addEventListener("push", (event) => {
  let data = { title: "입소문", body: "새 소식이 도착했어요!", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // 이 SW 가 제어하지 않는 탭(includeUncontrolled)에 navigate() 를 부르면 reject 된다.
      // 그러면 알림 클릭이 통째로 실패하므로, 실패하면 새 창으로 연다.
      const c = list.find((w) => "focus" in w);
      if (!c) return clients.openWindow(url);
      return c
        .navigate(url)
        .then((w) => (w || c).focus())
        .catch(() => clients.openWindow(url));
    })
  );
});

// 빈 fetch 핸들러는 두지 않는다 — 설치 요건이 아니게 됐고, 있으면 모든 요청마다
// SW 를 깨워 네비게이션만 느려진다.

self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
