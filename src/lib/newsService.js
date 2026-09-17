export async function getLatestNews(db, limit = 50) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 50, 1),
    100
  );

  const result = await db.query(
    `
    SELECT
      id,
      title,
      link,
      content,
      source,
      published_at
    FROM articles
    ORDER BY published_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

export async function getNewsCount(db) {
  const result = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM articles
    `
  );

  return Number(result.rows[0].total);
}

export async function searchNews(db, query, limit = 50) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  const safeLimit = Math.min(
    Math.max(Number(limit) || 50, 1),
    100
  );

  const result = await db.query(
    `
    SELECT
      id,
      title,
      link,
      content,
      source,
      published_at
    FROM articles
    WHERE
      title ILIKE $1
      OR content ILIKE $1
      OR source ILIKE $1
    ORDER BY published_at DESC
    LIMIT $2
    `,
    [`%${searchTerm}%`, safeLimit]
  );

  return result.rows;
}
