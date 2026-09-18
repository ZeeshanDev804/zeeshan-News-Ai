import webpush, {
  getVapidPublicKey,
} from "./pushConfig.js";

import {
  getActivePushSubscriptions,
  markPushNotified,
} from "./pushSubscriptions.js";

function normalizeValue(
  value,
  fallback = ""
) {
  return String(
    value ?? fallback
  ).trim();
}

function buildPayload(
  notification = {}
) {
  const title =
    normalizeValue(
      notification.title,
      "ZEESHAN NEWS AI"
    );

  const body =
    normalizeValue(
      notification.body,
      "New news update is available."
    );

  const url =
    normalizeValue(
      notification.url,
      "/"
    );

  return JSON.stringify({
    title,

    body,

    url,

    icon:
      "/icon-192.png",

    badge:
      "/icon-192.png",

    timestamp:
      Date.now(),

    data: {
      url,
    },
  });
}

function isBreakingAllowed(
  subscription
) {
  return (
    subscription.breaking_news ===
    true
  );
}

function isTrendingAllowed(
  subscription
) {
  return (
    subscription.trending_news ===
    true
  );
}

function shouldSend(
  subscription,
  type
) {
  if (
    subscription.enabled !== true
  ) {
    return false;
  }

  if (
    type === "breaking" &&
    !isBreakingAllowed(
      subscription
    )
  ) {
    return false;
  }

  if (
    type === "trending" &&
    !isTrendingAllowed(
      subscription
    )
  ) {
    return false;
  }

  return true;
}

export async function sendPushNotification(
  db,
  notification = {},
  type = "general"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const publicKey =
    getVapidPublicKey();

  if (!publicKey) {
    throw new Error(
      "VAPID public key is not configured"
    );
  }

  const subscriptions =
    await getActivePushSubscriptions(
      db
    );

  const payload =
    buildPayload(
      notification
    );

  const report = {
    success: true,

    type,

    total:
      subscriptions.length,

    sent: 0,

    skipped: 0,

    removed: 0,

    failed: 0,

    errors: [],
  };

  for (
    const subscription of subscriptions
  ) {
    if (
      !shouldSend(
        subscription,
        type
      )
    ) {
      report.skipped++;

      continue;
    }

    const pushSubscription = {
      endpoint:
        subscription.endpoint,

      keys: {
        p256dh:
          subscription.p256dh,

        auth:
          subscription.auth,
      },
    };

    try {
      await webpush.sendNotification(
        pushSubscription,
        payload
      );

      await markPushNotified(
        db,
        subscription.id
      );

      report.sent++;

    } catch (error) {
      report.failed++;

      const statusCode =
        Number(
          error?.statusCode
        );

      const errorMessage =
        normalizeValue(
          error?.message,
          "Push notification failed"
        ).slice(
          0,
          500
        );

      if (
        statusCode === 404 ||
        statusCode === 410
      ) {
        try {
          await db.query(
            `
            UPDATE push_subscriptions
            SET
              enabled = FALSE,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [
              subscription.id,
            ]
          );

          report.removed++;

        } catch (
          cleanupError
        ) {
          report.errors.push({
            id:
              subscription.id,

            error:
              cleanupError.message,
          });
        }
      } else {
        report.errors.push({
          id:
            subscription.id,

          error:
            errorMessage,
        });
      }
    }
  }

  return report;
}

export async function sendBreakingNewsNotification(
  db,
  title,
  body,
  url = "/"
) {
  return sendPushNotification(
    db,
    {
      title,
      body,
      url,
    },
    "breaking"
  );
}

export async function sendTrendingNewsNotification(
  db,
  title,
  body,
  url = "/"
) {
  return sendPushNotification(
    db,
    {
      title,
      body,
      url,
    },
    "trending"
  );
}
