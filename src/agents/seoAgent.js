import { buildSEO } from "../seo/seoEngine.js";

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createSEOTask(article) {
  if (!article || typeof article !== "object") {
    throw new Error("Article is required.");
  }

  if (!article.title || !article.summary) {
    throw new Error("Article title and summary are required.");
  }

  return {
    id: `seo_${Date.now()}`,

    article: {
      title: cleanText(article.title),
      summary: cleanText(article.summary),
      category: cleanText(article.category),
      keywords: Array.isArray(article.keywords)
        ? article.keywords
        : []
    },

    status: "SEO_QUEUED",
    result: null,

    nextStep: "OPTIMIZE",

    createdAt: new Date().toISOString()
  };
}

export function optimizeSEO(task) {
  if (!task || typeof task !== "object") {
    throw new Error("SEO task is required.");
  }

  const seo = buildSEO(task.article);

  task.result = {
    title: seo.title,
    description: seo.description,
    slug: seo.slug,
    canonicalPath: seo.canonicalPath,
    category: seo.category,
    keywords: seo.keywords,
    structuredData: seo.structuredData
  };

  task.status = "SEO_READY";
  task.nextStep = "PUBLISH_REVIEW";

  return task;
}

export function getSEOStatus(task) {
  if (!task || typeof task !== "object") {
    throw new Error("SEO task is required.");
  }

  return {
    status: task.status,
    ready: task.status === "SEO_READY",
    nextStep: task.nextStep
  };
}
