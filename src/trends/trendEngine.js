const VALID_REGIONS = [
  "GLOBAL",
  "USA",
  "UK",
  "EUROPE",
  "PAKISTAN",
  "INDIA",
  "MIDDLE_EAST",
  "OTHER"
];

const VALID_CATEGORIES = [
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

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function analyzeTrend({
  topic,
  region = "GLOBAL",
  category = "Trending",
  searchInterest = 0,
  growthRate = 0
}) {
  const cleanTopic = cleanText(topic);

  if (!cleanTopic) {
    throw new Error("Trend topic is required.");
  }

  if (!VALID_REGIONS.includes(region)) {
    throw new Error("Invalid region.");
  }

  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error("Invalid category.");
  }

  const interest = Math.max(0, Number(searchInterest) || 0);
  const growth = Number(growthRate) || 0;

  let priority = "NORMAL";

  if (growth >= 100 || interest >= 80) {
    priority = "HIGH";
  }

  if (growth >= 200 || interest >= 95) {
    priority = "URGENT";
  }

  return {
    topic: cleanTopic,
    region,
    category,
    searchInterest: interest,
    growthRate: growth,
    priority,
    recommendedAction:
      priority === "URGENT"
        ? "Research immediately and send to safety review."
        : priority === "HIGH"
          ? "Prioritize research and prepare an article opportunity."
          : "Monitor trend before publishing.",
    status: "MONITORING",
    analyzedAt: new Date().toISOString()
  };
}

export function getSupportedRegions() {
  return [...VALID_REGIONS];
}

export function getSupportedCategories() {
  return [...VALID_CATEGORIES];
}
