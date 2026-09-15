const RESEARCH_TYPES = [
  "NEWS",
  "TREND",
  "SPORTS",
  "ENTERTAINMENT",
  "AI_TECH",
  "BUSINESS",
  "HOW_TO"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createResearchTask({
  topic,
  type = "NEWS",
  region = "GLOBAL"
}) {
  const cleanTopic = cleanText(topic);

  if (!cleanTopic) {
    throw new Error("Research topic is required.");
  }

  if (!RESEARCH_TYPES.includes(type)) {
    throw new Error("Invalid research type.");
  }

  return {
    id: `research_${Date.now()}`,
    topic: cleanTopic,
    type,
    region,
    status: "QUEUED",

    instructions: [
      "Find relevant reliable sources.",
      "Compare information from multiple sources.",
      "Identify important facts and dates.",
      "Detect conflicting information.",
      "Do not copy source articles.",
      "Prepare original research notes.",
      "Send risky or unclear information to safety review."
    ],

    sources: [],

    findings: [],

    risk: {
      level: "PENDING",
      issues: []
    },

    nextStep: "SOURCE_COLLECTION",

    createdAt: new Date().toISOString()
  };
}

export function addResearchSource(task, source) {
  if (!task || typeof task !== "object") {
    throw new Error("Research task is required.");
  }

  if (!source?.url) {
    throw new Error("Source URL is required.");
  }

  task.sources.push({
    name: cleanText(source.name || "Unknown Source"),
    url: cleanText(source.url),
    publishedAt: source.publishedAt || null,
    reliability: source.reliability || "PENDING",
    checkedAt: new Date().toISOString()
  });

  return task;
}

export function completeResearch(task, findings = []) {
  if (!task || typeof task !== "object") {
    throw new Error("Research task is required.");
  }

  task.findings = findings
    .map(cleanText)
    .filter(Boolean);

  task.status = "RESEARCH_COMPLETE";
  task.nextStep = "FACT_CHECK";

  return task;
}

export function getResearchTypes() {
  return [...RESEARCH_TYPES];
}
