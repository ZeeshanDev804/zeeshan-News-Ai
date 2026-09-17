// ========================================
// ZEESHAN NEWS AI — NEWS NOTIFICATION SERVICE
// ========================================

import {
  createNotificationPayload,
  shouldSendNotification,
  getFrequencyLimit,
} from "./notificationService.js";

import {
  getActivePushSubscriptions,
} from "./pushSubscriptionService.js";

import {
  sendPushToSubscriptions,
} from "./webPushSender.js";


// ========================================
// CHECK RECENT NOTIFICATION COUNT
// ========================================

async function getRecentNotificationCount(
  db,
  endpoint,
  windowMinutes
) {
  const result =
    await db.query(
      `
      SELECT
        COUNT(*)::INTEGER AS count
      FROM notification_logs
      WHERE
        endpoint = $1
        AND created_at >=
          CURRENT_TIMESTAMP -
          ($2 * INTERVAL '1 minute')
      `,
      [
        endpoint,
        windowMinutes,
      ]
    );

  return Number(
    result.rows[0]?.count ||
      0
  );
}


// ========================================
// SAVE NOTIFICATION LOG
// ========================================

async function saveNotificationLog(
  db,
  endpoint,
  notification,
  status
) {
  await db.query(
    `
    INSERT INTO notification_logs
      (
        endpoint,
        notification_type,
        title,
        body,
        url,
        status,
        created_at
      )
    VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        CURRENT_TIMESTAMP
      )
    `,
    [
      endpoint,
      notification.type,
      notification.title,
      notification.body,
      notification.url,
      status,
    ]
  );
}


// ========================================
// BUILD NEWS NOTIFICATION
// ========================================

export function createNewsNotification(
  article,
  type = "newNews"
) {
  const title =
    article?.title ||
    "New news available";

  const source =
    article?.source ||
    "ZEESHAN NEWS AI";

  const body =
    article?.ai_summary ||
    article?.description ||
    `New news from ${source}`;

  const articleId =
    article?.id;

  const url =
    articleId
      ? `/article.html?id=${articleId}`
      : "/";

  return createNotificationPayload({
    title,
    body,
    url,
    type,
  });
}


// ========================================
// SEND NEWS NOTIFICATION
// ========================================

export async function notifyAboutNews(
  db,
  article,
  type = "newNews"
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!article) {
    throw new Error(
      "Article is required"
    );
  }

  const notification =
    createNewsNotification(
      article,
      type
    );

  const subscriptions =
    await getActivePushSubscriptions(
      db
    );

  const eligibleSubscriptions =
    [];

  for (
    const subscription
    of subscriptions
  ) {
    const preferences = {
      enabled:
        subscription.enabled,

      newNews:
        subscription.new_news,

      trendingNews:
        subscription.trending_news,

      breakingNews:
        subscription.breaking_news,

      frequency:
        subscription.frequency,
    };

    const eligibility =
      shouldSendNotification(
        preferences,
        {
          type,
        }
      );

    if (
      !eligibility.send
    ) {
      continue;
    }

    const frequency =
      getFrequencyLimit(
        subscription.frequency
      );

    const recentCount =
      await getRecentNotificationCount(
        db,
        subscription.endpoint,
        frequency.windowMinutes
      );

    if (
      recentCount >=
      frequency.maxNotifications
    ) {
      continue;
    }

    eligibleSubscriptions.push(
      subscription
    );
  }

  if (
    eligibleSubscriptions.length ===
    0
  ) {
    return {
      success: true,

      message:
        "No eligible subscribers",

      attempted: 0,

      sent: 0,
    };
  }

  const result =
    await sendPushToSubscriptions(
      db,
      eligibleSubscriptions,
      notification
    );

  for (
    const subscription
    of eligibleSubscriptions
  ) {
    const wasSent =
      result.report.sent >
      0;

    await saveNotificationLog(
      db,
      subscription.endpoint,
      notification,
      wasSent
        ? "sent"
        : "failed"
    );
  }

  return {
    success:
      result.success,

    notification,

    ...result.report,
  };
}


// ========================================
// CLEAN OLD NOTIFICATION LOGS
// ========================================

export async function cleanupNotificationLogs(
  db,
  days = 30
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const safeDays =
    Math.min(
      Math.max(
        Number(days) || 30,
        1
      ),
      365
    );

  const result =
    await db.query(
      `
      DELETE FROM notification_logs
      WHERE created_at <
        CURRENT_TIMESTAMP -
        ($1 * INTERVAL '1 day')
      `,
      [
        safeDays,
      ]
    );

  return {
    success: true,

    deleted:
      result.rowCount,
  };
}
