function normalizeValue(
  value,
  fallback = ""
) {
  return String(
    value ?? fallback
  ).trim();
}

function normalizeBoolean(
  value,
  fallback
) {
  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  return fallback;
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

function validateSubscription(
  subscription
) {
  if (
    !subscription ||
    typeof subscription !==
      "object"
  ) {
    throw new Error(
      "Push subscription is required"
    );
  }

  const endpoint =
    normalizeValue(
      subscription.endpoint
    );

  const keys =
    subscription.keys || {};

  const p256dh =
    normalizeValue(
      keys.p256dh
    );

  const auth =
    normalizeValue(
      keys.auth
    );

  if (!endpoint) {
    throw new Error(
      "Push endpoint is required"
    );
  }

  if (!p256dh) {
    throw new Error(
      "Push p256dh key is required"
    );
  }

  if (!auth) {
    throw new Error(
      "Push auth key is required"
    );
  }

  return {
    endpoint,
    p256dh,
    auth,
  };
}

export async function savePushSubscription(
  db,
  subscription,
  preferences = {},
  userAgent = ""
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const normalized =
    validateSubscription(
      subscription
    );

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
    normalizeFrequency(
      preferences.frequencyLimit
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
        (
          $1,
          $2,
          $3,
          $4,
          TRUE,
          $5,
          $6,
          $7,
          CURRENT_TIMESTAMP
        )

      ON CONFLICT (endpoint)
      DO UPDATE SET
        p256dh =
          EXCLUDED.p256dh,

        auth =
          EXCLUDED.auth,

        user_agent =
          EXCLUDED.user_agent,

        enabled =
          TRUE,

        breaking_news =
          EXCLUDED.breaking_news,

        trending_news =
          EXCLUDED.trending_news,

        frequency_limit =
          EXCLUDED.frequency_limit,

        updated_at =
          CURRENT_TIMESTAMP

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
        normalized.endpoint,
        normalized.p256dh,
        normalized.auth,
        normalizeValue(
          userAgent
        ),
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
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const normalizedEndpoint =
    normalizeValue(
      endpoint
    );

  if (
    !normalizedEndpoint
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
        updated_at =
          CURRENT_TIMESTAMP
      WHERE
        endpoint = $1
      RETURNING
        id,
        endpoint,
        enabled,
        updated_at
      `,
      [
        normalizedEndpoint,
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

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

  const normalizedEndpoint =
    normalizeValue(
      endpoint
    );

  if (
    !normalizedEndpoint
  ) {
    throw new Error(
      "Push endpoint is required"
    );
  }

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
    normalizeFrequency(
      preferences.frequencyLimit
    );

  const result =
    await db.query(
      `
      UPDATE push_subscriptions
      SET
        breaking_news = $1,
        trending_news = $2,
        frequency_limit = $3,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE
        endpoint = $4
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
        normalizedEndpoint,
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

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
        user_agent,
        enabled,
        breaking_news,
        trending_news,
        frequency_limit,
        last_notified_at,
        created_at,
        updated_at
      FROM push_subscriptions
      WHERE
        enabled = TRUE
      ORDER BY
        updated_at DESC
      `
    );

  return result.rows;
}

export async function markPushNotified(
  db,
  subscriptionId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id =
    Number(subscriptionId);

  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    throw new Error(
      "Valid subscription ID is required"
    );
  }

  const result =
    await db.query(
      `
      UPDATE push_subscriptions
      SET
        last_notified_at =
          CURRENT_TIMESTAMP,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE
        id = $1
      RETURNING
        id,
        last_notified_at
      `,
      [id]
    );

  return (
    result.rows[0] ||
    null
  );
}
