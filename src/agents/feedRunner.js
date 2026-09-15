import { collectRSS } from "./rssCollector.js";
import {
  createFeedTask,
  saveFeedItems
} from "./feedAgent.js";

export async function runFeed({
  sourceId,
  feedUrl,
  category = "World",
  region = "GLOBAL"
}) {
  const task = createFeedTask({
    sourceId,
    feedUrl,
    category,
    region
  });

  const result = await collectRSS(feedUrl);

  return saveFeedItems(
    task,
    result.items
  );
}
