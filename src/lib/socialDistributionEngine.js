import {
  generateSocialContent,
} from "./aiContentGenerator.js";

import {
  evaluateContentSafety,
} from "./contentSafetyEngine.js";

import {
  createPublishingSchedule,
  getRegionalPublishingPlan,
} from "./publishingScheduler.js";


const PLATFORMS = [
  "youtube",
  "youtube_shorts",
  "tiktok",
  "instagram",
  "facebook",
  "x",
];


const PLATFORM_LIMITS = {
  youtube: {
    title: 100,
    description: 5000,
    hashtags: 15,
  },

  youtube_shorts: {
    title: 100,
    description: 5000,
    hashtags: 15,
  },

  tiktok: {
    title: 150,
    description: 2200,
    hashtags: 10,
  },

  instagram: {
    title: 150,
    description: 2200,
    hashtags: 10,
  },

  facebook: {
    title: 255,
    description: 63206,
    hashtags: 10,
  },

  x: {
    title: 280,
    description: 280,
    hashtags: 5,
  },
};


function cleanText(value, maxLength = 5000) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}


function normalizePlatform(platform) {
  const value = String(platform || "")
    .trim()
    .toLowerCase();

  if (PLATFORMS.includes(value)) {
    return value;
  }

  return "youtube_shorts";
}


function normalizePlatforms(platforms) {
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return [
      "youtube_shorts",
      "tiktok",
      "instagram",
    ];
  }

  return [
    ...new Set(
      platforms
        .map(normalizePlatform)
        .filter(Boolean)
    ),
  ];
}


function normalizeHashtags(hashtags, limit) {
  if (!Array.isArray(hashtags)) {
    return [];
  }

  const normalized = hashtags
    .map((item) => cleanText(item, 80))
    .filter(Boolean)
    .map((item) => {
      const value = item.startsWith("#")
        ? item.slice(1)
        : item;

      const compact = value
        .replace(/\s+/g, "")
        .replace(/[^a-zA-Z0-9_]/g, "");

      return compact
        ? `#${compact}`
        : "";
    })
    .filter(Boolean);

  return [
    ...new Set(normalized),
  ].slice(0, limit);
}


function parseJSON(value) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  const text = String(value || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const firstObject = text.indexOf("{");
    const lastObject = text.lastIndexOf("}");

    if (
      firstObject >= 0 &&
      lastObject > firstObject
    ) {
      try {
        return JSON.parse(
          text.slice(
            firstObject,
            lastObject + 1
          )
        );
      } catch {
        return null;
      }
    }

    return null;
  }
}


function getPlatformLimits(platform) {
  return (
    PLATFORM_LIMITS[platform] ||
    PLATFORM_LIMITS.youtube_shorts
  );
}


function createSafePackage(
  generated,
  platform
) {
  const limits =
    getPlatformLimits(platform);

  const title = cleanText(
    generated?.title,
    limits.title
  );

  const caption = cleanText(
    generated?.caption,
    limits.description
  );

  const description = cleanText(
    generated?.description || caption,
    limits.description
  );

  const hook = cleanText(
    generated?.hook,
    500
  );

  const closing = cleanText(
    generated?.closing,
    500
  );

  const callToAction = cleanText(
    generated?.callToAction ||
      generated?.call_to_action ||
      generated?.cta,
    300
  );

  const thumbnailText = cleanText(
    generated?.thumbnailText ||
      generated?.thumbnail_text,
    150
  );

  const pinnedComment = cleanText(
    generated?.pinnedComment ||
      generated?.pinned_comment,
    500
  );

  const hashtags = normalizeHashtags(
    generated?.hashtags,
    limits.hashtags
  );

  return {
    title,
    caption,
    description,
    hook,
    closing,
    callToAction,
    thumbnailText,
    pinnedComment,
    hashtags,
  };
}


function createGenerationFailure(
  platform,
  error
) {
  return {
    platform,

    status: "generation_failed",

    error: cleanText(
      error?.message ||
        "Social content generation failed.",
      1000
    ),

    publishing: {
      ready: false,
      published: false,
      providerConnected: false,
    },

    createdAt:
      new Date().toISOString(),
  };
}


function resolvePublishingStatus(
  decision
) {
  const normalizedDecision =
    String(decision || "")
      .trim()
      .toLowerCase();

  if (
    normalizedDecision ===
    "auto_publish"
  ) {
    return {
      status: "ready",
      ready: true,
    };
  }

  if (
    normalizedDecision ===
      "ceo_approval" ||
    normalizedDecision ===
      "approval" ||
    normalizedDecision ===
      "review"
  ) {
    return {
      status: "ceo_approval",
      ready: false,
    };
  }

  if (
    normalizedDecision ===
      "reject" ||
    normalizedDecision ===
      "blocked"
  ) {
    return {
      status: "blocked",
      ready: false,
    };
  }

  return {
    status: "held",
    ready: false,
  };
}


export function getSupportedPlatforms() {
  return [
    ...PLATFORMS,
  ];
}


export function getPlatformLimitsMap() {
  return {
    ...PLATFORM_LIMITS,
  };
}


