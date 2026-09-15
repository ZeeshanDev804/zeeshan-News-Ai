import { createResearchTask } from "./researchAgent.js";
import { createWritingTask } from "./writerAgent.js";
import { createFactCheckTask } from "./factCheckAgent.js";
import { createOriginalityTask } from "./originalityAgent.js";
import { createSEOTask } from "./seoAgent.js";

export function startContentPipeline({
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
    id: `pipeline_${Date.now()}`,

    topic,
    region,
    category,

    stages: {
      research,
      writing,
      factCheck: null,
      originality: null,
      seo: null
    },

    status: "RESEARCH",
    nextStep: "COLLECT_SOURCES",

    createdAt: new Date().toISOString()
  };
}

export function createVerificationTasks(
  pipeline,
  article
) {
  if (!pipeline || !article) {
    throw new Error(
      "Pipeline and article are required."
    );
  }

  pipeline.stages.factCheck =
    createFactCheckTask({
      article,
      sources:
        pipeline.stages.research.sources
    });

  pipeline.stages.originality =
    createOriginalityTask({
      title: article.title,
      body: article.body
    });

  pipeline.status = "VERIFICATION";
  pipeline.nextStep = "FACT_AND_ORIGINALITY_CHECK";

  return pipeline;
}

export function createSEOTaskForArticle(
  pipeline,
  article
) {
  pipeline.stages.seo =
    createSEOTask(article);

  pipeline.status = "SEO";
  pipeline.nextStep = "OPTIMIZE";

  return pipeline;
}
