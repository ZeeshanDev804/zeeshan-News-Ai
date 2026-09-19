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

/*
  Default platforms for global distribution.
*/
const DEFAULT_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram",
  "facebook",
  "x",
];

/*
  Normalize platform list.
*/
function normalizePlatforms(platforms) {
  if (!Array.isArray(platforms)) {
    return DEFAULT_PLATFORMS;
  }

  const cleaned = platforms
    .map((platform) =>
      String(platform || "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  return cleaned.length > 0
    ? [...new Set(cleaned)]
    : DEFAULT_PLATFORMS;
}

/*
  Normalize regions.
*/
function normalizeRegions(regions) {
  if (!Array.isArray(regions)) {
    return ["worldwide"];
  }

  const cleaned = regions
    .map((region) =>
      String(region || "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  return cleaned.length > 0
    ? [...new Set(cleaned)]
    : ["worldwide"];
}

/*
  Build one queue record from a distribution package
  and Auto-Pilot decision.
*/
function buildQueueItem(
  distributionPackage,
  autoPilotResult,
  schedule
) {
  const packageData =
    distributionPackage || {};

  const safetyResult =
    packageData.safetyResult ||
    packageData.safety_result ||
    {};

  const decision =
    autoPilotResult?.decision ||
    "hold";

  let status = "held";

  if (decision === "auto_publish") {
    status = "scheduled";
  }

  if (decision === "ceo_approval") {
    status = "ceo_approval";
  }

  if (decision === "hold") {
    status = "held";
  }

  if (decision === "blocked") {
    status = "blocked";
  }

  return {
    articleId:
      packageData.articleId ||
      packageData.article_id ||
      null,

    platform:
      packageData.platform ||
      "website",

    region:
      packageData.region ||
      "worldwide",

    status,

    title:
      packageData.title ||
      "",

    caption:
      packageData.caption ||
      packageData.content ||
      "",

    description:
      packageData.description ||
      "",

    hook:
      packageData.hook ||
      "",

    closing:
      packageData.closing ||
      "",

    callToAction:
      packageData.callToAction ||
      packageData.call_to_action ||
      "",

    thumbnailText:
      packageData.thumbnailText ||
      packageData.thumbnail_text ||
      "",

    pinnedComment:
      packageData.pinnedComment ||
      packageData.pinned_comment ||
      "",

    hashtags:
      packageData.hashtags ||
      [],

    safetyResult,

    decision,

    riskLevel:
      autoPilotResult?.riskLevel ||
      autoPilotResult?.risk_level ||
      safetyResult?.riskLevel ||
      safetyResult?.risk_level ||
      "medium",

    scheduleData:
      schedule || {},

    scheduledAt:
      schedule?.scheduledAt ||
      schedule?.scheduled_at ||
      null,

    providerName:
      packageData.providerName ||
      packageData.provider_name ||
      null,

    providerPostId:
      packageData.providerPostId ||
      packageData.provider_post_id ||
      null,
  };
}

/*
  Run complete content distribution orchestration.

  Flow:

  Article
    ↓
  Social Package Generation
    ↓
  Safety Evaluation
    ↓
  Auto-Pilot Decision
    ↓
  ├── auto_publish
  ├── ceo_approval
  ├── held
  └── blocked
    ↓
  Database Queue
    ↓
  CEO Approval Queue
*/
export async function runContentDistributionOrchestrator(
  options = {}
) {
  const {
    db = null,

    articleId = null,
    title = "",
    summary = "",
    category = "general",
    source = "",
    sourceUrl = "",
    content = "",

    platforms,
    regions,

    mode = "assisted",
    timezone = "UTC",

    saveToDatabase = true,
  } = options;

  if (!title || !String(title).trim()) {
    throw new Error(
      "title is required"
    );
  }

  const selectedPlatforms =
    normalizePlatforms(platforms);

  const selectedRegions =
    normalizeRegions(regions);

  const generatedPackages = [];

  const queueItems = [];

  const approvalItems = [];

  const autoPublishSchedules = [];

  const errors = [];

  /*
    Generate platform-specific packages.
  */
  for (const platform of selectedPlatforms) {
    for (const region of selectedRegions) {
      try {
        const distributionPackage =
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

        const autoPilotResult =
          evaluateAutoPilot({
            mode,
            platform,
            region,
            category,
            content:
              distributionPackage?.caption ||
              distributionPackage?.content ||
              "",
            safetyResult:
              distributionPackage?.safetyResult ||
              {},
          });

        let schedule = null;

        if (
          autoPilotResult?.decision ===
          "auto_publish"
        ) {
          schedule =
            createAutoPilotSchedule({
              platform,
              region,
              timezone,
              articleId,
              title,
            });
        }

        const queueItem =
          buildQueueItem(
            distributionPackage,
            autoPilotResult,
            schedule
          );

        generatedPackages.push(
          distributionPackage
        );

        queueItems.push(queueItem);

        /*
          CEO approval items are stored separately
          so the CEO dashboard can review them.
        */
        if (
          autoPilotResult?.decision ===
          "ceo_approval"
        ) {
          approvalItems.push({
            articleId,

            platform,

            region,

            title,

            content:
              distributionPackage?.caption ||
              distributionPackage?.content ||
              "",

            decision:
              "ceo_approval",

            riskLevel:
              autoPilotResult?.riskLevel ||
              "medium",

            safetyResult:
              distributionPackage?.safetyResult ||
              {},

            scheduleData:
              schedule || {},
          });
        }

        /*
          Keep track of automatically scheduled
          publishing jobs.
        */
        if (
          autoPilotResult?.decision ===
          "auto_publish"
        ) {
          autoPublishSchedules.push({
            platform,
            region,
            schedule,
            articleId,
            title,
          });
        }
      } catch (error) {
        console.error(
          `❌ Distribution failed for ${platform}/${region}:`,
          error.message
        );

        errors.push({
          platform,
          region,
          error: error.message,
        });
      }
    }
  }

  let savedDistribution = null;

  let savedCEOApprovals = null;

  /*
    Save distribution queue and CEO approvals.
  */
  if (
    saveToDatabase &&
    db
  ) {
    if (queueItems.length > 0) {
      savedDistribution =
        await saveDistributionBatch(
          db,
          queueItems
        );
    }

    if (approvalItems.length > 0) {
      savedCEOApprovals =
        await saveCEOApprovalQueue(
          db,
          approvalItems
        );
    }
  }

  /*
    Build final summary.
  */
  const summaryResult = {
    platforms:
      selectedPlatforms.length,

    regions:
      selectedRegions.length,

    generated:
      generatedPackages.length,

    queued:
      queueItems.length,

    ceoApprovalRequired:
      approvalItems.length,

    autoPublishScheduled:
      autoPublishSchedules.length,

    errors:
      errors.length,
  };

  let nextStep =
    "Review distribution results";

  if (
    approvalItems.length > 0
  ) {
    nextStep =
      "CEO approval is required for some distribution items";
  } else if (
    autoPublishSchedules.length > 0
  ) {
    nextStep =
      "Auto-Pilot schedules are ready for provider publishing";
  } else if (
    queueItems.length > 0
  ) {
    nextStep =
      "Distribution queue created";
  }

  return {
    success:
      errors.length === 0,

    articleId,

    mode,

    timezone,

    platforms:
      selectedPlatforms,

    regions:
      selectedRegions,

    packages:
      generatedPackages,

    queue:
      queueItems,

    approvals:
      approvalItems,

    autoPublishSchedules,

    savedDistribution,

    savedCEOApprovals,

    errors,

    summary:
      summaryResult,

    nextStep,
  };
}

/*
  Lightweight orchestrator status.
*/
export function getOrchestratorStatus() {
  return {
    name:
      "Content Distribution Orchestrator",

    status:
      "ready",

    modeSupport: [
      "off",
      "assisted",
      "auto",
    ],

    platforms:
      DEFAULT_PLATFORMS,

    flow: [
      "content generation",
      "safety evaluation",
      "auto-pilot decision",
      "distribution queue",
      "CEO approval",
      "scheduled publishing",
    ],

    databasePersistence:
      true,

    realPublishing:
      false,

    providerStatus:
      "not_connected",
  };
}