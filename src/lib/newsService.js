export async function getLatestNews(
  db,
  limit = 50
) {
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
      description,
      source,
      published_at,
      created_at,
      ai_summary,
      ai_category,
      ai_sentiment,
      is_analyzed
    FROM articles
    ORDER BY
      published_at DESC NULLS LAST,
      created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}


// ========================================
// NEWS COUNT
// ========================================

export async function getNewsCount(
  db
) {
  const result = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM articles
    `
  );

  return Number(
    result.rows[0].total
  );
}


// ========================================
// SEARCH NEWS
// ========================================

export async function searchNews(
  db,
  query,
  limit = 50
) {
  const searchTerm =
    String(query || "").trim();

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
      description,
      source,
      published_at,
      created_at,
      ai_summary,
      ai_category,
      ai_sentiment,
      is_analyzed
    FROM articles
    WHERE
      title ILIKE $1
      OR content ILIKE $1
      OR description ILIKE $1
      OR source ILIKE $1
      OR ai_summary ILIKE $1
    ORDER BY
      published_at DESC NULLS LAST,
      created_at DESC
    LIMIT $2
    `,
    [
      `%${searchTerm}%`,
      safeLimit,
    ]
  );

  return result.rows;
}


// ========================================
// GET ARTICLE BY ID
// ========================================

export async function getNewsById(
  db,
  articleId
) {
  const id =
    Number(articleId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  const result = await db.query(
    `
    SELECT
      id,
      title,
      link,
      content,
      description,
      source,
      published_at,
      created_at,
      ai_summary,
      ai_category,
      ai_sentiment,
      is_analyzed
    FROM articles
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  if (
    result.rows.length === 0
  ) {
    return null;
  }

  return result.rows[0];
}


// ========================================
// CATEGORY NEWS
// ========================================

export async function getNewsByCategory(
  db,
  category,
  limit = 50
) {
  const allowedCategories = [
    "world",
    "politics",
    "technology",
    "business",
    "sports",
    "entertainment",
  ];

  const normalizedCategory =
    String(category || "")
      .trim()
      .toLowerCase();

  if (
    !allowedCategories.includes(
      normalizedCategory
    )
  ) {
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
      description,
      source,
      published_at,
      created_at,
      ai_summary,
      ai_category,
      ai_sentiment,
      is_analyzed
    FROM articles
    WHERE LOWER(ai_category) = $1
    ORDER BY
      published_at DESC NULLS LAST,
      created_at DESC
    LIMIT $2
    `,
    [
      normalizedCategory,
      safeLimit,
    ]
  );

  return result.rows;
}


// ========================================
// CATEGORY COUNTS
// ========================================

export async function getCategoryCounts(
  db
) {
  const result = await db.query(
    `
    SELECT
      COALESCE(
        LOWER(ai_category),
        'world'
      ) AS category,
      COUNT(*)::INTEGER AS total
    FROM articles
    GROUP BY
      COALESCE(
        LOWER(ai_category),
        'world'
      )
    ORDER BY total DESC
    `
  );

  return result.rows;
}


// ========================================
// TRENDING NEWS
// ========================================

export async function getTrendingNews(
  db,
  limit = 10
) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    50
  );

  const result = await db.query(
    `
    SELECT
      id,
      title,
      link,
      content,
      description,
      source,
      published_at,
      created_at,
      ai_summary,
      ai_category,
      ai_sentiment,
      is_analyzed
    FROM articles
    ORDER BY
      (
        CASE
          WHEN published_at >= NOW() - INTERVAL '6 hours'
            THEN 100
          WHEN published_at >= NOW() - INTERVAL '24 hours'
            THEN 70
          WHEN published_at >= NOW() - INTERVAL '48 hours'
            THEN 40
          ELSE 10
        END
      )
      DESC,
      published_at DESC NULLS LAST,
      created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}