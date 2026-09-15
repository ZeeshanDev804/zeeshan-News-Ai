import {
  createItem,
  getItem,
  updateItem,
  deleteItem,
  listItems,
  countItems
} from "../data/contentStore.js";

const COLLECTION = "articles";

const VALID_STATUSES = [
  "DRAFT",
  "REVIEW",
  "READY",
  "PUBLISHED",
  "BLOCKED",
  "ARCHIVED"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createArticle({
  title,
  summary = "",
  body = "",
  category = "Trending",
  region = "GLOBAL",
  author = "ZEESHAN NEWS AI"
}) {
  const cleanTitle = cleanText(title);

  if (!cleanTitle) {
    throw new Error("Article title is required.");
  }

  return createItem(COLLECTION, {
    id: `article_${Date.now()}`,

    title: cleanTitle,
    summary: cleanText(summary),
    body: cleanText(body),

    category: cleanText(category),
    region: cleanText(region),

    author: cleanText(author),

    status: "DRAFT",

    source: {
      name: null,
      url: null,
      publishedAt: null
    },

    seo: {
      title: null,
      description: null,
      slug: null,
      canonicalPath: null
    },

    safety: {
      factCheck: "PENDING",
      originality: "PENDING",
      mediaRights: "PENDING",
      risk: "PENDING"
    },

    media: [],

    social: {
      status: "NOT_STARTED",
      platforms: []
    },

    publishing: {
      platform: null,
      url: null,
      publishedAt: null
    },

    analytics: {
      views: 0,
      users: 0,
      clicks: 0,
      engagement: 0,
      adRevenue: null
    },

    createdAt: new Date().toISOString()
  });
}

export function getArticle(articleId) {
  return getItem(COLLECTION, articleId);
}

export function updateArticle(articleId, updates = {}) {
  if (!articleId) {
    throw new Error("Article ID is required.");
  }

  if (updates.status &&
      !VALID_STATUSES.includes(updates.status)) {
    throw new Error("Invalid article status.");
  }

  return updateItem(
    COLLECTION,
    articleId,
    updates
  );
}

export function publishArticle({
  articleId,
  url,
  platform = "BLOGGER"
}) {
  const article = getArticle(articleId);

  if (!article) {
    throw new Error("Article not found.");
  }

  if (article.status === "BLOCKED") {
    throw new Error(
      "Blocked article cannot be published."
    );
  }

  return updateArticle(articleId, {
    status: "PUBLISHED",

    publishing: {
      platform,
      url: url || null,
      publishedAt: new Date().toISOString()
    }
  });
}

export function archiveArticle(articleId) {
  return updateArticle(articleId, {
    status: "ARCHIVED"
  });
}

export function removeArticle(articleId) {
  return deleteItem(COLLECTION, articleId);
}

export function getArticles({
  limit = 50,
  status = null
} = {}) {
  return listItems(COLLECTION, {
    limit,
    status
  });
}

export function getArticleCount() {
  return countItems(COLLECTION);
}
