self.addEventListener(
  "push",
  (event) => {
    let data = {};

    try {
      data = event.data
        ? event.data.json()
        : {};
    } catch (error) {
      data = {
        title:
          "ZEESHAN NEWS AI",
        body:
          event.data
            ? event.data.text()
            : "New news update is available.",
        url: "/",
      };
    }

    const title =
      data.title ||
      "ZEESHAN NEWS AI";

    const options = {
      body:
        data.body ||
        "New news update is available.",

      icon:
        data.icon ||
        "/icon-192.png",

      badge:
        data.badge ||
        "/icon-192.png",

      timestamp:
        data.timestamp ||
        Date.now(),

      data: {
        url:
          data?.data?.url ||
          data.url ||
          "/",
      },

      vibrate: [
        200,
        100,
        200,
      ],

      tag:
        data.tag ||
        "zeeshan-news",

      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(
        title,
        options
      )
    );
  }
);

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification?.data?.url ||
      "/";

    event.waitUntil(
      clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      }).then((clientList) => {
        for (
          const client of clientList
        ) {
          if (
            "focus" in client
          ) {
            client.navigate(
              targetUrl
            );

            return client.focus();
          }
        }

        if (
          clients.openWindow
        ) {
          return clients.openWindow(
            targetUrl
          );
        }

        return undefined;
      })
    );
  }
);

self.addEventListener(
  "install",
  () => {
    self.skipWaiting();
  }
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      self.clients.claim()
    );
  }
);