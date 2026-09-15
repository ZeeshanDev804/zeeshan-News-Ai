import { runFeed } from "./feedRunner.js";
import { screenNewsItem } from "./contentScreening.js";

export async function runSafeFeed({
  sourceId,
  feedUrl,
  category = "World",
  region = "GLOBAL",
  existingArticles = [],
  sourceReliability = 50
}) {
  const feed = await runFeed({
    sourceId,
    feedUrl,
    category,
    region
  });

  return {
    ...feed,
    screenedItems: feed.items.map((item) =>
      screenNewsItem({
        item,
        existingArticles,
        sourceReliability
      })
    )
  };
}
