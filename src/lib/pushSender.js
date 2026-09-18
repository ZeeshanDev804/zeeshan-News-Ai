import webpush, {
  configureWebPush,
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


function normalizeFrequency(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1
  ) {
    return 10;
  }

  return Math.min(
    number,
    50
  );
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

    tag:
      notification.tag ||
      "zeeshan-news",

    data: {
      url,
    },
  });
}


function isNotificationAllowed(
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
    subscription.breaking_news !== true
  ) {
    return false;
  }

  if (
    type === "trending" &&
    subscription.trending_news !== true
  ) {
    return false;
  }

  return true;
}


function isFrequencyAllowed(
  subscription
) {
  const frequencyLimit =
    normalizeFrequency(
      subscription.frequency_limit
    );

  if (
    !subscription.last_notified_at
  ) {
    return true;
  }

  const lastNotified =
    new Date(
      subscription.last_notified_at
    );

  if (
    Number.isNaN(
      lastNotified.getTime()
    )
  ) {
    return true;
  }

  /*
   * frequency_limit means
   * maximum notifications per hour.
   *
   * This prevents accidental
   * notification spam.
   */

  const minimumInterval =
    60 * 60 * 1000 /
    frequencyLimit;

  const elapsed =
    Date.now() -
    lastNotified.getTime();

  return (
    elapsed >=
    minimumInterval
  );
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

  /*
   * Configure web-push
   * only when an actual
   * notification is being sent.
   */

  configureWebPush();

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

    frequencyLimited: 0,

    removed: 0,

    failed: 0,

    errors: [],
  };


  for (
    const subscription of subscriptions
  ) {

    if (
      !isNotificationAllowed(
        subscription,
        type
      )
    ) {
      report.skipped++;

      continue;
    }


    if (
      !isFrequencyAllowed(
        subscription
      )
    ) {
      report.frequencyLimited++;

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


      /*
       * Browser push subscriptions
       * returning 404/410 are normally
       * no longer valid.
       */

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
            WHERE
              id = $1
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
      tag:
        "zeeshan-breaking-news",
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
      tag:
        "zeeshan-trending-news",
    },
    "trending"
  );
}