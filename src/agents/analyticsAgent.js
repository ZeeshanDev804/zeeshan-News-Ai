const METRICS = [
  "VIEWS",
  "USERS",
  "CLICKS",
  "ENGAGEMENT",
  "SOCIAL_CLICKS",
  "AD_REVENUE"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createAnalyticsTask({
  articleId,
  title,
  category = "Trending"
}) {
  if (!articleId || !title) {
    throw new Error("Article ID and title are required.");
  }

  return {
    id: `analytics_${Date.now()}`,

    article: {
      id: cleanText(articleId),
      title: cleanText(title),
      category: cleanText(category)
    },

    metrics: {
      views: 0,
      users: 0,
      clicks: 0,
      engagement: 0,
      socialClicks: 0,
      adRevenue: null
    },

    countries: [],

    performance: {
      score: null,
      level: "PENDING"
    },

    recommendations: [],

    status: "COLLECTING_DATA",

    nextStep: "ANALYZE_PERFORMANCE",

    createdAt: new Date().toISOString()
  };
}

export function updateAnalytics(task, data = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Analytics task is required.");
  }

  task.metrics.views = Number(data.views) || 0;
  task.metrics.users = Number(data.users) || 0;
  task.metrics.clicks = Number(data.clicks) || 0;
  task.metrics.engagement = Number(data.engagement) || 0;
  task.metrics.socialClicks = Number(data.socialClicks) || 0;

  if (data.adRevenue !== undefined) {
    task.metrics.adRevenue = Number(data.adRevenue) || 0;
  }

  if (Array.isArray(data.countries)) {
    task.countries = data.countries;
  }

  task.status = "DATA_READY";
  task.nextStep = "ANALYZE_PERFORMANCE";

  return task;
}

export function analyzePerformance(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Analytics task is required.");
  }

  const {
    views,
    users,
    clicks,
    engagement,
    socialClicks
  } = task.metrics;

  let score = 0;

  if (views >= 1000) score += 25;
  if (views >= 10000) score += 25;

  if (users > 0 && clicks / users >= 0.03) {
    score += 15;
  }

  if (engagement >= 50) {
    score += 20;
  }

  if (socialClicks >= 100) {
    score += 15;
  }

  let level = "LOW";

  if (score >= 40) {
    level = "MEDIUM";
  }

  if (score >= 70) {
    level = "HIGH";
  }

  task.performance = {
    score,
    level
  };

  task.recommendations = [];

  if (views < 1000) {
    task.recommendations.push(
      "Improve headline, SEO and distribution."
    );
  }

  if (users > 0 && clicks / users < 0.03) {
    task.recommendations.push(
      "Review article links and calls to action."
    );
  }

  if (engagement < 50) {
    task.recommendations.push(
      "Improve article usefulness, structure and readability."
    );
  }

  if (socialClicks < 100) {
    task.recommendations.push(
      "Test stronger social content and timing."
    );
  }

  task.status = "ANALYSIS_COMPLETE";
  task.nextStep = "AI_OPTIMIZATION";

  return task;
}

export function getSupportedMetrics() {
  return [...METRICS];
}
