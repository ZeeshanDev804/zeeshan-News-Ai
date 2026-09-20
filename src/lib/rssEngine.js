import Parser from "rss-parser";

import {
  recordSourceFailure,
  resolveSourceFailure,
  shouldRetry,
  getRetryDelay,
} from "./productionMonitor.js";

const parser =
  new Parser({
    timeout:
      15000,

    headers: {
      "User-Agent":
        "ZEESHAN-NEWS-AI/1.0",
    },
  });

const DEFAULT_RETRY_LIMIT =
  3;

/* =========================
   SLEEP
========================= */

function sleep(
  milliseconds
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

/* =========================
   SAFE ERROR
========================= */

function getErrorMessage(
  error
) {
  return String(
    error?.message ||
      error ||
      "Unknown RSS error"
  ).slice(0, 2000);
}

/* =========================
   FETCH ONE RSS SOURCE
========================= */

export async function fetchRssSource(
  source
) {
  const feedUrl =
    typeof source === "string"
      ? source
      : source?.url;

  const sourceName =
    typeof source === "string"
      ? source
      : source?.name ||
        source?.source ||
        feedUrl ||
        "unknown";

  if (!feedUrl) {
    throw new Error(
      "RSS feed URL is required"
    );
  }

  let lastError =
    null;

  for (
    let attempt = 0;
    attempt <
    DEFAULT_RETRY_LIMIT;
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

      await resolveSourceFailure(
        globalThis.__zeeshanNewsDb,
        sourceName
      ).catch(
        () => {}
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
          Array.isArray(
            feed.items
          )
            ? feed.items
            : [],

        itemCount:
          Array.isArray(
            feed.items
          )
            ? feed.items.length
            : 0,

        attempt:
          attempt + 1,

        fetchedAt:
          new Date().toISOString(),
      };

    } catch (error) {
      lastError =
        error;

      const message =
        getErrorMessage(
          error
        );

      console.error(
        `❌ RSS source failed: ${sourceName} | ${message}`
      );

      if (
        shouldRetry(
          attempt
        )
      ) {
        const delay =
          getRetryDelay(
            attempt
          );

        console.log(
          `🔄 RSS retry in ${delay}ms...`
        );

        await sleep(
          delay
        );
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
   FETCH RSS WITH DATABASE
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

  const feedUrl =
    typeof source === "string"
      ? source
      : source?.url;

  const sourceName =
    typeof source === "string"
      ? source
      : source?.name ||
        source?.source ||
        feedUrl ||
        "unknown";

  globalThis.__zeeshanNewsDb =
    db;

  try {
    const result =
      await fetchRssSource(
        source
      );

    await resolveSourceFailure(
      db,
      sourceName
    );

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
   NORMALIZE RSS ARTICLE
========================= */

export function normalizeRssItem(
  item,
  source
) {
  const sourceName =
    typeof source === "string"
      ? source
      : source?.name ||
        source?.source ||
        "";

  return {
    title:
      item?.title ||
      "",

    link:
      item?.link ||
      item?.guid ||
      "",

    description:
      item?.contentSnippet ||
      item?.content ||
      item?.description ||
      "",

    content:
      item?.content ||
      item?.contentSnippet ||
      item?.description ||
      "",

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

    guid:
      item?.guid ||
      item?.id ||
      item?.link ||
      "",

    categories:
      Array.isArray(
        item?.categories
      )
        ? item.categories
        : [],
  };
}

/* =========================
   RUN RSS ENGINE
========================= */

export async function runRssEngine(
  db,
  sources = []
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  globalThis.__zeeshanNewsDb =
    db;

  /*
   * IMPORTANT:
   * If the existing project already
   * provides a source registry,
   * use it. Otherwise the engine
   * returns a safe empty report.
   */

  const configuredSources =
    Array.isArray(
      sources
    )
      ? sources
      : [];

  if (
    configuredSources.length ===
    0
  ) {
    return {
      success: true,

      message:
        "No RSS sources were supplied to the RSS engine",

      totalSources: 0,

      successfulSources: 0,

      failedSources: 0,

      articlesFetched: 0,

      failures: [],

      completedAt:
        new Date().toISOString(),
    };
  }

  let successfulSources =
    0;

  let failedSources =
    0;

  let articlesFetched =
    0;

  const failures = [];

  for (
    const source of configuredSources
  ) {
    try {
      const result =
        await fetchRssSourceWithMonitoring(
          db,
          source
        );

      successfulSources +=
        1;

      articlesFetched +=
        result.itemCount || 0;

    } catch (error) {
      failedSources +=
        1;

      failures.push({
        source:
          typeof source ===
          "string"
            ? source
            : source?.name ||
              source?.source ||
              source?.url ||
              "unknown",

        error:
          getErrorMessage(
            error
          ),
      });
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

    failures:
      failures.slice(
        0,
        20
      ),

    completedAt:
      new Date().toISOString(),
  };
}

/* =========================
   RSS ENGINE STATUS
========================= */

export function getRssEngineStatus() {
  return {
    enabled:
      true,

    engine:
      "ZEESHAN NEWS AI RSS Engine",

    parser:
      "rss-parser",

    timeoutMs:
      15000,

    retry: {
      enabled:
        true,

      maximumAttempts:
        DEFAULT_RETRY_LIMIT,

      exponentialBackoff:
        true,
    },

    sourceFailureTracking:
      true,

    automaticSourceRecovery:
      true,

    fakeTraffic:
      false,

    fakeEngagement:
      false,
  };
}