const NEWS_CATEGORIES = [
  "World",
  "Pakistan",
  "India",
  "USA",
  "UK & Europe",
  "Cricket",
  "Football & Sports",
  "Entertainment",
  "AI & Technology",
  "Business & Money",
  "How-To & Tips",
  "Trending",
  "Interesting Stories"
];

export function getNewsCategories() {
  return [...NEWS_CATEGORIES];
}

export function createNewsDraft({
  title,
  category,
  summary,
  sourceName,
  sourceUrl
}) {
  if (!title || !category || !summary) {
    throw new Error("Title, category and summary are required.");
  }

  if (!NEWS_CATEGORIES.includes(category)) {
    throw new Error("Invalid news category.");
  }

  return {
    id: `news_${Date.now()}`,
    title: title.trim(),
    category,
    summary: summary.trim(),
    source: {
      name: sourceName?.trim() || "Source not provided",
      url: sourceUrl?.trim() || null
    },
    status: "DRAFT",
    safety: {
      originalityCheck: "PENDING",
      duplicateCheck: "PENDING",
      factCheck: "PENDING",
      copyrightMediaCheck: "PENDING"
    },
    createdAt: new Date().toISOString()
  };
}
