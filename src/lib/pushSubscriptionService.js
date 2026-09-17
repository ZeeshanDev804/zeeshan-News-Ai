// ========================================
// ZEESHAN NEWS AI — PUSH SUBSCRIPTION SERVICE
// ========================================

import {
  validatePushSubscription,
  createNotificationPreferences,
} from "./notificationService.js";


// ========================================
// SAVE SUBSCRIPTION
// ========================================

export async function savePushSubscription(
  db,
  subscription,
  preferences = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const validation =
    validatePushSubscription(
      subscription
    );

  if (!validation.valid) {
    throw new Error(
      validation.errors.join("; ")
    );
  }

  const normalizedPreferences =
    createNotificationPreferences(
      preferences
    );

  const {
    endpoint,
    keys,
  } = validation.subscription;

  const result =
    await db.query(
      `
      INSERT INTO push_subscriptions
        (
          endpoint,
          p256dh,
          auth,
          enabled,
          new_news,
          trending_news,
          breaking_news,
          frequency,
          updated_at
        )
      VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          CURRENT_TIMESTAMP
        )
      ON CONFLICT (endpoint)
      DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        enabled = EXCLUDED.enabled,
        new_news = EXCLUDED.new_news,
        trending_news = EXCLUDED.trending_news,
        breaking_news = EXCLUDED.breaking_news,
        frequency = EXCLUDED.frequency,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id,
        endpoint,
        enabled,
        new_news,
        trending_news,
        breaking_news,
        frequency,
        created_at,
        updated_at
      `,
      [
        endpoint,
        keys.p256dh,
        keys.auth,
        normalizedPreferences.enabled,
        normalizedPreferences.newNews,
        normalizedPreferences.trendingNews,
        normalizedPreferences.breakingNews,
        normalizedPreferences.frequency,
      ]
    );

  return {
    success: true,
    subscription:
      result.rows[0],
  };
}


// ========================================
// UNSUBSCRIBE
// ========================================

export async function removePushSubscription(
  db,
  endpoint
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const safeEndpoint =
    String(
      endpoint ?? ""
    ).trim();

  if (!safeEndpoint) {
    throw new Error(
      "Push endpoint is required"
    );
  }

  const result =
    await db.query(
      `
      DELETE FROM push_subscriptions
      WHERE endpoint = $1
      RETURNING id, endpoint
      `,
      [
        safeEndpoint,
      ]
    );

  return {
    success: true,

    removed:
      result.rowCount > 0,

    subscription:
      result.rows[0] || null,
  };
}


// ========================================
// DISABLE SUBSCRIPTION
// ========================================

export async function disablePushSubscription(
  db,
  endpoint
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const safeEndpoint =
    String(
      endpoint ?? ""
    ).trim();

  if (!safeEndpoint) {
    throw new Error(
      "Push endpoint is required"
    );
  }

  const result =
    await db.query(
      `
      UPDATE push_subscriptions
      SET
        enabled = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE endpoint = $1
      RETURNING
        id,
        endpoint,
        enabled,
        updated_at
      `,
      [
        safeEndpoint,
      ]
    );

  return {
    success: true,

    updated:
      result.rowCount > 0,

    subscription:
      result.rows[0] || null,
  };
}


// ========================================
// UPDATE PREFERENCES
// ========================================

export async function updatePushPreferences(
  db,
  endpoint,
  preferences = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const safeEndpoint =
    String(
      endpoint ?? ""
    ).trim();

  if (!safeEndpoint) {
    throw new Error(
      "Push endpoint is required"
    );
  }

  const normalized =
    createNotificationPreferences(
      preferences
    );

  const result =
    await db.query(
      `
      UPDATE push_subscriptions
      SET
        enabled = $1,
        new_news = $2,
        trending_news = $3,
        breaking_news = $4,
        frequency = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE endpoint = $6
      RETURNING
        id,
        endpoint,
        enabled,
        new_news,
        trending_news,
        breaking_news,
        frequency,
        updated_at
      `,
      [
        normalized.enabled,
        normalized.newNews,
        normalized.trendingNews,
        normalized.breakingNews,
        normalized.frequency,
        safeEndpoint,
      ]
    );

  return {
    success: true,

    updated:
      result.rowCount > 0,

    subscription:
      result.rows[0] || null,
  };
}


// ========================================
// GET ACTIVE SUBSCRIPTIONS
// ========================================

export async function getActivePushSubscriptions(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const result =
    await db.query(
      `
      SELECT
        id,
        endpoint,
        p256dh,
        auth,
        enabled,
        new_news,
        trending_news,
        breaking_news,
        frequency,
        created_at,
        updated_at
      FROM push_subscriptions
      WHERE enabled = TRUE
      ORDER BY updated_at DESC
      `
    );

  return result.rows;
}


// ========================================
// GET SUBSCRIPTION
// ========================================

export async function getPushSubscription(
  db,
  endpoint
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const safeEndpoint =
    String(
      endpoint ?? ""
    ).trim();

  if (!safeEndpoint) {
    throw new Error(
      "Push endpoint is required"
    );
  }

  const result =
    await db.query(
      `
      SELECT
        id,
        endpoint,
        p256dh,
        auth,
        enabled,
        new_news,
        trending_news,
        breaking_news,
        frequency,
        created_at,
        updated_at
      FROM push_subscriptions
      WHERE endpoint = $1
      LIMIT 1
      `,
      [
        safeEndpoint,
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}


// ========================================
// CLEAN INVALID SUBSCRIPTION
// ========================================

export async function deleteInvalidPushSubscription(
  db,
  endpoint
) {
  return removePushSubscription(
    db,
    endpoint
  );
}
