const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function createSlug(title) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function limitText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

export function buildSEO(article) {
  if (!article || typeof article !== "object") {
    throw new Error("Article data is required.");
  }

  const title = cleanText(article.title);
  const summary = cleanText(article.summary);
  const category = cleanText(article.category);

  if (!title) {
    throw new Error("Article title is required.");
  }

  const slug = createSlug(title);

  const description = limitText(
    summary || `${title} — latest verified news and updates.`,
    MAX_DESCRIPTION_LENGTH
  );

  return {
    title: limitText(title, MAX_TITLE_LENGTH),
    description,
    slug,
    canonicalPath: `/news/${slug}`,
    category,
    keywords: [
      ...new Set(
        [
          title,
          category,
          ...(article.keywords || [])
        ]
          .map(cleanText)
          .filter(Boolean)
      )
    ],
    structuredData: {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: title,
      datePublished: article.datePublished || new Date().toISOString(),
      dateModified: article.dateModified || new Date().toISOString(),
      author: {
        "@type": "Organization",
        name: "ZEESHAN NEWS AI"
      }
    }
  };
}
