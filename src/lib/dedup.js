export function normalizeTitle(title = "") {
  return String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTitleWords(title = "") {
  return normalizeTitle(title)
    .split(" ")
    .filter((word) => word.length >= 3);
}

export function calculateTitleSimilarity(titleA, titleB) {
  const wordsA = new Set(getTitleWords(titleA));
  const wordsB = new Set(getTitleWords(titleB));

  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }

  let commonWords = 0;

  for (const word of wordsA) {
    if (wordsB.has(word)) {
      commonWords++;
    }
  }

  const totalUniqueWords = new Set([
    ...wordsA,
    ...wordsB,
  ]).size;

  if (totalUniqueWords === 0) {
    return 0;
  }

  return commonWords / totalUniqueWords;
}

export async function findSimilarArticle(
  db,
  title,
  threshold = 0.65
) {
  const normalizedTitle = normalizeTitle(title);

  if (!normalizedTitle) {
    return null;
  }

  const result = await db.query(
    `
    SELECT
      id,
      title,
      link,
      source,
      published_at
    FROM articles
    ORDER BY published_at DESC
    LIMIT 200
    `
  );

  for (const article of result.rows) {
    const similarity = calculateTitleSimilarity(
      normalizedTitle,
      article.title
    );

    if (similarity >= threshold) {
      return {
        duplicate: true,
        similarity,
        article,
      };
    }
  }

  return {
    duplicate: false,
    similarity: 0,
    article: null,
  };
}
