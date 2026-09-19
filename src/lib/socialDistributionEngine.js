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


function cleanText(
  value,
  maxLength = 5000
) {
  return String(
    value || ""
  )
    .trim()
    .slice(0, maxLength);
}


function normalizePlatform(
  platform
) {
  const value =
    String(
      platform || ""
    )
      .trim()
      .toLowerCase();

  if (
    PLATFORMS.includes(
      value
    )
  ) {
    return value;
  }

  return "youtube_shorts";
}


function normalizePlatforms(
  platforms
) {
  if (
    !Array.isArray(
      platforms
    )
  ) {
    return [
      "youtube_shorts",
      "tiktok",
      "instagram",
    ];
  }

  return [
    ...new Set(
      platforms
        .map(
          normalizePlatform
        )
        .filter(Boolean)
    ),
  ];
}


function normalizeHashtags(
  hashtags,
  limit
) {
  if (
    !Array.isArray(
      hashtags
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      hashtags
        .map(
          (item) =>
            cleanText(
              item,
              80
            )
        )
        .filter(Boolean)
        .map(
          (item) =>
            item.startsWith(
              "#"
            )
              ? item
              : `#${item.replace(
                  /\s+/g,
                  ""
                )}`
        )
    ),
  ].slice(
    0,
    limit
  );
}


function buildPlatformPrompt(
  article,
  platform,
  region
) {
  const title =
    cleanText(
      article.title,
      1000
    );

  const summary =
    cleanText(
      article.ai_summary ||
        article.description ||
        article.content,
      4000
    );

  const category =
    cleanText(
      article.ai_category ||
        "general",
      100
    );

  const source =
    cleanText(
      article.source ||
        "Unknown",
      200
    );


  return `
Create a platform-specific
social distribution package
for ZEESHAN NEWS AI.

PLATFORM:
${platform}

TARGET REGION:
${region}

NEWS TITLE:
${title}

NEWS SUMMARY:
${summary}

CATEGORY:
${category}

SOURCE:
${source}

RULES:

- Never invent facts.
- Never invent quotes.
- Never invent statistics.
- Never copy the source article.
- Keep the wording original.
- Do not use misleading clickbait.
- Do not manufacture urgency.
- Do not claim something is confirmed unless the supplied information supports it.
- Political/news content must remain neutral.
- Do not manipulate users into fake engagement.
- Do not promise views, likes or shares.
- Do not claim that this post was published.
- Only prepare the content package.

Return ONLY valid JSON:

{
  "title": "...",
  "caption": "...",
  "description": "...",
  "hook": "...",
  "closing": "...",
  "hashtags": [],
  "callToAction": "...",
  "thumbnailText": "...",
  "pinnedComment": ""
}
`;
}


function parseJSON(
  value
) {
  const text =
    String(
      value || ""
    )
      .replace(
        /^```json/i,
        ""
      )
      .replace(
        /^```/i,
        ""
      )
      .replace(
        /```$/i,
        ""
      )
      .trim();

  try {
    return JSON.parse(
      text
    );
  } catch {
    const first =
      text.indexOf(
        "{"
      );

    const last =
      text.lastIndexOf(
        "}"
      );

    if (
      first >= 0 &&
      last > first
    ) {
      try {
        return JSON.parse(
          text.slice(
            first,
            last + 1
          )
        );
      } catch {
        return null;
      }
    }

    return null;
  }
}


function getPlatformLimits(
  platform
) {
  return (
    PLATFORM_LIMITS[
      platform
    ] ||
    PLATFORM_LIMITS.youtube_shorts
  );
}


function createSafePackage(
  generated,
  platform
) {
  const limits =
    getPlatformLimits(
      platform
    );


  const title =
    cleanText(
      generated?.title,
      limits.title
    );


  const caption =
    cleanText(
      generated?.caption,
      limits.description
    );


  const description =
    cleanText(
      generated?.description ||
        caption,
      limits.description
    );


  const hook =
    cleanText(
      generated?.hook,
      500
    );


  const closing =
    cleanText(
      generated?.closing,
      500
    );


  const callToAction =
    cleanText(
      generated?.callToAction,
      300
    );


  const thumbnailText =
    cleanText(
      generated?.thumbnailText,
      150
    );


  const pinnedComment =
    cleanText(
      generated?.pinnedComment,
      500
    );


  const hashtags =
    normalizeHashtags(
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
    typeof article !==
      "object"
  ) {
    throw new Error(
      "Article is required"
    );
  }


  if (
    !article.title
  ) {
    throw new Error(
      "Article title is required"
    );
  }


  const selectedPlatforms =
    normalizePlatforms(
      platforms
    );


  const packages = [];


  for (
    const platform of
      selectedPlatforms
  ) {
    try {
      const prompt =
        buildPlatformPrompt(
          article,
          platform,
          region
        );


      const generated =
        await generateSocialContent(
          article,
          {
            platform,
            region,
          }
        );


      let aiPackage =
        generated;


      if (
        !aiPackage ||
        typeof aiPackage !==
          "object"
      ) {
        aiPackage =
          parseJSON(
            generated
          );
      }


      if (
        !aiPackage ||
        typeof aiPackage !==
          "object"
      ) {
        packages.push({
          platform,

          status:
            "generation_failed",

          error:
            "AI returned an invalid social content package.",
        });

        continue;
      }


      const safePackage =
        createSafePackage(
          aiPackage,
          platform
        );


      const safety =
        evaluateContentSafety({
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
        });


      packages.push({
        platform,

        status:
          safety.decision ===
          "auto_publish"
            ? "ready"
            : safety.decision ===
                "ceo_approval"
              ? "ceo_approval"
              : "held",

        content:
          safePackage,

        safety,

        publishing: {
          ready:
            safety.decision !==
            "hold",

          published:
            false,

          providerConnected:
            false,
        },

        createdAt:
          new Date().toISOString(),
      });

    } catch (error) {
      packages.push({
        platform,

        status:
          "generation_failed",

        error:
          error.message,
      });
    }
  }


  return {
    success: true,

    type:
      "social_distribution_package",

    region,

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

    packages,

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
    normalizePlatforms(
      platforms
    );


  const plan =
    getRegionalPublishingPlan({
      region,
      platforms:
        selectedPlatforms,
      days,
    });


  return {
    success: true,

    region,

    platforms:
      selectedPlatforms,

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
    normalizePlatform(
      platform
    );


  if (
    !content ||
    typeof content !==
      "object"
  ) {
    throw new Error(
      "Social content is required"
    );
  }


  const schedule =
    createPublishingSchedule({
      platform:
        normalizedPlatform,

      region,

      publishAt,
    });


  return {
    success: true,

    platform:
      normalizedPlatform,

    region,

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

    generatedAt:
      new Date().toISOString(),
  };
}
