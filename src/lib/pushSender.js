import webpush, {
  configureWebPush,
  isPushConfigured,
} from "./pushConfig.js";

import {
  getActivePushSubscriptions,
  markPushNotified,
  disablePushSubscription,
} from "./pushSubscriptions.js";

function canSendByFrequency(
  subscription
) {
  const limit = Number(
    subscription.frequency_limit ?? 10
  );

  if (limit <= 0) {
    return true;
  }

  if (!subscription.last_notified_at) {
    return true;
  }

  const lastNotified =
    new Date(
      subscription.last_notified_at
    ).getTime();

  if (Number.isNaN(lastNotified)) {
    return true;
  }

  const now = Date.now();

  const minimumInterval =
    (24 * 60 * 60 * 1000) / limit;

  return (
    now - lastNotified >=
    minimumInterval
  );
}

function shouldReceiveNotification(
  subscription,
  type
) {
  if (!subscription.enabled) {
    return false;
  }

  if (
    type === "breaking" &&
    !subscription.breaking_news
  ) {
    return false;
  }

  if (
    type === "trending" &&
    !subscription.trending_news
  ) {
    return false;
  }

  return canSendByFrequency(
    subscription
  );
}

export async function sendPushNotification(
  db,
  payload = {},
  type = "general"
) {
  if (!isPushConfigured()) {
    throw new Error(
      "Web Push is not configured. Check VAPID environment variables."
    );
  }

  configureWebPush();

  const subscriptions =
    await getActivePushSubscriptions(
      db
    );

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let disabled = 0;

  for (const subscription of subscriptions) {
    if (
      !shouldReceiveNotification(
        subscription,
        type
      )
    ) {
      skipped++;
      continue;
    }

    const notification = {
      title:
        payload.title ||
        "ZEESHAN NEWS AI",

      body:
        payload.body ||
        "New news update is available.",

      icon:
        payload.icon ||
        "/icon-192.png",

      badge:
        payload.badge ||
        "/icon-192.png",

      timestamp:
        payload.timestamp ||
        Date.now(),

      tag:
        payload.tag ||
        `zeeshan-news-${type}`,

      url:
        payload.url ||
        "/",
    };

    try {
      await webpush.sendNotification(
        {
          endpoint:
            subscription.endpoint,

          keys: {
            p256dh:
              subscription.p256dh,

            auth:
              subscription.auth,
          },
        },
        JSON.stringify(
          notification
        )
      );

      await markPushNotified(
        db,
        subscription.endpoint
      );

      sent++;
    } catch (error) {
      failed++;

      const statusCode =
        error?.statusCode;

      console.error(
        "❌ Push notification failed:",
        statusCode,
        error.message
      );

      if (
        statusCode === 404 ||
        statusCode === 410
      ) {
        try {
          await disablePushSubscription(
            db,
            subscription.endpoint
          );

          disabled++;
        } catch (disableError) {
          console.error(
            "❌ Failed to disable dead subscription:",
            disableError.message
          );
        }
      }
    }
  }

  return {
    success: true,
    type,
    totalSubscriptions:
      subscriptions.length,
    sent,
    skipped,
    failed,
    disabled,
  };
}

export async function sendBreakingNews(
  db,
  payload = {}
) {
  return sendPushNotification(
    db,
    payload,
    "breaking"
  );
}

export async function sendTrendingNews(
  db,
  payload = {}
) {
  return sendPushNotification(
    db,
    payload,
    "trending"
  );
}

export async function sendGeneralNews(
  db,
  payload = {}
) {
  return sendPushNotification(
    db,
    payload,
    "general"
  );
}