function normalizeBoolean(
  value,
  fallback
) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function normalizeFrequencyLimit(
  value,
  fallback = 10
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return fallback;
  }

  return Math.min(
    50,
    Math.max(1, Math.floor(number))
  );
}

function validateSubscription(
  subscription
) {
  if (
    !subscription ||
    typeof subscription !== "object"
  ) {
    throw new Error(
      "Push subscription is required"
    );
  }

  if (
    !subscription.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth
  ) {
    throw new Error(
      "Invalid push subscription"
    );
  }

  return true;
}

export async function savePushSubscription(
  db,
  subscription,
  preferences = {},
  userAgent = null
) {
  validateSubscription(
    subscription
  );

  const endpoint =
    String(
      subscription.endpoint
    ).trim();

  const p256dh =
    String(
      subscription.keys.p256dh
    ).trim();

  const auth =
    String(
      subscription.keys.auth
    ).trim();

  const breakingNews =
    normalizeBoolean(
      preferences.breakingNews,
      true
    );

  const trendingNews =
    normalizeBoolean(
      preferences.trendingNews,
      true
    );

  const frequencyLimit =
    normalizeFrequencyLimit(
      preferences.frequencyLimit,
      10
    );

  const result =
    await db.query(
      `
      INSERT INTO push_subscriptions
        (
          endpoint,
          p256dh,
          auth,
          user_agent,
          enabled,
          breaking_news,
          trending_news,
          frequency_limit,
          updated_at
        )
      VALUES
        ($1, $2, $3, $4, TRUE, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (endpoint)
      DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        enabled = TRUE,
        breaking_news = EXCLUDED.breaking_news,
        trending_news = EXCLUDED.trending_news,
        frequency_limit = EXCLUDED.frequency_limit,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id,
        endpoint,
        enabled,
        breaking_news,
        trending_news,
        frequency_limit,
        created_at,
        updated_at
      `,
      [
        endpoint,
        p256dh,
        auth,
        userAgent,
        breakingNews,
        trendingNews,
        frequencyLimit,
      ]
    );

  return result.rows[0];
}

export async function disablePushSubscription(
  db,
  endpoint
) {
  if (
    !endpoint ||
    !String(endpoint).trim()
  ) {
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
        String(endpoint).trim(),
      ]
    );

  return (
    result.rows[0] || null
  );
}

export async function updatePushPreferences(
  db,
  endpoint,
  preferences = {}
) {
  if (
    !endpoint ||
    !String(endpoint).trim()
  ) {
    throw new Error(
      "Push endpoint is required"
    );
  }

  const existing =
    await db.query(
      `
      SELECT
        breaking_news,
        trending_news,
        frequency_limit
      FROM push_subscriptions
      WHERE endpoint = $1
      LIMIT 1
      `,
      [
        String(endpoint).trim(),
      ]
    );

  if (
    existing.rows.length === 0
  ) {
    throw new Error(
      "Push subscription not found"
    );
  }

  const current =
    existing.rows[0];

  const breakingNews =
    normalizeBoolean(
      preferences.breakingNews,
      current.breaking_news
    );

  const trendingNews =
    normalizeBoolean(
      preferences.trendingNews,
      current.trending_news
    );

  const frequencyLimit =
    normalizeFrequencyLimit(
      preferences.frequencyLimit,
      current.frequency_limit
    );

  const result =
    await db.query(
      `
      UPDATE push_subscriptions
      SET
        breaking_news = $1,
        trending_news = $2,
        frequency_limit = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE endpoint = $4
      RETURNING
        id,
        endpoint,
        enabled,
        breaking_news,
        trending_news,
        frequency_limit,
        updated_at
      `,
      [
        breakingNews,
        trendingNews,
        frequencyLimit,
        String(endpoint).trim(),
      ]
    );

  return result.rows[0];
}

export async function getActivePushSubscriptions(
  db
) {
  const result =
    await db.query(
      `
      SELECT
        id,
        endpoint,
        p256dh,
        auth,
        user_agent,
        enabled,
        breaking_news,
        trending_news,
        frequency_limit,
        last_notified_at,
        created_at,
        updated_at
      FROM push_subscriptions
      WHERE enabled = TRUE
      ORDER BY created_at DESC
      `
    );

  return result.rows;
}

export async function markPushNotified(
  db,
  endpoint
) {
  if (
    !endpoint ||
    !String(endpoint).trim()
  ) {
    return null;
  }

  const result =
    await db.query(
      `
      UPDATE push_subscriptions
      SET
        last_notified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE endpoint = $1
      RETURNING
        id,
        endpoint,
        last_notified_at
      `,
      [
        String(endpoint).trim(),
      ]
    );

  return (
    result.rows[0] || null
  );
}