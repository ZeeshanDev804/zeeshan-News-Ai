// ========================================
// ZEESHAN NEWS AI — PUSH SERVICE WORKER
// ========================================

self.addEventListener(
  "push",
  (event) => {
    let data = {};

    try {
      data =
        event.data
          ? event.data.json()
          : {};
    } catch {
      data = {
        title:
          "ZEESHAN NEWS AI",

        body:
          event.data
            ? event.data.text()
            : "New news is available.",

        url: "/",
      };
    }

    const title =
      data.title ||
      "ZEESHAN NEWS AI";

    const body =
      data.body ||
      "New news is available.";

    const url =
      data.url ||
      "/";

    const options = {
      body,

      icon:
        "/icon-192.png",

      badge:
        "/icon-192.png",

      data: {
        url,
      },

      tag:
        data.type ||
        "zeeshan-news",

      renotify: false,

      requireInteraction: false,
    };

    event.waitUntil(
      self.registration.showNotification(
        title,
        options
      )
    );
  }
);


// ========================================
// NOTIFICATION CLICK
// ========================================

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification?.data?.url ||
      "/";

    event.waitUntil(
      openNotificationUrl(
        targetUrl
      )
    );
  }
);


// ========================================
// OPEN OR FOCUS WEBSITE
// ========================================

async function openNotificationUrl(
  targetUrl
) {
  const absoluteUrl =
    new URL(
      targetUrl,
      self.location.origin
    ).href;

  const clientList =
    await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

  for (
    const client
    of clientList
  ) {
    if (
      "focus" in client
    ) {
      try {
        const clientUrl =
          new URL(
            client.url
          );

        if (
          clientUrl.origin ===
          self.location.origin
        ) {
          if (
            "navigate" in client &&
            client.url !==
              absoluteUrl
          ) {
            await client.navigate(
              absoluteUrl
            );
          }

          return client.focus();
        }
      } catch {
        // Ignore invalid client URLs.
      }
    }
  }

  if (
    self.clients.openWindow
  ) {
    return self.clients.openWindow(
      absoluteUrl
    );
  }

  return null;
}


// ========================================
// SERVICE WORKER INSTALL
// ========================================

self.addEventListener(
  "install",
  () => {
    self.skipWaiting();
  }
);


// ========================================
// SERVICE WORKER ACTIVATE
// ========================================

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      self.clients.claim()
    );
  }
);
