import Parser from "rss-parser";

const parser = new Parser();

const RSS_FEEDS = [
  {
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    source: "Al Jazeera",
  },
  {
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    source: "BBC",
  },
  {
    url: "https://www.dawn.com/arcio/rss",
    source: "Dawn",
  },
];

export async function fetchAndSaveNews(db) {
  console.log("📰 News fetching started...");

  let totalSaved = 0;

  for (const feedInfo of RSS_FEEDS) {
    try {
      console.log(`Fetching: ${feedInfo.source}`);

      const feed = await parser.parseURL(feedInfo.url);

      for (const item of feed.items.slice(0, 10)) {
        if (!item.title || !item.link) continue;

        const publishedAt = item.pubDate
          ? new Date(item.pubDate)
          : new Date();

        const result = await db.query(
          `
          INSERT INTO articles
            (title, link, content, source, published_at)
          VALUES
            ($1, $2, $3, $4, $5)
          ON CONFLICT (link) DO NOTHING
          `,
          [
            item.title.trim(),
            item.link,
            item.contentSnippet || item.content || "",
            feedInfo.source,
            publishedAt,
          ]
        );

        if (result.rowCount > 0) {
          totalSaved++;
        }
      }
    } catch (error) {
      console.error(
        `❌ Failed: ${feedInfo.source}`,
        error.message
      );
    }
  }

  console.log(`✅ News fetching completed. Saved: ${totalSaved}`);

  return {
    success: true,
    saved: totalSaved,
  };
}
