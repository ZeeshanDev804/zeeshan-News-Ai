"use strict";

/*
==================================================
 ZEESHAN NEWS AI
 ANALYTICS ENGINE
==================================================

Purpose:
- Analytics event storage
- Page/article/search tracking
- Safe metadata handling
- IP hashing
- Analytics statistics
- Popular articles
- Popular pages
- Event summaries
==================================================
*/

import crypto from "crypto";


/* ==================================================
   CONFIG
================================================== */

const MAX_METADATA_SIZE = 10000;

const MAX_TEXT_LENGTH = 500;

const ALLOWED_EVENT_TYPES = new Set([
  "page_view",
  "article_view",
  "search",
  "category_view",
  "trending_view",
  "notification_click",
  "external_source_click",
]);


/* ==================================================
   ENSURE TABLE
================================================== */

export async function ensureAnalyticsTable(db) {
  if (!db || typeof db.query !== "function") {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,

      event_type TEXT NOT NULL,

      article_id INTEGER,

      page_path TEXT,

      source TEXT,

      metadata JSONB DEFAULT '{}'::jsonb,

      ip_hash TEXT,

      user_agent TEXT,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT fk_analytics_article
        FOREIGN KEY (article_id)
        REFERENCES articles(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_event_type
      ON analytics_events(event_type);

    CREATE INDEX IF NOT EXISTS idx_analytics_article_id
      ON analytics_events(article_id);

    CREATE INDEX IF NOT EXISTS idx_analytics_created_at
      ON analytics_events(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_analytics_page_path
      ON analytics_events(page_path);
  `);

  return {
    success: true,
  };
}


/* ==================================================
   NORMALIZE EVENT TYPE
================================================== */

function normalizeEventType(value) {
  const eventType =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    throw new Error(
      "Invalid analytics event type"
    );
  }

  return eventType;
}


/* ==================================================
   NORMALIZE OPTIONAL TEXT
================================================== */

function normalizeOptionalText(
  value,
  maxLength = MAX_TEXT_LENGTH
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(value)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);

  return text || null;
}


/* ==================================================
   NORMALIZE ARTICLE ID
================================================== */

function normalizeArticleId(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}


/* ==================================================
   SAFE METADATA
================================================== */

function normalizeMetadata(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return {};
  }

  if (
    typeof value !== "object"
  ) {
    return {};
  }

  try {
    const json =
      JSON.stringify(value);

    if (
      json.length >
      MAX_METADATA_SIZE
    ) {
      return {
        truncated: true,
      };
    }

    return JSON.parse(json);

  } catch {
    return {};
  }
}


/* ==================================================
   HASH IP
================================================== */

function hashIp(ipAddress) {
  if (!ipAddress) {
    return null;
  }

  const value =
    String(ipAddress)
      .trim();

  if (!value) {
    return null;
  }

  const salt =
    process.env.ANALYTICS_IP_SALT ||
    process.env.IP_HASH_SALT ||
    "zeeshan-news-ai";

  return crypto
    .createHash("sha256")
    .update(
      `${salt}:${value}`
    )
    .digest("hex");
}


/* ==================================================
   RECORD EVENT
================================================== */

export async function recordAnalyticsEvent(
  db,
  event = {}
) {
  if (
    !db ||
    typeof db.query !== "function"
  ) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureAnalyticsTable(db);

  const eventType =
    normalizeEventType(
      event.eventType ||
      event.event_type
    );

  const articleId =
    normalizeArticleId(
      event.articleId ||
      event.article_id
    );

  const pagePath =
    normalizeOptionalText(
      event.pagePath ||
      event.page_path,
      1000
    );

  const source =
    normalizeOptionalText(
      event.source,
      300
    );

  const metadata =
    normalizeMetadata(
      event.metadata
    );

  const ipHash =
    event.ipHash ||
    event.ip_hash ||
    hashIp(
      event.ip ||
      event.ipAddress ||
      event.ip_address
    );

  const userAgent =
    normalizeOptionalText(
      event.userAgent ||
      event.user_agent,
      1000
    );


  const result =
    await db.query(
      `
      INSERT INTO analytics_events (
        event_type,
        article_id,
        page_path,
        source,
        metadata,
        ip_hash,
        user_agent
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6,
        $7
      )
      RETURNING *
      `,
      [
        eventType,
        articleId,
        pagePath,
        source,
        JSON.stringify(metadata),
        ipHash,
        userAgent,
      ]
    );


  return {
    success: true,

    event:
      result.rows[0],
  };
}


/* ==================================================
   COMPATIBILITY WRAPPER
================================================== */

export async function trackEvent(
  db,
  eventType,
  options = {}
) {
  return recordAnalyticsEvent(
    db,
    {
      ...options,

      eventType,
    }
  );
}


/* ==================================================
   TRACK PAGE VIEW
================================================== */

export async function trackPageView(
  db,
  pagePath,
  options = {}
) {
  return recordAnalyticsEvent(
    db,
    {
      ...options,

      eventType:
        "page_view",

      pagePath,
    }
  );
}


/* ==================================================
   TRACK ARTICLE VIEW
================================================== */

export async function trackArticleView(
  db,
  articleId,
  options = {}
) {
  return recordAnalyticsEvent(
    db,
    {
      ...options,

      eventType:
        "article_view",

      articleId,
    }
  );
}


/* ==================================================
   TRACK SEARCH
================================================== */

export async function trackSearch(
  db,
  searchQuery,
  options = {}
) {
  return recordAnalyticsEvent(
    db,
    {
      ...options,

      eventType:
        "search",

      metadata: {
        ...(options.metadata || {}),

        query:
          normalizeOptionalText(
            searchQuery,
            500
          ),
      },
    }
  );
}


/* ==================================================
   TRACK CATEGORY VIEW
================================================== */

export async function trackCategoryView(
  db,
  category,
  options = {}
) {
  return recordAnalyticsEvent(
    db,
    {
      ...options,

      eventType:
        "category_view",

      metadata: {
        ...(options.metadata || {}),

        category:
          normalizeOptionalText(
            category,
            200
          ),
      },
    }
  );
}


/* ==================================================
   TRACK TRENDING VIEW
================================================== */

export async function trackTrendingView(
  db,
  options = {}
) {
  return recordAnalyticsEvent(
    db,
    {
      ...options,

      eventType:
        "trending_view",
    }
  );
}


/* ==================================================
   TRACK NOTIFICATION CLICK
================================================== */

export async function trackNotificationClick(
  db,
  options = {}
) {
  return recordAnalyticsEvent(
    db,
    {
      ...options,

      eventType:
        "notification_click",
    }
  );
}


/* ==================================================
   TRACK EXTERNAL SOURCE CLICK
================================================== */

export async function trackExternalSourceClick(
  db,
  options = {}
) {
  return recordAnalyticsEvent(
    db,
    {
      ...options,

      eventType:
        "external_source_click",
    }
  );
}


/* ==================================================
   GET EVENT COUNTS
================================================== */

export async function getAnalyticsEventCounts(
  db,
  options = {}
) {
  if (
    !db ||
    typeof db.query !== "function"
  ) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureAnalyticsTable(db);

  const days = Math.min(
    Math.max(
      Number(
        options.days
      ) || 30,
      1
    ),
    3650
  );


  const result =
    await db.query(
      `
      SELECT
        event_type,
        COUNT(*)::INTEGER AS count
      FROM analytics_events
      WHERE created_at >=
        CURRENT_TIMESTAMP -
        ($1 * INTERVAL '1 day')
      GROUP BY event_type
      ORDER BY count DESC
      `,
      [days]
    );


  return {
    success: true,

    days,

    events:
      result.rows.map(
        (row) => ({
          eventType:
            row.event_type,

          count:
            Number(
              row.count
            ) || 0,
        })
      ),
  };
}


/* ==================================================
   GET TOTAL ANALYTICS
================================================== */

export async function getAnalyticsSummary(
  db,
  options = {}
) {
  if (
    !db ||
    typeof db.query !== "function"
  ) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureAnalyticsTable(db);

  const days = Math.min(
    Math.max(
      Number(
        options.days
      ) || 30,
      1
    ),
    3650
  );


  const result =
    await db.query(
      `
      SELECT
        COUNT(*)::INTEGER AS total_events,

        COUNT(*) FILTER (
          WHERE event_type = 'page_view'
        )::INTEGER AS page_views,

        COUNT(*) FILTER (
          WHERE event_type = 'article_view'
        )::INTEGER AS article_views,

        COUNT(*) FILTER (
          WHERE event_type = 'search'
        )::INTEGER AS searches,

        COUNT(*) FILTER (
          WHERE event_type = 'category_view'
        )::INTEGER AS category_views,

        COUNT(*) FILTER (
          WHERE event_type = 'trending_view'
        )::INTEGER AS trending_views,

        COUNT(*) FILTER (
          WHERE event_type = 'notification_click'
        )::INTEGER AS notification_clicks,

        COUNT(*) FILTER (
          WHERE event_type = 'external_source_click'
        )::INTEGER AS external_source_clicks

      FROM analytics_events
      WHERE created_at >=
        CURRENT_TIMESTAMP -
        ($1 * INTERVAL '1 day')
      `,
      [days]
    );


  const row =
    result.rows[0] || {};


  return {
    success: true,

    days,

    totalEvents:
      Number(
        row.total_events
      ) || 0,

    pageViews:
      Number(
        row.page_views
      ) || 0,

    articleViews:
      Number(
        row.article_views
      ) || 0,

    searches:
      Number(
        row.searches
      ) || 0,

    categoryViews:
      Number(
        row.category_views
      ) || 0,

    trendingViews:
      Number(
        row.trending_views
      ) || 0,

    notificationClicks:
      Number(
        row.notification_clicks
      ) || 0,

    externalSourceClicks:
      Number(
        row.external_source_clicks
      ) || 0,
  };
}


/* ==================================================
   POPULAR ARTICLES
================================================== */

export async function getPopularArticles(
  db,
  options = {}
) {
  if (
    !db ||
    typeof db.query !== "function"
  ) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureAnalyticsTable(db);

  const days = Math.min(
    Math.max(
      Number(
        options.days
      ) || 7,
      1
    ),
    3650
  );

  const limit = Math.min(
    Math.max(
      Number(
        options.limit
      ) || 10,
      1
    ),
    100
  );


  const result =
    await db.query(
      `
      SELECT
        a.id,
        a.title,
        a.link,
        a.source,
        COUNT(e.id)::INTEGER AS views

      FROM analytics_events e

      INNER JOIN articles a
        ON a.id = e.article_id

      WHERE
        e.event_type = 'article_view'
        AND e.created_at >=
          CURRENT_TIMESTAMP -
          ($1 * INTERVAL '1 day')

      GROUP BY
        a.id,
        a.title,
        a.link,
        a.source

      ORDER BY
        views DESC

      LIMIT $2
      `,
      [
        days,
        limit,
      ]
    );


  return {
    success: true,

    days,

    limit,

    articles:
      result.rows.map(
        (row) => ({
          id:
            Number(
              row.id
            ),

          title:
            row.title,

          link:
            row.link,

          source:
            row.source,

          views:
            Number(
              row.views
            ) || 0,
        })
      ),
  };
}


/* ==================================================
   POPULAR PAGES
================================================== */

export async function getPopularPages(
  db,
  options = {}
) {
  if (
    !db ||
   