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
      autopilot?.status ||
      "held",

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
      Array.isArray(contentPackage?.hashtags)
        ? contentPackage.hashtags
        : [],

    safetyResult:
      autopilot?.safety ||
      null,

    publishingResult:
      autopilot?.schedule ||
      null,

    scheduledAt:
      autopilot?.schedule?.nextPublishAt ||
      autopilot?.schedule?.scheduledAt ||
      null,

    providerName: null,

    providerPostId: null,

    publishedAt: null,

    errorMessage: null,
  };
}

function buildArticle({
  articleId,
  title,
  summary,
  category,
  source,
  sourceUrl,
  content,
}) {
  return {
    id: articleId,
    articleId,

    title:
      String(title || "").trim(),

    headline:
      String(title || "").trim(),

    summary:
      String(summary || "").trim(),

    category:
      String(category || "").trim(),

    source:
      String(source || "").trim(),

    sourceUrl:
      String(sourceUrl || "").trim(),

    content:
      String(content || "").trim(),
  };
}

function buildAutopilotInput({
  article,
  platform,
  region,
  mode,
  timezone,
  contentPackage,
}) {
  return {
    title:
      contentPackage?.headline ||
      article.title,

    content:
      contentPackage?.content ||
      article.content,

    summary:
      article.summary,

    category:
      article.category,

    source:
      article.source,

    sourceUrl:
      article.sourceUrl,

    platform,

    region,

    mode,

    timezone,

    hasAttribution: true,

    exactSourceReproduction: false,

    duplicateMatch: false,
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

  const article =
    buildArticle({
      articleId,
      title,
      summary,
      category,
      source,
      sourceUrl,
      content,
    });

  const queueItems = [];

  const approvalItems = [];

  const evaluations = [];

  for (const platform of selectedPlatforms) {
    for (const region of selectedRegions) {
      let contentPackage = null;

      try {
        /*
         * IMPORTANT:
         * socialDistributionEngine expects:
         *
         * createSocialDistributionPackage(article, options)
         *
         * The previous version incorrectly sent one flat object.
         */
        contentPackage =
          await createSocialDistributionPackage(
            article,
            {
              platforms: [platform],
              region,
              previousContent: null,
            }
          );

        /*
         * The social engine returns a package containing
         * platform-specific packages.
         */
        if (
          Array.isArray(
            contentPackage?.packages
          )
        ) {
          contentPackage =
            contentPackage.packages.find(
              (item) =>
                String(
                  item?.platform || ""
                ).toLowerCase() ===
                platform
            ) ||
            contentPackage.packages[0] ||
            null;
        }

        if (
          !contentPackage ||
          typeof contentPackage !== "object"
        ) {
          throw new Error(
            "Social content package was not generated."
          );
        }
      } catch (error) {
        const errorMessage =
          error?.message ||
          "Social content generation failed.";

        evaluations.push({
          platform,
          region,
          status: "held",
          decision: "hold",
          riskLevel: "high",
          emergencyStop: false,
          reason: errorMessage,
          error: errorMessage,
        });

        queueItems.push({
          articleId,
          platform,
          region,
          status: "held",

          title:
            article.title,

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
              errorMessage,
            ],
          },

          publishingResult: null,
          scheduledAt: null,

          providerName: null,
          providerPostId: null,
          publishedAt: null,

          errorMessage,
        });

        continue;
      }

      let autopilot;

      try {
        const autopilotInput =
          buildAutopilotInput({
            article,
            platform,
            region,
            mode,
            timezone,
            contentPackage,
          });

        autopilot =
          await evaluateAutoPilot({
            db,
            ...autopilotInput,
          });
      } catch (error) {
        const errorMessage =
          error?.message ||
          "Auto-Pilot evaluation failed.";

        autopilot = {
          status: "held",
          decision: "hold",
          riskLevel: "high",
          emergencyStop: false,
          reason: errorMessage,

          safety: {
            riskLevel: "high",
            decision: "hold",
            reasons: [
              errorMessage,
            ],
          },

          schedule: null,
        };
      }

      let finalAutopilot =
        autopilot;

      /*
       * Only LOW-RISK auto_publish items
       * may enter the automatic scheduling step.
       *
       * Medium risk remains CEO approval.
       * High risk remains held.
       */
      if (
        autopilot?.decision ===
        "auto_publish"
      ) {
        try {
          const scheduleInput =
            buildAutopilotInput({
              article,
              platform,
              region,
              mode,
              timezone,
              contentPackage,
            });

          finalAutopilot =
            await createAutoPilotSchedule({
              db,
              ...scheduleInput,
            });
        } catch (error) {
          finalAutopilot = {
            ...autopilot,

            status: "held",

            decision: "hold",

            riskLevel:
              autopilot?.riskLevel ||
              "high",

            reason:
              error?.message ||
              "Auto-Pilot scheduling failed.",

            schedule: null,
          };
        }
      }

      evaluations.push({
        platform,
        region,

        status:
          finalAutopilot?.status ||
          "held",

        decision:
          finalAutopilot?.decision ||
          "hold",

        riskLevel:
          finalAutopilot?.riskLevel ||
          "high",

        emergencyStop:
          finalAutopilot?.emergencyStop ===
          true,

        reason:
          finalAutopilot?.reason ||
          "",
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

      /*
       * Medium-risk / assisted items go
       * to the CEO approval queue.
       */
      if (
        finalAutopilot?.status ===
        "ceo_approval"
      ) {
        approvalItems.push({
          articleId,

          platform,

          region,

          title:
            contentPackage?.headline ||
            article.title,

          content:
            contentPackage?.content ||
            article.content,

          decision:
            finalAutopilot?.decision ||
            "ceo_approval",

          riskLevel:
            finalAutopilot?.riskLevel ||
            "medium",

          safetyResult:
            finalAutopilot?.safety ||
            null,

          scheduleData:
            finalAutopilot?.schedule ||
            null,
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

  if (
    emergencyStopped > 0
  ) {
    nextStep =
      "Emergency STOP is active. Publishing remains held until the CEO releases it.";
  } else if (
    blocked > 0
  ) {
    nextStep =
      "Blocked content requires review before any publishing action.";
  } else if (
    held > 0
  ) {
    nextStep =
      "Held content requires safety/legal review.";
  } else if (
    approvals > 0
  ) {
    nextStep =
      "CEO approval is required for medium-risk or assisted-mode items.";
  } else if (
    scheduled > 0
  ) {
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

    integrationFixed: true,

    mediumRiskRequiresCEOApproval:
      true,

    highRiskIsHeld:
      true,

    lowRiskCanBeScheduled:
      true,
  };
}