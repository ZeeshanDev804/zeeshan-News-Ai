// ========================================
// ZEESHAN NEWS AI — NOTIFICATION MANAGER
// ========================================

const NotificationManager = (() => {
  let currentSubscription = null;

  // ========================================
  // CHECK SUPPORT
  // ========================================

  function isSupported() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  // ========================================
  // GET STATUS
  // ========================================

  async function getStatus() {
    const response =
      await fetch(
        "/api/notifications/status"
      );

    if (!response.ok) {
      throw new Error(
        "Failed to load notification status"
      );
    }

    return response.json();
  }

  // ========================================
  // REGISTER SERVICE WORKER
  // ========================================

  async function registerServiceWorker() {
    if (!isSupported()) {
      throw new Error(
        "Push notifications are not supported by this browser"
      );
    }

    const registration =
      await navigator.serviceWorker.register(
        "/sw.js",
        {
          scope: "/",
        }
      );

    await navigator.serviceWorker.ready;

    return registration;
  }

  // ========================================
  // GET EXISTING SUBSCRIPTION
  // ========================================

  async function getExistingSubscription(
    registration
  ) {
    return registration.pushManager.getSubscription();
  }

  // ========================================
  // CONVERT VAPID KEY
  // ========================================

  function urlBase64ToUint8Array(
    base64String
  ) {
    const padding =
      "=".repeat(
        (4 -
          (base64String.length %
            4)) %
          4
      );

    const base64 =
      (
        base64String +
        padding
      )
        .replace(
          /-/g,
          "+"
        )
        .replace(
          /_/g,
          "/"
        );

    const rawData =
      window.atob(
        base64
      );

    const outputArray =
      new Uint8Array(
        rawData.length
      );

    for (
      let index = 0;
      index <
      rawData.length;
      index++
    ) {
      outputArray[index] =
        rawData.charCodeAt(
          index
        );
    }

    return outputArray;
  }

  // ========================================
  // REQUEST PERMISSION
  // ========================================

  async function requestPermission() {
    if (!isSupported()) {
      return {
        granted: false,
        permission:
          "unsupported",
      };
    }

    const permission =
      await Notification.requestPermission();

    return {
      granted:
        permission === "granted",

      permission,
    };
  }

  // ========================================
  // SUBSCRIBE
  // ========================================

  async function subscribe(
    preferences = {}
  ) {
    if (!isSupported()) {
      throw new Error(
        "Push notifications are not supported"
      );
    }

    const permission =
      await requestPermission();

    if (
      !permission.granted
    ) {
      throw new Error(
        "Notification permission was not granted"
      );
    }

    const status =
      await getStatus();

    if (
      !status.configured ||
      !status.publicKey
    ) {
      throw new Error(
        "Web Push is not configured on the server"
      );
    }

    const registration =
      await registerServiceWorker();

    let subscription =
      await getExistingSubscription(
        registration
      );

    if (!subscription) {
      subscription =
        await registration.pushManager.subscribe(
          {
            userVisibleOnly:
              true,

            applicationServerKey:
              urlBase64ToUint8Array(
                status.publicKey
              ),
          }
        );
    }

    currentSubscription =
      subscription;

    const response =
      await fetch(
        "/api/notifications/subscribe",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            subscription,
            preferences,
          }),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Failed to save push subscription"
      );
    }

    return {
      success: true,

      subscription,

      server:
        result,
    };
  }

  // ========================================
  // UNSUBSCRIBE
  // ========================================

  async function unsubscribe() {
    if (!isSupported()) {
      return {
        success: false,
        reason:
          "Push notifications are not supported",
      };
    }

    const registration =
      await navigator.serviceWorker.getRegistration(
        "/"
      );

    if (!registration) {
      return {
        success: true,
        removed: false,
      };
    }

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      currentSubscription =
        null;

      return {
        success: true,
        removed: false,
      };
    }

    const endpoint =
      subscription.endpoint;

    const response =
      await fetch(
        "/api/notifications/unsubscribe",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            endpoint,
          }),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Failed to unsubscribe"
      );
    }

    await subscription.unsubscribe();

    currentSubscription =
      null;

    return result;
  }

  // ========================================
  // DISABLE WITHOUT REMOVING
  // ========================================

  async function disable() {
    if (!isSupported()) {
      return {
        success: false,
        reason:
          "Push notifications are not supported",
      };
    }

    const registration =
      await navigator.serviceWorker.getRegistration(
        "/"
      );

    if (!registration) {
      return {
        success: true,
        updated: false,
      };
    }

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return {
        success: true,
        updated: false,
      };
    }

    const response =
      await fetch(
        "/api/notifications/disable",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            endpoint:
              subscription.endpoint,
          }),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Failed to disable notifications"
      );
    }

    return result;
  }

  // ========================================
  // UPDATE PREFERENCES
  // ========================================

  async function updatePreferences(
    preferences = {}
  ) {
    if (!isSupported()) {
      throw new Error(
        "Push notifications are not supported"
      );
    }

    const registration =
      await navigator.serviceWorker.getRegistration(
        "/"
      );

    if (!registration) {
      throw new Error(
        "Notification service worker is not registered"
      );
    }

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      throw new Error(
        "No push subscription found"
      );
    }

    const response =
      await fetch(
        "/api/notifications/preferences",
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            endpoint:
              subscription.endpoint,

            preferences,
          }),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Failed to update notification preferences"
      );
    }

    return result;
  }

  // ========================================
  // GET CURRENT SUBSCRIPTION
  // ========================================

  async function getSubscription() {
    if (!isSupported()) {
      return null;
    }

    const registration =
      await navigator.serviceWorker.getRegistration(
        "/"
      );

    if (!registration) {
      return null;
    }

    const subscription =
      await registration.pushManager.getSubscription();

    currentSubscription =
      subscription;

    return subscription;
  }

  // ========================================
  // PUBLIC API
  // ========================================

  return {
    isSupported,
    getStatus,
    registerServiceWorker,
    requestPermission,
    subscribe,
    unsubscribe,
    disable,
    updatePreferences,
    getSubscription,
  };
})();
in

// ========================================
// GLOBAL ACCESS
// ========================================

window.ZeeshanNotifications =
  NotificationManager;
