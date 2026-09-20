const DEFAULT_LIMIT = 20;

const SCORE_WEIGHTS = {
  recency: 35,
  source: 20,
  engagement: 20,
  velocity: 15,
  uniqueness: 10,
};

function safeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function clamp(
  value,
  min = 0,
  max = 100
) {
  return Math.min(
    Math.max(
      safeNumber(value),
      min
    ),
    max
  );
}

/* =========================
   RECENCY SCORE
========================= */

export function calculateRecencyScore(
  publishedAt
) {
  if (!publishedAt) {
    return 0;
  }

  const publishedTime =
    new Date(
      publishedAt
    ).getTime();

  if (
    !Number.isFinite(
      publishedTime
    )
  ) {
    return 0;
  }

  const ageHours =
    Math.max(
      (
        Date.now() -
        publishedTime
      ) /
        (1000 * 60 * 60),
      0
    );

  if (ageHours <= 1) {
    return 100;
  }

  if (ageHours <= 3) {
    return 90;
  }

  if (ageHours <= 6) {
    return 80;
  }

  if (ageHours <= 12) {
    return 65;
  }

  if (ageHours <= 24) {
    return 50;
  }

  if (ageHours <= 48) {
    return 30;
  }

  if (ageHours <= 72) {
    return 15;
  }

  return 5;
}

/* =========================
   SOURCE SCORE
========================= */

export function calculateSourceScore(
  article = {}
) {
  const explicitScore =
    safeNumber(
      article.source_score,
      NaN
    );

  if (
    Number.isFinite(
      explicitScore
    )
  ) {
    return clamp(
      explicitScore
    );
  }

  const trusted =
    article.source_trusted === true ||
    article.sourceVerified === true ||
    article.verified_source === true;

  return trusted
    ? 100
    : 50;
}

/* =========================
   ENGAGEMENT SCORE
========================= */

export function calculateEngagementScore(
  article = {}
) {
  const views =
    safeNumber(
      article.views ??
        article.view_count
    );

  const likes =
    safeNumber(
      article.likes ??
        article.like_count
    );

  const shares =
    safeNumber(
      article.shares ??
        article.share_count
    );

  const comments =
    safeNumber(
      article.comments ??
        article.comment_count
    );

  const raw =
    views * 0.01 +
    likes * 2 +
    shares * 4 +
    comments * 3;

  return clamp(
    Math.min(
      raw,
      100
    )
  );
}

/* =========================
   VELOCITY SCORE
========================= */

export function calculateVelocityScore(
  article = {}
) {
  const recentViews =
    safeNumber(
      article.recent_views ??
        article.views_last_hour
    );

  const recentShares =
    safeNumber(
      article.recent_shares ??
        article.shares_last_hour
    );

  const recentComments =
    safeNumber(
      article.recent_comments ??
        article.comments_last_hour
    );

  const velocity =
    recentViews * 0.05 +
    recentShares * 5 +
    recentComments * 3;

  return clamp(
    Math.min(
      velocity,
      100
    )
  );
}

/* =========================
   UNIQUENESS SCORE
========================= */

export function calculateUniquenessScore(
  article = {}
) {
  const duplicateScore =
    safeNumber(
      article.duplicate_score,
      0
    );

  const similarityScore =
    safeNumber(
      article.similarity_score,
      0
    );

  if (
    duplicateScore > 0 ||
    similarityScore > 0
  ) {
    return clamp(
      100 -
        Math.max(
          duplicateScore,
          similarityScore
        )
    );
  }

  return 100;
}

/* =========================
   TRENDING SCORE
========================= */

export function calculateTrendingScore(
  article = {}
) {
  const recency =
    calculateRecencyScore(
      article.published_at ??
        article.publishedAt ??
        article.created_at
    );

  const source =
    calculateSourceScore(
      article
    );

  const engagement =
    calculateEngagementScore(
      article
    );

  const velocity =
    calculateVelocityScore(
      article
    );

  const uniqueness =
    calculateUniquenessScore(
      article
    );

  const score =
    recency *
      (SCORE_WEIGHTS.recency /
        100) +
    source *
      (SCORE_WEIGHTS.source /
        100) +
    engagement *
      (SCORE_WEIGHTS.engagement /
        100) +
    velocity *
      (SCORE_WEIGHTS.velocity /
        100) +
    uniqueness *
      (SCORE_WEIGHTS.uniqueness /
        100);

  return Math.round(
    clamp(score) *
      100
  ) / 100;
}

