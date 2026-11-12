self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "CP Training", body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "CP Training", { body: data.body || "", data: { url: data.url || "/" }, icon: "/icon.svg", badge: "/icon.svg" }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});
