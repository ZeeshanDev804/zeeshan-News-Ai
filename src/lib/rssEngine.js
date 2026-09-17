import Parser from "rss-parser";

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

  const date = new Date(item.pubDate);

  return Number.isNaN(date.getTime())
    ? new Date()
    : date;
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
    failedSources: 0,
  };

  for (const source of RSS_SOURCES) {
    console.log(`📰 Fetching: ${source.name}`);

    try {
      const feed = await parser.parseURL(
        source.url
      );

      report.sources++;

      for (const item of feed.items.slice(0, 20)) {
        if (!item.title || !item.link) {
          continue;
        }

        report.fetched++;

        const title = cleanText(item.title);

        const content = cleanText(
          item.contentSnippet ||
            item.content ||
            item.summary ||
            ""
        );

        const publishedAt =
          getPublishedDate(item);

        const result = await db.query(
          `
          INSERT INTO articles
            (title, link, content, source, published_at)
          VALUES
            ($1, $2, $3, $4, $5)
          ON CONFLICT (link) DO NOTHING
          `,
          [
            title,
            item.link.trim(),
            content,
            source.name,
            publishedAt,
          ]
        );

        if (result.rowCount === 1) {
          report.saved++;
        } else {
          report.duplicates++;
        }
      }

      console.log(
        `✅ ${source.name} completed`
      );
    } catch (error) {
      report.failedSources++;

      console.error(
        `❌ ${source.name} failed:`,
        error.message
      );
    }
  }

  console.log(
    "🏁 RSS ENGINE FINISHED"
  );

  console.log(report);

  return report;
}