const SOCIAL_PLATFORMS = [
  "FACEBOOK",
  "X",
  "LINKEDIN",
  "INSTAGRAM",
  "TELEGRAM"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createSocialTask({
  article,
  articleUrl,
  platforms = SOCIAL_PLATFORMS
}) {
  if (!article || typeof article !== "object") {
    throw new Error("Article is required.");
  }

  if (!articleUrl) {
    throw new Error("Article URL is required.");
  }

  const selectedPlatforms = platforms.filter((platform) =>
    SOCIAL_PLATFORMS.includes(platform)
  );

  return {
    id: `social_${Date.now()}`,

    article: {
      title: cleanText(article.title),
      summary: cleanText(article.summary)
    },

    articleUrl: cleanText(articleUrl),

    platforms: selectedPlatforms,

    content: {},

    queue: selectedPlatforms.map((platform) => ({
      platform,
      status: "QUEUED",
      scheduledFor: null,
      publishedUrl: null
    })),

    status: "CONTENT_GENERATION",

    nextStep: "CREATE_SOCIAL_CONTENT",

    createdAt: new Date().toISOString()
  };
}

export function generateSocialContent(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Social task is required.");
  }

  const { title, summary } = task.article;
  const link = task.articleUrl;

  for (const platform of task.platforms) {
    task.content[platform] = {
      text: `${title}\n\n${summary}\n\nRead more: ${link}`,
      link,
      status: "READY"
    };
  }

  task.status = "READY";
  task.nextStep = "SCHEDULE_DISTRIBUTION";

  return task;
}

export function scheduleSocialPost(task, platform, scheduledFor) {
  if (!task || typeof task !== "object") {
    throw new Error("Social task is required.");
  }

  const item = task.queue.find(
    (post) => post.platform === platform
  );

  if (!item) {
    throw new Error("Platform is not in the distribution queue.");
  }

  item.scheduledFor = scheduledFor;
  item.status = "SCHEDULED";

  task.nextStep = "PUBLISH_SOCIAL_POST";

  return task;
}

export function markSocialPublished(task, platform, publishedUrl = null) {
  if (!task || typeof task !== "object") {
    throw new Error("Social task is required.");
  }

  const item = task.queue.find(
    (post) => post.platform === platform
  );

  if (!item) {
    throw new Error("Platform is not in the distribution queue.");
  }

  item.status = "PUBLISHED";
  item.publishedUrl = publishedUrl;

  const allPublished = task.queue.every(
    (post) => post.status === "PUBLISHED"
  );

  task.status = allPublished
    ? "DISTRIBUTION_COMPLETE"
    : "DISTRIBUTION_ACTIVE";

  return task;
}

export function getSocialPlatforms() {
  return [...SOCIAL_PLATFORMS];
}
