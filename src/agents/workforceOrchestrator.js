const WORKFLOW_STEPS = [
  "TREND_DETECTED",
  "RESEARCH",
  "WRITING",
  "FACT_CHECK",
  "ORIGINALITY",
  "MEDIA_RIGHTS",
  "SEO",
  "PUBLISH_REVIEW",
  "PUBLISHED",
  "DISTRIBUTION",
  "ANALYTICS"
];

const REVIEW_STEPS = [
  "FACT_CHECK",
  "ORIGINALITY",
  "MEDIA_RIGHTS",
  "PUBLISH_REVIEW"
];

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function createWorkforceJob({
  topic,
  category = "Trending",
  region = "GLOBAL"
}) {
  const cleanTopic = cleanText(topic);

  if (!cleanTopic) {
    throw new Error("Workforce topic is required.");
  }

  return {
    id: `workforce_${Date.now()}`,

    topic: cleanTopic,
    category: cleanText(category),
    region: cleanText(region),

    currentStep: "TREND_DETECTED",

    status: "ACTIVE",

    completedSteps: [],

    failedSteps: [],

    reviewQueue: [],

    agents: {
      trend: "READY",
      research: "WAITING",
      writer: "WAITING",
      factCheck: "WAITING",
      originality: "WAITING",
      mediaRights: "WAITING",
      seo: "WAITING",
      publisher: "WAITING",
      distribution: "WAITING",
      analytics: "WAITING"
    },

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function moveToNextStep(job) {
  if (!job || typeof job !== "object") {
    throw new Error("Workforce job is required.");
  }

  const currentIndex = WORKFLOW_STEPS.indexOf(job.currentStep);

  if (currentIndex === -1) {
    throw new Error("Invalid workflow step.");
  }

  if (!job.completedSteps.includes(job.currentStep)) {
    job.completedSteps.push(job.currentStep);
  }

  const nextStep = WORKFLOW_STEPS[currentIndex + 1];

  if (!nextStep) {
    job.status = "COMPLETED";
    job.updatedAt = new Date().toISOString();
    return job;
  }

  job.currentStep = nextStep;
  job.updatedAt = new Date().toISOString();

  return job;
}

export function sendToReview(job, reason) {
  if (!job || typeof job !== "object") {
    throw new Error("Workforce job is required.");
  }

  const cleanReason = cleanText(reason);

  if (!cleanReason) {
    throw new Error("Review reason is required.");
  }

  if (!REVIEW_STEPS.includes(job.currentStep)) {
    throw new Error(
      "Current workflow step does not require CEO review."
    );
  }

  job.reviewQueue.push({
    step: job.currentStep,
    reason: cleanReason,
    status: "WAITING_FOR_CEO",
    createdAt: new Date().toISOString()
  });

  job.status = "WAITING_FOR_CEO";
  job.updatedAt = new Date().toISOString();

  return job;
}

export function approveReview(job, step) {
  if (!job || typeof job !== "object") {
    throw new Error("Workforce job is required.");
  }

  const review = job.reviewQueue.find(
    (item) =>
      item.step === step &&
      item.status === "WAITING_FOR_CEO"
  );

  if (!review) {
    throw new Error("No pending CEO review found.");
  }

  review.status = "APPROVED";
  review.approvedAt = new Date().toISOString();

  job.status = "ACTIVE";
  job.updatedAt = new Date().toISOString();

  return moveToNextStep(job);
}

export function rejectReview(job, step, reason) {
  if (!job || typeof job !== "object") {
    throw new Error("Workforce job is required.");
  }

  const review = job.reviewQueue.find(
    (item) =>
      item.step === step &&
      item.status === "WAITING_FOR_CEO"
  );

  if (!review) {
    throw new Error("No pending CEO review found.");
  }

  review.status = "REJECTED";
  review.reason = cleanText(reason);

  job.status = "BLOCKED";
  job.updatedAt = new Date().toISOString();

  return job;
}

export function getWorkflowSteps() {
  return [...WORKFLOW_STEPS];
}
