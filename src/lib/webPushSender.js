// ========================================
// ZEESHAN NEWS AI — WEB PUSH SENDER
// ========================================

import webpush from "web-push";

import {
  requireWebPushConfig,
} from "./webPushConfig.js";

import {
  getActivePushSubscriptions,
  deleteInvalidPushSubscription,
} from "./pushSubscriptionService.js";


// ========================================
// CONFIGURE WEB PUSH
// ========================================

let pushConfigured = false;

function configureWebPush() {
  if (pushConfigured) {
    return true;
  }

  const config =
    requireWebPushConfig();

  webpush.setVapidDetails(
    config.subject,
    config.publicKey,
    config.privateKey
  );

  pushConfigured = true;

  return true;
}


// ========================================
// SEND ONE NOTIFICATION
// ========================================

export async function sendPushNotification(
  subscription,
  payload
) {
  configureWebPush();

  if (!subscription) {
    throw new Error(
      "Push subscription is required"
    );
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

  const notificationPayload =
    JSON.stringify(
      payload
    );

  try {
    const result =
      await webpush.sendNotification(
        pushSubscription,
        notificationPayload
      );

    return {
      success: true,

      statusCode:
        result.statusCode || 201,
    };
  } catch (error) {
    const statusCode =
      Number(
        error?.statusCode
      );

    return {
      success: false,

      statusCode:
        Number.isFinite(
          statusCode
        )
          ? statusCode
          : null,

      error:
        error.message ||
        "Push notification failed",

      expired:
        statusCode === 404 ||
        statusCode === 410,
    };
  }
}


// ========================================
// SEND TO ALL ACTIVE USERS
// ========================================

export async function sendPushToAll(
  db,
  payload
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  configureWebPush();

  const subscriptions =
    await getActivePushSubscriptions(
      db
    );

  const report = {
    attempted:
      subscriptions.length,

    sent: 0,

    failed: 0,

    removed: 0,
  };

  for (
    const subscription
    of subscriptions
  ) {
    const result =
      await sendPushNotification(
        subscription,
        payload
      );

    if (result.success) {
      report.sent++;

      continue;
    }

    report.failed++;

    if (
      result.expired
    ) {
      try {
        await deleteInvalidPushSubscription(
          db,
          subscription.endpoint
        );

        report.removed++;
      } catch (cleanupError) {
        console.error(
          "❌ Failed to remove invalid push subscription:",
          cleanupError.message
        );
      }
    }
  }

  return {
    success:
      report.sent > 0 ||
      report.attempted === 0,

    report,
  };
}


// ========================================
// SEND TO SELECTED USERS
// ========================================

export async function sendPushToSubscriptions(
  db,
  subscriptions,
  payload
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  configureWebPush();

  if (
    !Array.isArray(
      subscriptions
    )
  ) {
    throw new Error(
      "Subscriptions must be an array"
    );
  }

  const report = {
    attempted:
      subscriptions.length,

    sent: 0,

    failed: 0,

    removed: 0,
  };

  for (
    const subscription
    of subscriptions
  ) {
    const result =
      await sendPushNotification(
        subscription,
        payload
      );

    if (result.success) {
      report.sent++;

      continue;
    }

    report.failed++;

    if (
      result.expired
    ) {
      try {
        await deleteInvalidPushSubscription(
          db,
          subscription.endpoint
        );

        report.removed++;
      } catch (cleanupError) {
        console.error(
          "❌ Failed to remove invalid push subscription:",
          cleanupError.message
        );
      }
    }
  }

  return {
    success:
      report.sent > 0 ||
      report.attempted === 0,

    report,
  };
}


// ========================================
// CHECK SENDER STATUS
// ========================================

export function isPushSenderConfigured() {
  try {
    configureWebPush();

    return true;
  } catch {
    return false;
  }
      }
