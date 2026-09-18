import Parser from "rss-parser";

import { findSimilarArticle } from "./dedup.js";

import {
  recordSourceSuccess,
  recordSourceFailure,
} from "./sourceHealth.js";

import {
  withRetry,
} from "./retryEngine.js";

const parser = new Parser({
  timeout: 15000,

  headers: {
    "User-Agent": "ZEESHAN-News-AI/1.0",
  },
});

const RSS_SOURCES = [
  {
    name: "BBC",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },

  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },

  {
    name: "Dawn",
    url: "https://www.dawn.com/arcio/rss",
  },
];

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPublishedDate(item) {
  if (!item.pubDate) {
    return new Date();
  }

  const date =
    new Date(item.pubDate);

  return Number.isNaN(
    date.getTime()
  )
    ? new Date()
    : date;
}

async function fetchFeedWithRetry(
  source
) {
  const result =
    await withRetry(
      async () => {
        return parser.parseURL(
          source.url
        );
      },
      {
        maxAttempts: 3,

        baseDelayMs: 1000,

        maxDelayMs: 10000,

        label:
          `RSS ${source.name}`,
      }
    );

  if (!result.success) {
    throw new Error(
      result.error ||
        `Failed to fetch ${source.name}`
    );
  }

  return {
    feed: result.result,

    attempts:
      result.attempts,
  };
}

export async function runRssEngine(db) {
  console.log(
    "🚀 ZEESHAN NEWS AI — RSS ENGINE STARTED"
  );

  const report = {
    success: true,

    sources: 0,

    fetched: 0,

    saved: 0,

    duplicates: 0,

    similarDuplicates: 0,

    failedSources: 0,

    retriedSources: 0,

    sourceHealth: [],
  };

  for (const source of RSS_SOURCES) {
    console.log(
      `📰 Fetching: ${source.name}`
    );

    try {
      const {
        feed,
        attempts,
      } =
        await fetchFeedWithRetry(
          source
        );

      if (attempts > 1) {
        report.retriedSources++;

        console.log(
          `🔁 ${source.name} succeeded after ${attempts} attempts`
        );
      }

      report.sources++;

      for (
        const item of feed.items.slice(
          0,
          20
        )
      ) {
        if (
          !item.title ||
          !item.link
        ) {
          continue;
        }

        report.fetched++;

        const title =
          cleanText(
            item.title
          );

        const content =
          cleanText(
            item.contentSnippet ||
              item.content ||
              item.summary ||
              ""
          );

        const publishedAt =
          getPublishedDate(
            item
          );

        const similarArticle =
          await findSimilarArticle(
            db,
            title
          );

        if (
          similarArticle?.duplicate
        ) {
          report.similarDuplicates++;

          console.log(
            `♻️ Similar news skipped: ${title}`
          );

          continue;
        }

        const result =
          await db.query(
            `
            INSERT INTO articles
              (
                title,
                link,
                content,
                source,
                published_at
              )
            VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5
              )
            ON CONFLICT (link)
            DO NOTHING
            `,
            [
              title,

              item.link.trim(),

              content,

              source.name,

              publishedAt,
            ]
          );

        if (
          result.rowCount === 1
        ) {
          report.saved++;
        } else {
          report.duplicates++;
        }
      }

      const health =
        await recordSourceSuccess(
          db,
          source.name,
          source.url
        );

      report.sourceHealth.push({
        source:
          source.name,

        status:
          health.status,

        successCount:
          health.success_count,

        failureCount:
          health.failure_count,

        consecutiveFailures:
          health.consecutive_failures,
      });

      console.log(
        `✅ ${source.name} completed`
      );

    } catch (error) {
      report.failedSources++;

      console.error(
        `❌ ${source.name} failed after retries:`,
        error.message
      );

      try {
        const health =
          await recordSourceFailure(
            db,
            source.name,
            source.url,
            error
          );

        report.sourceHealth.push({
          source:
            source.name,

          status:
            health.status,

          successCount:
            health.success_count,

          failureCount:
            health.failure_count,

          consecutiveFailures:
            health.consecutive_failures,
        });

      } catch (
        healthError
      ) {
        console.error(
          `❌ Source health recording failed for ${source.name}:`,
          healthError.message
        );
      }
    }
  }

  if (
    report.failedSources > 0
  ) {
    report.success = false;
  }

  console.log(
    "🏁 RSS ENGINE FINISHED"
  );

  console.log(report);

  return report;
}