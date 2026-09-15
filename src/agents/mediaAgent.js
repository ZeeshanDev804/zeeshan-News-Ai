const MEDIA_PURPOSES = [
  "THUMBNAIL",
  "ARTICLE_IMAGE",
  "SOCIAL_IMAGE",
  "VIDEO_COVER"
];

const MEDIA_SOURCES = [
  "AI_GENERATED",
  "ORIGINAL",
  "LICENSED",
  "PUBLIC_DOMAIN",
  "PENDING_REVIEW"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createMediaTask({
  articleId,
  title,
  purpose = "THUMBNAIL"
}) {
  if (!articleId || !title) {
    throw new Error("Article ID and title are required.");
  }

  if (!MEDIA_PURPOSES.includes(purpose)) {
    throw new Error("Invalid media purpose.");
  }

  return {
    id: `media_${Date.now()}`,

    article: {
      id: cleanText(articleId),
      title: cleanText(title)
    },

    purpose,

    generation: {
      prompt: "",
      status: "QUEUED",
      assetUrl: null
    },

    rights: {
      source: "PENDING_REVIEW",
      license: null,
      attribution: null,
      commercialUse: false
    },

    quality: {
      resolution: null,
      format: null,
      accessibilityAltText: ""
    },

    status: "QUEUED",

    nextStep: "CREATE_MEDIA_PROMPT",

    createdAt: new Date().toISOString()
  };
}

export function setMediaPrompt(task, prompt) {
  if (!task || typeof task !== "object") {
    throw new Error("Media task is required.");
  }

  const cleanPrompt = cleanText(prompt);

  if (!cleanPrompt) {
    throw new Error("Media prompt is required.");
  }

  task.generation.prompt = cleanPrompt;
  task.generation.status = "READY";

  task.nextStep = "GENERATE_OR_SELECT_MEDIA";

  return task;
}

export function attachMedia(task, assetUrl, source = "AI_GENERATED") {
  if (!task || typeof task !== "object") {
    throw new Error("Media task is required.");
  }

  if (!assetUrl) {
    throw new Error("Media asset URL is required.");
  }

  if (!MEDIA_SOURCES.includes(source)) {
    throw new Error("Invalid media source.");
  }

  task.generation.assetUrl = cleanText(assetUrl);
  task.rights.source = source;

  task.generation.status = "ATTACHED";
  task.status = "RIGHTS_REVIEW";
  task.nextStep = "VERIFY_MEDIA_RIGHTS";

  return task;
}

export function approveMediaRights(
  task,
  {
    license = null,
    attribution = null,
    commercialUse = false
  } = {}
) {
  if (!task || typeof task !== "object") {
    throw new Error("Media task is required.");
  }

  task.rights.license = license;
  task.rights.attribution = attribution;
  task.rights.commercialUse = Boolean(commercialUse);

  const safeSource = [
    "AI_GENERATED",
    "ORIGINAL",
    "LICENSED",
    "PUBLIC_DOMAIN"
  ].includes(task.rights.source);

  if (!safeSource || !task.rights.commercialUse) {
    task.status = "REVIEW_REQUIRED";
    task.nextStep = "HUMAN_REVIEW";
    return task;
  }

  task.status = "READY";
  task.nextStep = "PUBLISH_MEDIA";

  return task;
}

export function setAltText(task, altText) {
  if (!task || typeof task !== "object") {
    throw new Error("Media task is required.");
  }

  task.quality.accessibilityAltText = cleanText(altText);

  return task;
}

export function getMediaPurposes() {
  return [...MEDIA_PURPOSES];
}
