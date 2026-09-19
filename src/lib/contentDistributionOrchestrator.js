import {
  createSocialDistributionPackage,
} from "./socialDistributionEngine.js";

import {
  saveDistributionBatch,
} from "./socialDistributionStore.js";

import {
  evaluateAutoPilot,
  createAutoPilotSchedule,
  createCEOApprovalItem,
} from "./autoPilotEngine.js";


const DEFAULT_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram",
  "facebook",
  "x",
];


function normalizeText(
  value,
  maxLength = 5000
) {
  return String(
    value || ""
  )
    .trim()
    .slice(0, maxLength);
}


function normalizePlatforms(
  platforms
) {
  if (
    !Array.isArray(
      platforms
    ) ||
    platforms.length === 0
  ) {
    return [
      ...DEFAULT_PLATFORMS,
    ];
  }

  return [
    ...new Set(
      platforms
        .map(
          (platform) =>
            normalizeText(
              platform,
              50
            ).toLowerCase()
        )
        .filter(Boolean),
    ),
  ];
}


function buildPlatformDecision(
  {
    platform,
    article,
    packageItem,
    autoPilotSettings,
  }
) {
  const content =
    packageItem?.content ||
    {};


  const safety =
    packageItem?.safety ||
    {};


  const autoPilot =
    evaluateAutoPilot({
      content: {
        title:
          content.title ||
          article.title,

        content:
          content.caption ||
          content.description ||
          "",

        headline:
          content.title ||
          article.title,

        summary:
          article.ai_summary ||
          article.description ||
          "",

        category:
          article.ai_category ||
          "general",

        source:
          article.source ||
          "Unknown",

        thumbnailText:
          content.thumbnailText ||
          "",

        platform,

        originalContent:
          article.content ||
          "",
      },

      settings:
        autoPilotSettings,

      platform,
    });


  return {
    platform,

    safety,

    autoPilot,

    decision:
      autoPilot.decision,

    status:
      autoPilot.status,

    reason:
      autoPilot.reason ||
      null,
  };
}


