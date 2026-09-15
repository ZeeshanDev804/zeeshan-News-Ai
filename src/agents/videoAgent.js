const VIDEO_TYPES = [
  "SHORT_NEWS",
  "TRENDING",
  "SPORTS",
  "ENTERTAINMENT",
  "AI_TECH",
  "EXPLAINER"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createVideoTask({
  articleId,
  topic,
  type = "SHORT_NEWS"
}) {
  const cleanTopic = cleanText(topic);

  if (!articleId || !cleanTopic) {
    throw new Error("Article ID and topic are required.");
  }

  if (!VIDEO_TYPES.includes(type)) {
    throw new Error("Invalid video type.");
  }

  return {
    id: `video_${Date.now()}`,

    article: {
      id: cleanText(articleId),
      topic: cleanTopic
    },

    type,

    content: {
      title: "",
      hook: "",
      script: "",
      caption: "",
      hashtags: []
    },

    media: {
      voice: null,
      visuals: [],
      music: null,
      coverImage: null,
      videoUrl: null
    },

    checks: {
      facts: "PENDING",
      mediaRights: "PENDING"
    },

    status: "QUEUED",

    nextStep: "CREATE_SCRIPT",

    createdAt: new Date().toISOString()
  };
}

export function saveVideoScript(task, {
  title,
  hook,
  script,
  caption = "",
  hashtags = []
}) {
  if (!task || typeof task !== "object") {
    throw new Error("Video task is required.");
  }

  if (!title || !hook || !script) {
    throw new Error("Title, hook and script are required.");
  }

  task.content = {
    title: cleanText(title),
    hook: cleanText(hook),
    script: cleanText(script),
    caption: cleanText(caption),
    hashtags: Array.isArray(hashtags)
      ? hashtags.map(cleanText).filter(Boolean)
      : []
  };

  task.status = "SCRIPT_READY";
  task.nextStep = "FACT_AND_RIGHTS_CHECK";

  return task;
}

export function attachVideoMedia(task, {
  voice = null,
  visuals = [],
  music = null,
  coverImage = null,
  videoUrl = null
} = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Video task is required.");
  }

  task.media = {
    voice,
    visuals: Array.isArray(visuals) ? visuals : [],
    music,
    coverImage,
    videoUrl
  };

  task.status = "MEDIA_ATTACHED";
  task.nextStep = "FINAL_CHECK";

  return task;
}

export function completeVideoChecks(task, {
  facts = "REVIEW",
  mediaRights = "REVIEW"
} = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Video task is required.");
  }

  task.checks = {
    facts,
    mediaRights
  };

  const blocked =
    facts === "FAIL" ||
    mediaRights === "FAIL" ||
    mediaRights === "BLOCKED";

  const needsReview =
    facts === "REVIEW" ||
    mediaRights === "REVIEW" ||
    facts === "PENDING" ||
    mediaRights === "PENDING";

  if (blocked) {
    task.status = "BLOCKED";
    task.nextStep = "HUMAN_REVIEW";
  } else if (needsReview) {
    task.status = "REVIEW_REQUIRED";
    task.nextStep = "HUMAN_REVIEW";
  } else {
    task.status = "READY";
    task.nextStep = "PUBLISH_VIDEO";
  }

  return task;
}

export function getVideoTypes() {
  return [...VIDEO_TYPES];
}
