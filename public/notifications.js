"use strict";

/*
========================================
ZEESHAN NEWS AI
WEB PUSH NOTIFICATIONS
========================================

- Explicit user permission only
- Subscribe / unsubscribe
- Preference handling
- Safe API requests
- Service worker registration
- No automatic permission popup
========================================
*/

const PUSH_API_BASE = "/api/push";

let pushRegistration = null;


/* ========================================
   HELPERS
======================================== */

function getPushElement(id) {
  return document.getElementById(id);
}


function setPushText(
  id,
  text
) {
  const element =
    getPushElement(id);

  if (element) {
    element.textContent =
      String(text ?? "");
  }
}


/* ========================================
   API
======================================== */

async function pushApi(
  endpoint,
  options = {}
) {
  const response =
    await fetch(
      PUSH_API_BASE + endpoint,
      {
        cache: "no-store",
        ...options,

        headers: {
          Accept:
            "application/json",

          ...(options.headers || {}),
        },
      }
    );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Push request failed: ${response.status}`
    );
  }

  return data;
}


/* ========================================
   SUPPORT CHECK
======================================== */

function isPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}


/* ========================================
   SERVICE WORKER
======================================== */

async function registerPushServiceWorker() {
  if (
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  try {
    pushRegistration =
      await navigator.serviceWorker.register(
        "/sw.js"
      );

    return pushRegistration;

  } catch (error) {
    console.error(
      "❌ Service worker registration failed:",
      error.message
    );

    return null;
  }
}


/* ========================================
   GET PUSH CONFIG
======================================== */

async function getPushConfig() {
  try {
    return await pushApi(
      "/config"
    );
  } catch (error) {
    console.error(
      "❌ Push config error:",
      error.message
    );

    return null;
  }
}


/* ========================================
   BASE64 URL → UINT8 ARRAY
======================================== */

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
    let i = 0;
    i < rawData.length;
    i++
  ) {
    outputArray[i] =
      rawData.charCodeAt(i);
  }

  return outputArray;
}


/* ========================================
   GET PUBLIC KEY
======================================== */

async function getPublicVapidKey() {
  const config =
    await getPushConfig();

  return (
    config?.publicKey ||
    config?.vapidPublicKey ||
    config?.VAPID_PUBLIC_KEY ||
    null
  );
}


/* ========================================
   SUBSCRIBE
======================================== */

async function subscribeToPush() {
  if (
    !isPushSupported()
  ) {
    setPushText(
      "pushStatus",
      "Push notifications are not supported on this browser."
    );

    return {
      success: false,
      reason:
        "unsupported",
    };
  }

  try {
    if (
      Notification.permission ===
      "denied"
    ) {
      setPushText(
        "pushStatus",
        "Notifications are blocked in browser settings."
      );

      return {
        success: false,
        reason:
          "permission_denied",
      };
    }

    /*
      Permission is requested only after
      explicit user action calling this function.
    */

    const permission =
      await Notification.requestPermission();

    if (
      permission !==
      "granted"
    ) {
      setPushText(
        "pushStatus",
        "Notification permission was not granted."
      );

      return {
        success: false,
        reason:
          "permission_not_granted",
      };
    }

    const registration =
      pushRegistration ||
      await registerPushServiceWorker();

    if (!registration) {
      throw new Error(
        "Service worker registration unavailable."
      );
    }

    const publicKey =
      await getPublicVapidKey();

    if (!publicKey) {
      throw new Error(
        "Push public key is not configured."
      );
    }

    let subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription =
        await registration.pushManager.subscribe(
          {
            userVisibleOnly:
              true,

            applicationServerKey:
              urlBase64ToUint8Array(
                publicKey
              ),
          }
        );
    }

    const result =
      await pushApi(
        "/subscribe",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              subscription:
                subscription.toJSON
                  ? subscription.toJSON()
                  : subscription,

              userAgent:
                navigator.userAgent,

              language:
                navigator.language,

              timezone:
                Intl.DateTimeFormat()
                  .resolvedOptions()
                  .timeZone,
            }),
        }
      );

    setPushText(
      "pushStatus",
      "Notifications enabled."
    );

    updatePushButtons(
      true
    );

    return {
      success: true,
      subscription,
      result,
    };

  } catch (error) {
    console.error(
      "❌ Push subscribe error:",
      error
    );

    setPushText(
      "pushStatus",
      error.message ||
      "Unable to enable notifications."
    );

    return {
      success: false,
      error:
        error.message,
    };
  }
}


/* ========================================
   UNSUBSCRIBE
======================================== */

async function unsubscribeFromPush() {
  if (
    !isPushSupported()
  ) {
    return {
      success: false,
      reason:
        "unsupported",
    };
  }

  try {
    const registration =
      pushRegistration ||
      await registerPushServiceWorker();

    if (!registration) {
      throw new Error(
        "Service worker registration unavailable."
      );
    }

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      setPushText(
        "pushStatus",
        "Notifications are already disabled."
      );

      updatePushButtons(
        false
      );

      return {
        success: true,
        alreadyUnsubscribed:
          true,
      };
    }

    const endpoint =
      subscription.endpoint;

    /*
      Tell backend first so the server can
      remove/deactivate the subscription.
    */

    try {
      await pushApi(
        "/unsubscribe",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              endpoint,
            }),
        }
      );
    } catch (error) {
      /*
        Local unsubscribe should still happen
        even if backend cleanup temporarily fails.
      */

      console.warn(
        "Push backend unsubscribe warning:",
        error.message
      );
    }

    await subscription.unsubscribe();

    setPushText(
      "pushStatus",
      "Notifications disabled."
    );

    updatePushButtons(
      false
    );

    return {
      success: true,
    };

  } catch (error) {
    console.error(
      "❌ Push unsubscribe error:",
      error.message
    );

    setPushText(
      "pushStatus",
      "Unable to disable notifications."
    );

    return {
      success: false,
      error:
        error.message,
    };
  }
}


/* ========================================
   CHECK CURRENT SUBSCRIPTION
======================================== */

async function getPushSubscriptionStatus() {
  if (
    !isPushSupported()
  ) {
    return {
      supported: false,
      subscribed: false,
    };
  }

  try {
    const registration =
      pushRegistration ||
      await registerPushServiceWorker();

    if (!registration) {
      return {
        supported: true,
        subscribed: false,
      };
    }

    const subscription =
      await registration.pushManager.getSubscription();

    return {
      supported: true,

      subscribed:
        Boolean(
          subscription
        ),

      permission:
        Notification.permission,

      subscription,
    };

  } catch (error) {
    console.error(
      "❌ Push status error:",
      error.message
    );

    return {
      supported: true,
      subscribed: false,
      permission:
        Notification.permission,
    };
  }
}


/* ========================================
   UPDATE UI
======================================== */

function updatePushButtons(
  subscribed
) {
  const subscribeButton =
    getPushElement(
      "enableNotifications"
    ) ||
    getPushElement(
      "enablePush"
    );

  const unsubscribeButton =
    getPushElement(
      "disableNotifications"
    ) ||
    getPushElement(
      "disablePush"
    );

  if (subscribeButton) {
    subscribeButton.disabled =
      Boolean(subscribed);

    subscribeButton.style.display =
      subscribed
        ? "none"
        : "";
  }

  if (unsubscribeButton) {
    unsubscribeButton.disabled =
      !subscribed;

    unsubscribeButton.style.display =
      subscribed
        ? ""
        : "none";
  }
}


/* ========================================
   INITIALIZE PUSH
======================================== */

async function initializePushNotifications() {
  if (
    !isPushSupported()
  ) {
    setPushText(
      "pushStatus",
      "Push notifications are not supported."
    );

    return;
  }

  const status =
    await getPushSubscriptionStatus();

  updatePushButtons(
    Boolean(
      status?.subscribed
    )
  );

  if (
    status?.subscribed
  ) {
    setPushText(
      "pushStatus",
      "Notifications are enabled."
    );
  } else if (
    status?.permission ===
    "denied"
  ) {
    setPushText(
      "pushStatus",
      "Notifications are blocked."
    );
  } else {
    setPushText(
      "pushStatus",
      "Notifications are available."
    );
  }
}


/* ========================================
   BUTTON EVENTS
======================================== */

function setupPushButtons() {
  const subscribeButtons =
    document.querySelectorAll(
      "#enableNotifications, #enablePush, [data-enable-push]"
    );

  subscribeButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        async () => {
          button.disabled =
            true;

          await subscribeToPush();

          button.disabled =
            false;
        }
      );
    }
  );


  const unsubscribeButtons =
    document.querySelectorAll(
      "#disableNotifications, #disablePush, [data-disable-push]"
    );

  unsubscribeButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        async () => {
          button.disabled =
            true;

          await unsubscribeFromPush();

          button.disabled =
            false;
        }
      );
    }
  );
}


/* ========================================
   START
======================================== */

async function initializeNotifications() {
  setupPushButtons();

  /*
    Registering the service worker is safe.
    Permission is NOT requested here.
  */

  await registerPushServiceWorker();

  await initializePushNotifications();
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeNotifications
  );
} else {
  initializeNotifications();
}


/* ========================================
   GLOBAL API
======================================== */

window.ZeeshanPush = {
  subscribe:
    subscribeToPush,

  unsubscribe:
    unsubscribeFromPush,

  status:
    getPushSubscriptionStatus,

  initialize:
    initializePushNotifications,
};