/* =========================
   TREND LEVEL
========================= */

export function getTrendLevel(
  score
) {
  const value =
    safeNumber(
      score
    );

  if (value >= 80) {
    return "viral";
  }

  if (value >= 65) {
    return "hot";
  }

  if (value >= 45) {
    return "rising";
  }

  if (value >= 25) {
    return "normal";
  }

  return "low";
}

/* =========================
   ARTICLE ANALYSIS
========================= */

export function analyzeTrendingArticle(
  article = {}
) {
  const score =
    calculateTrendingScore(
      article
    );

  return {
    articleId:
      article.id ??
      article.article_id ??
      null,

    title:
      article.title ||
      article.headline ||
      "",

    score,

    level:
      getTrendLevel(
        score
      ),

    signals: {
      recency:
        calculateRecencyScore(
          article.published_at ??
            article.publishedAt ??
            article.created_at
        ),

      source:
        calculateSourceScore(
          article
        ),

      engagement:
        calculateEngagementScore(
          article
        ),

      velocity:
        calculateVelocityScore(
          article
        ),

      uniqueness:
        calculateUniquenessScore(
          article
        ),
    },

    analyzedAt:
      new Date().toISOString(),
  };
}

/* =========================
   RANK ARTICLES
========================= */

export function rankTrendingArticles(
  articles = [],
  limit = DEFAULT_LIMIT
) {
  if (
    !Array.isArray(
      articles
    )
  ) {
    return [];
  }

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) ||
          DEFAULT_LIMIT,
        1
      ),
      100
    );

  return articles
    .map(
      (article) =>
        analyzeTrendingArticle(
          article
        )
    )
    .sort(
      (a, b) =>
        b.score -
        a.score
    )
    .slice(
      0,
      safeLimit
    )
    .map(
      (
        item,
        index
      ) => ({
        ...item,
        rank:
          index + 1,
      })
    );
}

/* =========================
   CATEGORY TRENDS
========================= */

export function getCategoryTrends(
  articles = []
) {
  const groups =
    new Map();

  for (
    const article of articles
  ) {
    const category =
      String(
        article.category ||
          article.section ||
          "general"
      )
        .trim()
        .toLowerCase();

    const score =
      calculateTrendingScore(
        article
      );

    const existing =
      groups.get(
        category
      ) || {
        category,
        articleCount: 0,
        totalScore: 0,
        highestScore: 0,
      };

    existing.articleCount +=
      1;

    existing.totalScore +=
      score;

    existing.highestScore =
      Math.max(
        existing.highestScore,
        score
      );

    groups.set(
      category,
      existing
    );
  }

  return Array.from(
    groups.values()
  )
    .map(
      (item) => ({
        ...item,

        averageScore:
          item.articleCount > 0
            ? Math.round(
                (
                  item.totalScore /
                  item.articleCount
                ) *
                  100
              ) / 100
            : 0,

        level:
          getTrendLevel(
            item.highestScore
          ),
      })
    )
    .sort(
      (a, b) =>
        b.averageScore -
        a.averageScore
    );
}

/* =========================
   TRENDING STATUS
========================= */

export function getTrendingIntelligenceStatus() {
  return {
    enabled: true,

    engine:
      "ZEESHAN NEWS AI Trending Intelligence",

    scoring: {
      recency:
        SCORE_WEIGHTS.recency,

      source:
        SCORE_WEIGHTS.source,

      engagement:
        SCORE_WEIGHTS.engagement,

      velocity:
        SCORE_WEIGHTS.velocity,

      uniqueness:
        SCORE_WEIGHTS.uniqueness,
    },

    levels: [
      "viral",
      "hot",
      "rising",
      "normal",
      "low",
    ],

    maximumRankedArticles:
      100,

    artificialTraffic:
      false,

    fakeEngagement:
      false,
  };
}
