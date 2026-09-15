function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createCEOReport({
  date,
  content = {},
  traffic = {},
  revenue = {},
  risks = [],
  tasks = [],
  recommendations = []
}) {
  return {
    id: `ceo_report_${Date.now()}`,

    date: date || new Date().toISOString(),

    content: {
      published: Number(content.published) || 0,
      drafts: Number(content.drafts) || 0,
      trending: Number(content.trending) || 0,
      videos: Number(content.videos) || 0
    },

    traffic: {
      views: Number(traffic.views) || 0,
      users: Number(traffic.users) || 0,
      countries: Array.isArray(traffic.countries)
        ? traffic.countries
        : []
    },

    revenue: {
      adSense: revenue.adSense ?? null,
      currency: revenue.currency || "USD"
    },

    risks: Array.isArray(risks)
      ? risks.map(cleanText).filter(Boolean)
      : [],

    tasks: Array.isArray(tasks)
      ? tasks.map(cleanText).filter(Boolean)
      : [],

    recommendations: Array.isArray(recommendations)
      ? recommendations.map(cleanText).filter(Boolean)
      : [],

    status: "GENERATED",

    nextStep: "CEO_REVIEW",

    createdAt: new Date().toISOString()
  };
}

export function addCEORecommendation(report, recommendation) {
  if (!report || typeof report !== "object") {
    throw new Error("CEO report is required.");
  }

  const cleanRecommendation = cleanText(recommendation);

  if (!cleanRecommendation) {
    throw new Error("Recommendation is required.");
  }

  report.recommendations.push(cleanRecommendation);

  return report;
}

export function markReportReviewed(report) {
  if (!report || typeof report !== "object") {
    throw new Error("CEO report is required.");
  }

  report.status = "REVIEWED";
  report.nextStep = "NEXT_DAY_OPERATIONS";
  report.reviewedAt = new Date().toISOString();

  return report;
}
