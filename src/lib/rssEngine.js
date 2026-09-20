import Parser from "rss-parser";

import {
  recordSourceFailure,
  resolveSourceFailure,
  shouldRetry,
  getRetryDelay,
} from "./productionMonitor.js";

const parser = new Parser({
  timeout: 15000,

  headers: {
    "User-Agent":
      "ZEESHAN-NEWS-AI/1.0",
  },
});

const DEFAULT_RETRY_LIMIT = 3;

/* =========================
   DEFAULT RSS SOURCES
========================= */

const DEFAULT_SOURCES = [
  {
    name: "BBC News",
    url: "https://feeds.bbci.co.uk/news/rss.xml",
  },

  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },

  {
    name: "BBC Technology",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
  },

  {
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
  },

  {
    name: "BBC Sports",
    url: "https://feeds.bbci.co.uk/sport/rss.xml",
  },

  {
    name: "The Guardian World",
    url: "https://www.theguardian.com/world/rss",
  },

  {
    name: "The Guardian Technology",
    url: "https://www.theguardian.com/uk/technology/rss",
  },

  {
    name: "NPR News",
    url: "https://feeds.npr.org/1001/rss.xml",
  },
];

/* =========================
   SLEEP
========================= */

function sleep(milliseconds) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

/* =========================
   SAFE ERROR
========================= */

function getErrorMessage(error) {
  return String(
    error?.message ||
      error ||
      "Unknown RSS error"
  ).slice(0, 2000);
}

/* =========================
   SOURCE NAME
========================= */

function getSourceName(source) {
  if (typeof source === "string") {
    return source;
  }

  return (
    source?.name ||
    source?.source ||
    source?.url ||
    "unknown"
  );
}

/* =========================
   SOURCE URL
========================= */

function getSourceUrl(source) {
  if (typeof source === "string") {
    return source;
  }

  return source?.url || "";
}

/* =========================
   GET CONFIGURED SOURCES
========================= */

export function getRssSources() {
  const configured =
    String(
      process.env.RSS_SOURCES || ""
    ).trim();

  if (!configured) {
    return DEFAULT_SOURCES;
  }

  try {
    const parsed =
      JSON.parse(configured);

    if (
      Array.isArray(parsed) &&
      parsed.length > 0
    ) {
      return parsed
        .map((source) => {
          if (
            typeof source === "string"
          ) {
            return {
              name: source,
              url: source,
            };
          }

          return {
            name:
              source?.name ||
              source?.source ||
              source?.url ||
              "unknown",
            url:
              source?.url || "",
          };
        })
        .filter(
          (source) =>
            Boolean(source.url)
        );
    }
  } catch (error) {
    console.error(
      "⚠️ Invalid RSS_SOURCES configuration:",
      error.message
    );
  }

  return DEFAULT_SOURCES;
}

/* =========================
   FETCH ONE RSS SOURCE
========================= */

