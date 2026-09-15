export function createFeedTask({
  sourceId,
  feedUrl,
  category = "World",
  region = "GLOBAL"
}) {
  if (!sourceId || !feedUrl) {
    throw new Error(
      "Source ID and feed URL are required."
    );
  }

  return {
    id: `feed_${Date.now()}`,

    sourceId,
    feedUrl,
    category,
    region,

    status: "QUEUED",

    items: [],

    nextStep: "FETCH_FEED",

    createdAt: new Date().toISOString()
  };
}

export function saveFeedItems(task, items = []) {
  if (!task || typeof task !== "object") {
    throw new Error("Feed task is required.");
  }

  task.items = Array.isArray(items)
    ? items
        .filter((item) => item?.title)
        .map((item) => ({
          title: String(item.title).trim(),
          url: item.url || null,
          publishedAt: item.publishedAt || null
        }))
    : [];

  task.status = "FEED_COLLECTED";
  task.nextStep = "DUPLICATE_AND_RISK_CHECK";

  return task;
}

export function getFeedItems(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Feed task is required.");
  }

  return [...task.items];
}
