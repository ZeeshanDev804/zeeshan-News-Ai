const WRITING_STYLES = [
  "NEWS",
  "EXPLAINER",
  "SPORTS",
  "ENTERTAINMENT",
  "TECH",
  "BUSINESS",
  "HOW_TO"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createWritingTask({
  topic,
  research,
  style = "NEWS"
}) {
  const cleanTopic = cleanText(topic);

  if (!cleanTopic) {
    throw new Error("Writing topic is required.");
  }

  if (!WRITING_STYLES.includes(style)) {
    throw new Error("Invalid writing style.");
  }

  return {
    id: `writer_${Date.now()}`,
    topic: cleanTopic,
    style,

    research: {
      sources: research?.sources || [],
      findings: research?.findings || []
    },

    instructions: [
      "Write original content.",
      "Use research findings as facts, not as copied text.",
      "Do not copy source articles.",
      "Do not invent quotes, statistics or events.",
      "Clearly separate confirmed facts from uncertain information.",
      "Keep the article useful and readable.",
      "Prepare content for SEO optimization."
    ],

    draft: {
      headline: "",
      summary: "",
      body: "",
      keyFacts: [],
      sourceNotes: []
    },

    status: "WRITING_QUEUED",
    nextStep: "GENERATE_DRAFT",

    createdAt: new Date().toISOString()
  };
}

export function saveDraft(task, draft = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Writing task is required.");
  }

  task.draft = {
    headline: cleanText(draft.headline),
    summary: cleanText(draft.summary),
    body: cleanText(draft.body),
    keyFacts: Array.isArray(draft.keyFacts)
      ? draft.keyFacts.map(cleanText).filter(Boolean)
      : [],
    sourceNotes: Array.isArray(draft.sourceNotes)
      ? draft.sourceNotes.map(cleanText).filter(Boolean)
      : []
  };

  task.status = "DRAFT_READY";
  task.nextStep = "FACT_CHECK";

  return task;
}

export function getWritingStyles() {
  return [...WRITING_STYLES];
}