export async function fetchRssSource(
  source
) {
  const feedUrl =
    getSourceUrl(source);

  const sourceName =
    getSourceName(source);

  if (!feedUrl) {
    throw new Error(
      "RSS feed URL is required"
    );
  }

  let lastError = null;

  for (
    let attempt = 0;
    attempt < DEFAULT_RETRY_LIMIT;
    attempt++
  ) {
    try {
      console.log(
        `📡 RSS fetch: ${sourceName} | attempt ${
          attempt + 1
        }/${DEFAULT_RETRY_LIMIT}`
      );

      const feed =
        await parser.parseURL(
          feedUrl
        );

      return {
        success: true,

        source:
          sourceName,

        url:
          feedUrl,

        title:
          feed.title || "",

        description:
          feed.description || "",

        items:
          Array.isArray(feed.items)
            ? feed.items
            : [],

        itemCount:
          Array.isArray(feed.items)
            ? feed.items.length
            : 0,

        attempt:
          attempt + 1,

        fetchedAt:
          new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;

      const message =
        getErrorMessage(error);

      console.error(
        `❌ RSS source failed: ${sourceName} | ${message}`
      );

      if (
        shouldRetry(attempt)
      ) {
        const delay =
          getRetryDelay(attempt);

        console.log(
          `🔄 RSS retry in ${delay}ms...`
        );

        await sleep(delay);
      }
    }
  }

  throw new Error(
    `RSS source failed after ${DEFAULT_RETRY_LIMIT} attempts: ${sourceName} — ${getErrorMessage(
      lastError
    )}`
  );
}

/* =========================
   FETCH WITH MONITORING
========================= */

export async function fetchRssSourceWithMonitoring(
  db,
  source
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const sourceName =
    getSourceName(source);

  try {
    const result =
      await fetchRssSource(
        source
      );

    await resolveSourceFailure(
      db,
      sourceName
    ).catch(() => {});

    return result;
  } catch (error) {
    await recordSourceFailure(
      db,
      sourceName,
      error
    );

    throw error;
  }
}

/* =========================
   NORMALIZE RSS ITEM
========================= */

export function normalizeRssItem(
  item,
  source
) {
  const sourceName =
    getSourceName(source);

  const link =
    String(
      item?.link ||
        item?.guid ||
        ""
    ).trim();

  const guid =
    String(
      item?.guid ||
        item?.id ||
        link ||
        ""
    ).trim();

  const title =
    String(
      item?.title || ""
    ).trim();

  const description =
    String(
      item?.contentSnippet ||
        item?.description ||
        item?.content ||
        ""
    ).trim();

  const content =
    String(
      item?.content ||
        item?.contentSnippet ||
        item?.description ||
        ""
    ).trim();

  return {
    title,

    link,

    description,

    content,

    source:
      sourceName,

    published_at:
      item?.isoDate ||
      item?.pubDate ||
      null,

    author:
      item?.creator ||
      item?.author ||
      "",

    guid,

    categories:
      Array.isArray(
        item?.categories
      )
        ? item.categories
        : [],
  };
}

/* =========================
   ENSURE ARTICLES TABLE
========================= */

async function ensureArticlesTable(
  db
) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id BIGSERIAL PRIMARY KEY,

      title TEXT NOT NULL DEFAULT '',

      link TEXT,

      description TEXT,

      content TEXT,

      source TEXT,

      published_at TIMESTAMP,

      author TEXT,

      guid TEXT,

      category TEXT,

      ai_summary TEXT,

      ai_category TEXT,

      ai_sentiment TEXT,

      is_analyzed BOOLEAN DEFAULT FALSE,

      legal_hold BOOLEAN DEFAULT FALSE,

      legal_review_required BOOLEAN DEFAULT FALSE,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_articles_link
    ON articles(link)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_articles_guid
    ON articles(guid)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_articles_published
    ON articles(published_at DESC)
  `);
}

/* =========================
   DUPLICATE CHECK
========================= */

async function articleExists(
  db,
  article
) {
  const result =
    await db.query(
      `
      SELECT id
      FROM articles
      WHERE
        (
          link IS NOT NULL
          AND link <> ''
          AND link = $1
        )
        OR
        (
          guid IS NOT NULL
          AND guid <> ''
          AND guid = $2
        )
      LIMIT 1
      `,
      [
        article.link || "",
        article.guid || "",
      ]
    );

  return (
    result.rows.length > 0
  );
}

/* =========================
   SAVE ARTICLE
========================= */

async function saveArticle(
  db,
  article
) {
  if (
    !article?.title ||
    !article?.link
  ) {
    return {
      saved: false,
      duplicate: false,
      skipped: true,
    };
  }

  const exists =
    await articleExists(
      db,
      article
    );

  if (exists) {
    return {
      saved: false,
      duplicate: true,
      skipped: false,
    };
  }

  const result =
    await db.query(
      `
      INSERT INTO articles (
        title,
        link,
        description,
        content,
        source,
        published_at,
        author,
        guid,
        category,
        is_analyzed,
        legal_hold,
        legal_review_required,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        FALSE,
        FALSE,
        FALSE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING id
      `,
      [
        article.title,

        article.link,

        article.description ||
          "",

        article.content ||
          "",

        article.source ||
          "",

        article.published_at ||
          null,

        article.author ||
          "",

        article.guid ||
          article.link ||
          "",

        "world",
      ]
    );

  return {
    saved: true,
    duplicate: false,
    skipped: false,
    articleId:
      result.rows[0]?.id ||
      null,
  };
}

/* =========================
   SAVE RSS ITEMS
========================= */

async function saveRssItems(
  db,
  feedResult,
  source
) {
  let saved = 0;
  let duplicates = 0;
  let skipped = 0;

  const items =
    Array.isArray(
      feedResult?.items
    )
      ? feedResult.items
      : [];

  for (
    const item of items
  ) {
    try {
      const article =
        normalizeRssItem(
          item,
          source
        );

      const result =
        await saveArticle(
          db,
          article
        );

      if (result.saved) {
        saved++;
      } else if (
        result.duplicate
      ) {
        duplicates++;
      } else {
        skipped++;
      }
    } catch (error) {
      skipped++;

      console.error(
        "⚠️ RSS article save failed:",
        error.message
      );
    }
  }

  return {
    fetched:
      items.length,

    saved,

    duplicates,

    skipped,
  };
}

/* =========================
   RUN RSS ENGINE
========================= */

export async function runRssEngine(
  db,
  sources = null
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureArticlesTable(
    db
  );

  const configuredSources =
    Array.isArray(sources) &&
    sources.length > 0
      ? sources
      : getRssSources();

  if (
    configuredSources.length ===
    0
  ) {
    return {
      success: true,

      message:
        "No RSS sources configured",

      totalSources: 0,

      successfulSources: 0,

      failedSources: 0,

      articlesFetched: 0,

      articlesSaved: 0,

      duplicates: 0,

      failures: [],

      completedAt:
        new Date().toISOString(),
    };
  }

  let successfulSources = 0;

  let failedSources = 0;

  let articlesFetched = 0;

  let articlesSaved = 0;

  let duplicates = 0;

  let skipped = 0;

  const failures = [];

  for (
    const source of configuredSources
  ) {
    try {
      console.log(
        `\n📰 Processing RSS source: ${getSourceName(
          source
        )}`
      );

      const feedResult =
        await fetchRssSourceWithMonitoring(
          db,
          source
        );

      successfulSources++;

      const saveReport =
        await saveRssItems(
          db,
          feedResult,
          source
        );

      articlesFetched +=
        saveReport.fetched;

      articlesSaved +=
        saveReport.saved;

      duplicates +=
        saveReport.duplicates;

      skipped +=
        saveReport.skipped;

      console.log(
        `✅ ${getSourceName(
          source
        )}: fetched=${saveReport.fetched}, saved=${saveReport.saved}, duplicates=${saveReport.duplicates}`
      );
    } catch (error) {
      failedSources++;

      const sourceName =
        getSourceName(source);

      failures.push({
        source:
          sourceName,

        error:
          getErrorMessage(
            error
          ),
      });

      console.error(
        `❌ RSS source failed completely: ${sourceName}`
      );
    }
  }

  return {
    success:
      failedSources === 0,

    totalSources:
      configuredSources.length,

    successfulSources,

    failedSources,

    articlesFetched,

    articlesSaved,

    duplicates,

    skipped,

    failures:
      failures.slice(0, 20),

    completedAt:
      new Date().toISOString(),
  };
}

/* =========================
   RSS ENGINE STATUS
========================= */

export function getRssEngineStatus() {
  return {
    enabled: true,

    engine:
      "ZEESHAN NEWS AI RSS Engine",

    parser:
      "rss-parser",

    timeoutMs:
      15000,

    retry: {
      enabled: true,

      maximumAttempts:
        DEFAULT_RETRY_LIMIT,

      exponentialBackoff:
        true,
    },

    sourceRegistry: {
      enabled: true,

      defaultSources:
        DEFAULT_SOURCES.length,

      environmentVariable:
        "RSS_SOURCES",
    },

    database: {
      articleStorage: true,

      duplicateProtection: true,

      sourceFailureTracking:
        true,
    },

    automaticSourceRecovery:
      true,

    fakeTraffic:
      false,

    fakeEngagement:
      false,
  };
}