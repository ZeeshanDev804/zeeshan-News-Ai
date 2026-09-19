export async function ensureAnalyticsTable(db) {
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
}


function normalizeEventType(
  value
) {
  const allowed = new Set([
    "page_view",
    "article_view",
    "search",
    "category_view",
    "trending_view",
    "notification_click",
    "external_source_click",
  ]);

  const eventType =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!allowed.has(eventType)) {
    throw new Error(
      "Invalid analytics event type"
    );
  }

  return eventType;
}


function normalizeOptionalText(
  value,
  maxLength = 500
) {
  if (
   
