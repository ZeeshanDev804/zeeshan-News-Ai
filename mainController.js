import {
  createResearchTask,
  completeResearch
} from "./researchAgent.js";

import {
  createWritingTask,
  saveDraft
} from "./writerAgent.js";

import {
  createFactCheckTask
} from "./factCheckAgent.js";

export function startWorkflow({
  topic,
  region = "GLOBAL",
  category = "Trending"
}) {
  if (!topic) {
    throw new Error("Topic is required.");
  }

  const research = createResearchTask({
    topic,
    type: "NEWS",
    region
  });

  const writing = createWritingTask({
    topic,
    research,
    style: "NEWS"
  });

  return {
    id: `workflow_${Date.now()}`,
    topic,
    region,
    category,
    status: "ACTIVE",
    currentStage: "RESEARCH",
    research,
    writing,
    factCheck: null,
    createdAt: new Date().toISOString()
  };
}

export function finishResearch(workflow, findings = []) {
  workflow.research = completeResearch(
    workflow.research,
    findings
  );

  workflow.currentStage = "WRITING";

  return workflow;
}

export function finishWriting(workflow, draft) {
  workflow.writing = saveDraft(
    workflow.writing,
    draft
  );

  workflow.factCheck = createFactCheckTask({
    article: {
      title: workflow.writing.draft.headline,
      body: workflow.writing.draft.body
    },
    sources: workflow.research.sources
  });

  workflow.currentStage = "FACT_CHECK";

  return workflow;
}
