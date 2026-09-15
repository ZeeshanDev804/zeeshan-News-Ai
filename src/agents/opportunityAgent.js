const OPPORTUNITY_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function analyzeOpportunity({
  topic,
  region = "GLOBAL",
  category = "Trending",
  searchInterest = 0,
  growthRate = 0,
  competition = 50,
  freshness = 50
}) {
  const cleanTopic = cleanText(topic);

  if (!cleanTopic) {
    throw new Error("Opportunity topic is required.");
  }

  const interest = clamp(Number(searchInterest) || 0, 0, 100);
  const growth = clamp(Number(growthRate) || 0, 0, 300);
  const competitionScore = clamp(Number(competition) || 0, 0, 100);
  const freshnessScore = clamp(Number(freshness) || 0, 0, 100);

  const growthScore = Math.min(growth / 3, 100);

  const score = Math.round(
    interest * 0.35 +
    growthScore * 0.30 +
    (100 - competitionScore) * 0.20 +
    freshnessScore * 0.15
  );

  let level = "LOW";

  if (score >= 40) {
    level = "MEDIUM";
  }

  if (score >= 70) {
    level = "HIGH";
  }

  if (score >= 85) {
    level = "URGENT";
  }

  return {
    id: `opportunity_${Date.now()}`,

    topic: cleanTopic,
    region,
    category,

    signals: {
      searchInterest: interest,
      growthRate: growth,
      competition: competitionScore,
      freshness: freshnessScore
    },

    score,
    level,

    recommendation:
      level === "URGENT"
        ? "Prioritize immediately and send to research."
        : level === "HIGH"
          ? "Prioritize research and prepare content."
          : level === "MEDIUM"
            ? "Monitor and research if supporting signals improve."
            : "Monitor only.",

    status: "ANALYZED",

    nextStep:
      level === "HIGH" || level === "URGENT"
        ? "RESEARCH"
        : "MONITOR",

    analyzedAt: new Date().toISOString()
  };
}

export function getOpportunityLevels() {
  return [...OPPORTUNITY_LEVELS];
}