export async function createSocialDistributionPackage(
  article,
  {
    platforms,
    region = "Worldwide",
    previousContent = [],
  } = {}
) {
  if (
    !article ||
    typeof article !== "object"
  ) {
    throw new Error(
      "Article is required"
    );
  }

  if (
    !article.title ||
    !String(article.title).trim()
  ) {
    throw new Error(
      "Article title is required"
    );
  }

  const selectedPlatforms =
    normalizePlatforms(platforms);

  const packages = [];

  for (
    const platform of selectedPlatforms
  ) {
    try {
      const generated =
        await generateSocialContent(
          article,
          {
            platform,
            region,
          }
        );

      const aiPackage =
        parseJSON(generated);

      if (
        !aiPackage ||
        typeof aiPackage !== "object"
      ) {
        packages.push(
          createGenerationFailure(
            platform,
            new Error(
              "AI returned an invalid social content package."
            )
          )
        );

        continue;
      }

      const safePackage =
        createSafePackage(
          aiPackage,
          platform
        );

      const safety =
        await evaluateContentSafety(
          {
            title:
              safePackage.title ||
              article.title,

            content:
              safePackage.caption ||
              safePackage.description,

            headline:
              safePackage.title ||
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
              safePackage.thumbnailText,

            platform,

            originalContent:
              article.content ||
              "",

            previousContent,
          }
        );

      const decision =
        safety?.decision ||
        "hold";

      const publishingStatus =
        resolvePublishingStatus(
          decision
        );

      packages.push({
        platform,

        status:
          publishingStatus.status,

        content:
          safePackage,

        safety,

        publishing: {
          ready:
            publishingStatus.ready,

          published: false,

          providerConnected: false,
        },

        createdAt:
          new Date().toISOString(),
      });
    } catch (error) {
      packages.push(
        createGenerationFailure(
          platform,
          error
        )
      );
    }
  }

  const readyCount =
    packages.filter(
      (item) =>
        item.status === "ready"
    ).length;

  const approvalCount =
    packages.filter(
      (item) =>
        item.status ===
        "ceo_approval"
    ).length;

  const heldCount =
    packages.filter(
      (item) =>
        item.status === "held"
    ).length;

  const failedCount =
    packages.filter(
      (item) =>
        item.status ===
        "generation_failed"
    ).length;

  const blockedCount =
    packages.filter(
      (item) =>
        item.status === "blocked"
    ).length;

  return {
    success: true,

    type:
      "social_distribution_package",

    region:
      cleanText(
        region,
        100
      ),

    article: {
      id:
        article.id ||
        null,

      title:
        cleanText(
          article.title,
          1000
        ),

      category:
        cleanText(
          article.ai_category ||
            "general",
          100
        ),

      source:
        cleanText(
          article.source ||
            "Unknown",
          200
        ),
    },

    platforms:
      selectedPlatforms,

    packages,

    summary: {
      total:
        packages.length,

      ready:
        readyCount,

      ceoApproval:
        approvalCount,

      held:
        heldCount,

      blocked:
        blockedCount,

      generationFailed:
        failedCount,
    },

    generatedAt:
      new Date().toISOString(),
  };
}


export function createRegionalDistributionPlan(
  {
    region = "Worldwide",
    platforms,
    days = 1,
  } = {}
) {
  const selectedPlatforms =
    normalizePlatforms(platforms);

  const safeDays =
    Number.isFinite(
      Number(days)
    )
      ? Math.max(
          1,
          Math.min(
            Number(days),
            30
          )
        )
      : 1;

  const plan =
    getRegionalPublishingPlan({
      region,
      platforms:
        selectedPlatforms,
      days:
        safeDays,
    });

  return {
    success: true,

    region:
      cleanText(
        region,
        100
      ),

    platforms:
      selectedPlatforms,

    days:
      safeDays,

    schedule:
      plan,

    createdAt:
      new Date().toISOString(),
  };
}


export function scheduleSocialPackage(
  {
    platform,
    region = "Worldwide",
    content,
    publishAt,
  } = {}
) {
  const normalizedPlatform =
    normalizePlatform(platform);

  if (
    !content ||
    typeof content !== "object"
  ) {
    throw new Error(
      "Social content is required"
    );
  }

  if (!publishAt) {
    throw new Error(
      "publishAt is required"
    );
  }

  const schedule =
    createPublishingSchedule({
      platform:
        normalizedPlatform,

      region:
        cleanText(
          region,
          100
        ),

      publishAt,
    });

  return {
    success: true,

    platform:
      normalizedPlatform,

    region:
      cleanText(
        region,
        100
      ),

    content,

    schedule,

    status:
      "scheduled",

    published:
      false,

    providerConnected:
      false,

    createdAt:
      new Date().toISOString(),
  };
}


export function getDistributionStatus() {
  return {
    success: true,

    engine:
      "ZEESHAN NEWS AI Social Distribution Engine",

    status:
      "ready",

    publishingProviders:
      "not_connected",

    actualPublishing:
      false,

    supportedPlatforms:
      getSupportedPlatforms(),

    platformLimits:
      getPlatformLimitsMap(),

    safetyChecks:
      true,

    duplicateChecks:
      true,

    copyrightChecks:
      true,

    ceoApproval:
      true,

    autoPilotCompatible:
      true,

    humanApprovalForMediumRisk:
      true,

    highRiskHold:
      true,

    emergencyStopCompatible:
      true,

    generatedAt:
      new Date().toISOString(),
  };
}


export default {
  getSupportedPlatforms,
  getPlatformLimitsMap,
  createSocialDistributionPackage,
  createRegionalDistributionPlan,
  scheduleSocialPackage,
  getDistributionStatus,
};