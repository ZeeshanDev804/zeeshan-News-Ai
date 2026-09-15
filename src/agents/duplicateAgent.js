function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function createDuplicateCheck({
  title,
  existingArticles = []
}) {
  if (!title) {
    throw new Error("Article title is required.");
  }

  const normalizedTitle = normalizeText(title);

  const matches = existingArticles.filter(
    (article) => {
      const existingTitle =
        normalizeText(article.title);

      return (
        existingTitle === normalizedTitle
      );
    }
  );

  return {
    id: `duplicate_${Date.now()}`,
    title,
    matches,
    isDuplicate: matches.length > 0,
    status:
      matches.length > 0
        ? "DUPLICATE_FOUND"
        : "UNIQUE",
    nextStep:
      matches.length > 0
        ? "REVIEW"
        : "CONTINUE",
    checkedAt: new Date().toISOString()
  };
}