export async function runContentDistributionOrchestrator(
  {
    db,
    article,
    platforms,
    region = "Worldwide",
    autoPilotSettings = {},
    previousContent = [],
  } = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }


  if (
    !article ||
    !article.title
  ) {
    throw new Error(
      "Article with title is required"
    );
  }


  const selectedPlatforms =
    normalizePlatforms(
      platforms
    );


  /*
    STEP 1
    Generate platform-specific content
  */

  const generated =
    await createSocialDistributionPackage(
      article,
      {
        platforms:
          selectedPlatforms,

        region,

        previousContent,
      }
    );


  const decisions = [];


  /*
    STEP 2
    Auto-Pilot decision for every platform
  */

  for (
    const packageItem of
      generated.packages ||
      []
  ) {
    const platform =
      packageItem.platform;


    const decision =
      buildPlatformDecision({
        platform,

        article,

        packageItem,

        autoPilotSettings,
      });


    decisions.push(
      decision
    );
  }


  /*
    STEP 3
    Prepare final queue items
  */

  const queuePackages = [];


  for (
    const decision of
      decisions
  ) {
    const packageItem =
      (
        generated.packages ||
        []
      ).find(
        (item) =>
          item.platform ===
          decision.platform
      );


    if (!packageItem) {
      continue;
    }


    let finalStatus =
      "draft";


    if (
      decision.decision ===
      "auto_publish"
    ) {
      finalStatus =
        "scheduled";

    } else if (
      decision.decision ===
      "ceo_approval"
    ) {
      finalStatus =
        "ceo_approval";

    } else if (
      decision.decision ===
      "hold"
    ) {
      finalStatus =
        "held";
    }


    queuePackages.push({
      platform:
        decision.platform,

      status:
        finalStatus,

      content:
        packageItem.content ||
        {},

      safety:
        decision.safety ||
        {},

      publishing: {
        autoPilot:
          decision.autoPilot ||
          {},

        decision:
          decision.decision,

        status:
          finalStatus,

        providerConnected:
          false,

        published:
          false,
      },
    });
  }


  /*
    STEP 4
    Save everything into DB
  */

  const saved =
    await saveDistributionBatch(
      db,
      {
        articleId:
          article.id ||
          null,

        region,

        packages:
          queuePackages,
      }
    );


  /*
    STEP 5
    Build CEO approval queue
  */

  const approvalQueue =
    [];


  for (
    const decision of
      decisions
  ) {
    if (
      decision.decision !==
      "ceo_approval"
    ) {
      continue;
    }


    const packageItem =
      (
        generated.packages ||
        []
      ).find(
        (item) =>
          item.platform ===
          decision.platform
      );


    const approval =
      createCEOApprovalItem({
        article,

        platform:
          decision.platform,

        content:
          packageItem?.content ||
          {},

        safety:
          decision.safety,

        reason:
          decision.reason ||
          "CEO approval required",
      });


    approvalQueue.push(
      approval
    );
  }


  /*
    STEP 6
    Build Auto-Pilot schedules
  */

  const schedules =
    [];


  for (
    const decision of
      decisions
  ) {
    if (
      decision.decision !==
      "auto_publish"
    ) {
      continue;
    }


    const packageItem =
      (
        generated.packages ||
        []
      ).find(
        (item) =>
          item.platform ===
          decision.platform
      );


    if (!packageItem) {
      continue;
    }


    const schedule =
      createAutoPilotSchedule({
        article,

        platform:
          decision.platform,

        region,

        content:
          packageItem.content ||
          {},

        safety:
          decision.safety,

        settings:
          autoPilotSettings,
      });


    schedules.push({
      platform:
        decision.platform,

      schedule,
    });
  }


  /*
    FINAL SYSTEM REPORT
  */

  const summary = {
    totalPlatforms:
      selectedPlatforms.length,

    generated:
      generated.packages
        ?.filter(
          (item) =>
            item.status !==
            "generation_failed"
        )
        .length ||
      0,

    autoPublish:
      decisions.filter(
        (item) =>
          item.decision ===
          "auto_publish"
      ).length,

    ceoApproval:
      decisions.filter(
        (item) =>
          item.decision ===
          "ceo_approval"
      ).length,

    held:
      decisions.filter(
        (item) =>
          item.decision ===
          "hold"
      ).length,

    blocked:
      decisions.filter(
        (item) =>
          item.status ===
          "blocked"
      ).length,

    providerConnected:
      false,

    actualPublishing:
      false,
  };


  return {
    success: true,

    type:
      "content_distribution_orchestration",

    status:
      "processed",

    article: {
      id:
        article.id ||
        null,

      title:
        normalizeText(
          article.title,
          1000
        ),

      category:
        normalizeText(
          article.ai_category ||
            "general",
          100
        ),

      source:
        normalizeText(
          article.source ||
            "Unknown",
          200
        ),
    },

    region,

    platforms:
      selectedPlatforms,

    summary,

    generated,

    decisions,

    saved,

    approvalQueue,

    schedules,

    nextStep:
      summary.autoPublish >
      0
        ? "video_or_social_provider_required"
        : summary.ceoApproval >
            0
          ? "ceo_review_required"
          : summary.held >
              0
            ? "safety_review_required"
            : "no_action",

    generatedAt:
      new Date().toISOString(),
  };
}


export function getOrchestratorStatus() {
  return {
    success: true,

    engine:
      "ZEESHAN NEWS AI Content Distribution Orchestrator",

    status:
      "ready",

    workflow: [
      "news",
      "ai_content",
      "safety",
      "auto_pilot",
      "ceo_approval",
      "regional_schedule",
      "distribution_queue",
      "provider",
      "publish",
    ],

    autoPilot:
      true,

    ceoApproval:
      true,

    safetyLayer:
      true,

    regionalScheduling:
      true,

    providerConnected:
      false,

    actualPublishing:
      false,

    generatedAt:
      new Date().toISOString(),
  };
}
