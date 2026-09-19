import {
  createSocialDistributionPackage,
} from "./socialDistributionEngine.js";

import {
  saveDistributionBatch,
} from "./socialDistributionStore.js";

import {
  evaluateAutoPilot,
  createAutoPilotSchedule,
} from "./autoPilotEngine.js";

import {
  saveCEOApprovalQueue,
} from "./approvalDistributionBridge.js";

function normalizePlatforms(platforms) {
  const defaultPlatforms = [
    "youtube_shorts",
    "tiktok",
    "instagram",
    "facebook",
    "x",
  ];

  if (!Array.isArray(platforms)) {
    return defaultPlatforms;
  }

  const cleaned = platforms
    .map((platform) =>
      String(platform || "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  return cleaned.length
    ? [...new Set(cleaned)]
    : defaultPlatforms;
}

function normalizeRegions(regions) {
  const defaultRegions = [
    "worldwide",
  ];

  if (!Array.isArray(regions)) {
    return defaultRegions;
  }

  const cleaned = regions
    .map((region) =>
      String(region || "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  return cleaned.length
    ? [...new Set(cleaned)]
    : defaultRegions;
}

function buildQueueItem({
  articleId = null,
  platform,
  region,
  contentPackage,
  autopilot,
}) {
  return {
    articleId,

    platform,

    region,

    status:
      autopilot.status,

    title:
      contentPackage?.headline ||
      contentPackage?.title ||
      "",

    caption:
      contentPackage?.content ||
      contentPackage?.caption ||
      "",

    description:
      contentPackage?.description ||
      "",

    hook:
      contentPackage?.hook ||
      "",

    closing:
      contentPackage?.closing ||
      "",

    callToAction:
      contentPackage?.callToAction ||
      "",

    thumbnailText:
      contentPackage?.thumbnailText ||
      "",

    pinnedComment:
      contentPackage?.pinnedComment ||
      "",

    hashtags:
      contentPackage?.hashtags ||
      [],

    safetyResult:
      autopilot.safety ||
      null,

    publishingResult:
      autopilot.schedule ||
      null,

    scheduledAt:
      autopilot.schedule?.nextPublishAt ||
      autopilot.schedule?.scheduledAt ||
      null,

    providerName: null,

    providerPostId: null,

    publishedAt: null,

    errorMessage: null,
  };
}

export async function runContentDistributionOrchestrator({
  db = null,

  articleId = null,

  title = "",

  summary = "",

  category = "",

  source = "",

  sourceUrl = "",

  content = "",

  platforms = null,

  regions = null,

  mode = null,

  timezone = null,

  saveToDatabase = false,
} = {}) {
  const selectedPlatforms =
    normalizePlatforms(platforms);

  const selectedRegions =
    normalizeRegions(regions);

  const queueItems = [];

  const approvalItems = [];

  const evaluations = [];

  for (const platform of selectedPlatforms) {
    for (const region of selectedRegions) {
      let contentPackage;

      try {
        contentPackage =
          await createSocialDistributionPackage({
            articleId,
            title,
            summary,
            category,
            source,
            sourceUrl,
            content,
            platform,
            region,
            timezone,
          });
      } catch (error) {
        evaluations.push({
          platform,
          region,
          status: "held",
          decision: "hold",
          riskLevel: "high",
          error:
            error.message,
        });

        queueItems.push({
          articleId,
          platform,
          region,
          status: "held",
          title,
          caption: "",
          description: "",
          hook: "",
          closing: "",
          callToAction: "",
          thumbnailText: "",
          pinnedComment: "",
          hashtags: [],
          safetyResult: {
            riskLevel: "high",
            decision: "hold",
            reasons: [
              error.message,
            ],
          },
          publishingResult: null,
          scheduledAt: null,
          providerName: null,
          providerPostId: null,
          publishedAt: null,
          errorMessage:
            error.message,
        });

        continue;
      }

      const autopilot =
        await evaluateAutoPilot({
          db,

          title:
            contentPackage?.headline ||
            title,

          content:
            contentPackage?.content ||
            content,

          summary,

          category,

          source,

          sourceUrl,

          platform,

          region,

          mode,

          timezone,

          hasAttribution:
            true,

          exactSourceReproduction:
            false,

          duplicateMatch:
            false,
        });

      let finalAutopilot =
        autopilot;

      if (
        autopilot.decision ===
        "auto_publish"
      ) {
        finalAutopilot =
          await createAutoPilotSchedule({
            db,

            title:
              contentPackage?.headline ||
              title,

            content:
              contentPackage?.content ||
              content,

            summary,

            category,

            source,

            sourceUrl,

            platform,

            region,

            mode,

            timezone,

            hasAttribution:
              true,

            exactSourceReproduction:
              false,

            duplicateMatch:
              false,
          });
      }

      evaluations.push({
        platform,
        region,
        status:
          finalAutopilot.status,
        decision:
          finalAutopilot.decision,
        riskLevel:
          finalAutopilot.riskLevel,
        emergencyStop:
          finalAutopilot.emergencyStop,
        reason:
          finalAutopilot.reason,
      });

      const queueItem =
        buildQueueItem({
          articleId,
          platform,
          region,
          contentPackage,
          autopilot:
            finalAutopilot,
        });

      queueItems.push(
        queueItem
      );

      if (
        finalAutopilot.status ===
        "ceo_approval"
      ) {
        approvalItems.push({
          articleId,

          platform,

          region,

          title:
            contentPackage?.headline ||
            title,

          content:
            contentPackage?.content ||
            content,

          decision:
            finalAutopilot.decision,

          riskLevel:
            finalAutopilot.riskLevel,

          safetyResult:
            finalAutopilot.safety,

          scheduleData:
            finalAutopilot.schedule,
        });
      }
    }
  }

  let savedDistribution = null;

  if (
    saveToDatabase &&
    db &&
    queueItems.length
  ) {
    savedDistribution =
      await saveDistributionBatch(
        db,
        queueItems
      );
  }

  let savedApprovals = null;

  if (
    saveToDatabase &&
    db &&
    approvalItems.length
  ) {
    savedApprovals =
      await saveCEOApprovalQueue(
        db,
        approvalItems
      );
  }

  const scheduled =
    queueItems.filter(
      (item) =>
        item.status ===
        "scheduled"
    ).length;

  const approvals =
    queueItems.filter(
      (item) =>
        item.status ===
        "ceo_approval"
    ).length;

  const held =
    queueItems.filter(
      (item) =>
        item.status ===
        "held"
    ).length;

  const blocked =
    queueItems.filter(
      (item) =>
        item.status ===
        "blocked"
    ).length;

  const emergencyStopped =
    evaluations.filter(
      (item) =>
        item.emergencyStop ===
        true
    ).length;

  let nextStep =
    "No publishing action required.";

  if (emergencyStopped > 0) {
    nextStep =
      "Emergency STOP is active. Publishing remains held until the CEO releases it.";
  } else if (blocked > 0) {
    nextStep =
      "Blocked content requires review before any publishing action.";
  } else if (held > 0) {
    nextStep =
      "Held content requires safety/legal review.";
  } else if (approvals > 0) {
    nextStep =
      "CEO approval is required for medium-risk or assisted-mode items.";
  } else if (scheduled > 0) {
    nextStep =
      "Low-risk Auto-Pilot items are scheduled for publishing.";
  }

  return {
    success: true,

    articleId,

    mode,

    timezone,

    platforms:
      selectedPlatforms,

    regions:
      selectedRegions,

    totalItems:
      queueItems.length,

    scheduled,

    ceoApproval:
      approvals,

    held,

    blocked,

    emergencyStopped,

    evaluations,

    queue:
      queueItems,

    approvalItems,

    savedDistribution,

    savedApprovals,

    nextStep,
  };
}

export function getOrchestratorStatus() {
  return {
    name:
      "ZEESHAN NEWS AI Content Distribution Orchestrator",

    status: "ready",

    workflow: [
      "news",
      "ai_content",
      "safety_check",
      "autopilot_control",
      "regional_schedule",
      "ceo_approval",
      "distribution_queue",
      "publishing_provider",
    ],

    supportedModes: [
      "off",
      "assisted",
      "auto",
    ],

    humanControl: true,

    emergencyStop: true,

    realPublishingProvider:
      false,

    providerStatus:
      "not_connected",
  };
}