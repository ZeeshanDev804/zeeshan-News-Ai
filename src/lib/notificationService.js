// ========================================
// ZEESHAN NEWS AI — NOTIFICATION SERVICE
// ========================================

const DEFAULT_PREFERENCES = {
  enabled: true,
  newNews: true,
  trendingNews: true,
  breakingNews: true,
  frequency: "limited",
};

const ALLOWED_FREQUENCIES = [
  "limited",
  "daily",
  "off",
];


// ========================================
// NORMALIZE VALUE
// ========================================

function normalizeString(
  value,
  fallback = ""
) {
  return String(
    value ?? fallback
  ).trim();
}


// ========================================
// NORMALIZE BOOLEAN
// ========================================

function normalizeBoolean(
  value,
  fallback
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  return fallback;
}


// ========================================
// NORMALIZE FREQUENCY
// ========================================

function normalizeFrequency(
  frequency
) {
  const value =
    normalizeString(
      frequency,
      DEFAULT_PREFERENCES.frequency
    ).toLowerCase();

  if (
    !ALLOWED_FREQUENCIES.includes(
      value
    )
  ) {
    return DEFAULT_PREFERENCES.frequency;
  }

  return value;
}


// ========================================
// CREATE PREFERENCES
// ========================================

export function createNotificationPreferences(
  preferences = {}
) {
  return {
    enabled:
      normalizeBoolean(
        preferences.enabled,
        DEFAULT_PREFERENCES.enabled
      ),

    newNews:
      normalizeBoolean(
        preferences.newNews,
        DEFAULT_PREFERENCES.newNews
      ),

    trendingNews:
      normalizeBoolean(
        preferences.trendingNews,
        DEFAULT_PREFERENCES.trendingNews
      ),

    breakingNews:
      normalizeBoolean(
        preferences.breakingNews,
        DEFAULT_PREFERENCES.breakingNews
      ),

    frequency:
      normalizeFrequency(
        preferences.frequency
      ),
  };
}


// ========================================
// CHECK WEB PUSH CONFIGURATION
// ========================================

export function isWebPushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}


// ========================================
// GET PUBLIC VAPID KEY
// ========================================

export function getPublicVapidKey() {
  const key =
    normalizeString(
      process.env.VAPID_PUBLIC_KEY
    );

  if (!key) {
    return null;
  }

  return key;
}


// ========================================
// VALIDATE PUSH SUBSCRIPTION
// ========================================

export function validatePushSubscription(
  subscription = {}
) {
  const endpoint =
    normalizeString(
      subscription.endpoint
    );

  const keys =
    subscription.keys || {};

  const p256dh =
    normalizeString(
      keys.p256dh
    );

  const auth =
    normalizeString(
      keys.auth
    );

  const errors = [];

  if (!endpoint) {
    errors.push(
      "Push endpoint is required"
    );
  }

  if (!p256dh) {
    errors.push(
      "Push p256dh key is required"
    );
  }

  if (!auth) {
    errors.push(
      "Push auth key is required"
    );
  }

  return {
    valid:
      errors.length === 0,

    errors,

    subscription: {
      endpoint,
      keys: {
        p256dh,
        auth,
      },
    },
  };
}


// ========================================
// NOTIFICATION ELIGIBILITY
// ========================================

export function shouldSendNotification(
  preferences = {},
  notification = {}
) {
  const normalized =
    createNotificationPreferences(
      preferences
    );

  if (
    !normalized.enabled
  ) {
    return {
      send: false,
      reason:
        "Notifications are disabled",
    };
  }

  if (
    normalized.frequency ===
    "off"
  ) {
    return {
      send: false,
      reason:
        "Notification frequency is disabled",
    };
  }

  const type =
    normalizeString(
      notification.type,
      "newNews"
    ).toLowerCase();

  if (
    type ===
    "newnews" &&
    !normalized.newNews
  ) {
    return {
      send: false,
      reason:
        "New-news notifications are disabled",
    };
  }

  if (
    type ===
    "trendingnews" &&
    !normalized.trendingNews
  ) {
    return {
      send: false,
      reason:
        "Trending-news notifications are disabled",
    };
  }

  if (
    type ===
    "breakingnews" &&
    !normalized.breakingNews
  ) {
    return {
      send: false,
      reason:
        "Breaking-news notifications are disabled",
    };
  }

  return {
    send: true,
    reason:
      "Notification is allowed",
  };
}


// ========================================
// FREQUENCY LIMIT
// ========================================

export function getFrequencyLimit(
  frequency
) {
  const normalized =
    normalizeFrequency(
      frequency
    );

  if (
    normalized === "off"
  ) {
    return {
      maxNotifications: 0,
      windowMinutes: 1440,
    };
  }

  if (
    normalized === "daily"
  ) {
    return {
      maxNotifications: 3,
      windowMinutes: 1440,
    };
  }

  return {
    maxNotifications: 5,
    windowMinutes: 60,
  };
}


// ========================================
// NOTIFICATION PAYLOAD
// ========================================

export function createNotificationPayload(
  notification = {}
) {
  const title =
    normalizeString(
      notification.title,
      "ZEESHAN NEWS AI"
    );

  const body =
    normalizeString(
      notification.body,
      "New news is available."
    );

  const url =
    normalizeString(
      notification.url,
      "/"
    );

  const type =
    normalizeString(
      notification.type,
      "newNews"
    );

  return {
    title,

    body,

    url,

    type,

    timestamp:
      new Date().toISOString(),
  };
}


// ========================================
// SAFE PREFERENCES UPDATE
// ========================================

export function updateNotificationPreferences(
  current = {},
  updates = {}
) {
  return createNotificationPreferences({
    ...createNotificationPreferences(
      current
    ),

    ...updates,
  });
}


// ========================================
// DEFAULT EXPORT HELPERS
// ========================================

export {
  DEFAULT_PREFERENCES,
  ALLOWED_FREQUENCIES,
};
