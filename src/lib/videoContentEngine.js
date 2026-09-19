import {
  generateAIText,
  isAIConfigured,
} from "./aiProvider.js";

import {
  generateVideoContent,
} from "./aiContentGenerator.js";

import {
  evaluateContentSafety,
} from "./contentSafetyEngine.js";


const VIDEO_FORMATS = {
  youtube_shorts: {
    platform: "youtube_shorts",
    aspectRatio: "9:16",
    targetDuration: 60,
    maxDuration: 180,
    resolution: "1080x1920",
  },

  tiktok: {
    platform: "tiktok",
    aspectRatio: "9:16",
    targetDuration: 45,
    maxDuration: 180,
    resolution: "1080x1920",
  },

  instagram_reel: {
    platform: "instagram",
    aspectRatio: "9:16",
    targetDuration: 45,
    maxDuration: 180,
    resolution: "1080x1920",
  },

  facebook_video: {
    platform: "facebook",
    aspectRatio: "9:16",
    targetDuration: 60,
    maxDuration: 240,
    resolution: "1080x1920",
  },

  youtube: {
    platform: "youtube",
    aspectRatio: "16:9",
    targetDuration: 120,
    maxDuration: 600,
    resolution: "1920x1080",
  },
};


const VOICE_STYLES = new Set([
  "professional",
  "breaking",
  "calm",
  "energetic",
  "documentary",
]);


function normalizeText(
  value,
  maxLength = 5000
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}


function normalizeFormat(
  value
) {
  const format =
    String(
      value || "youtube_shorts"
    )
      .trim()
      .toLowerCase();

  if (
    !VIDEO_FORMATS[format]
  ) {
    return "youtube_shorts";
  }

  return format;
}


function normalizeVoiceStyle(
  value
) {
  const style =
    String(
      value || "professional"
    )
      .trim()
      .toLowerCase();

  if (
    !VOICE_STYLES.has(style)
  ) {
    return "professional";
  }

  return style;
}


function cleanGeneratedText(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /^```(?:json|text)?/i,
      ""
    )
    .replace(
      /```$/g,
      ""
    )
    .trim();
}


function parseJSON(
  value
) {
  const cleaned =
    cleanGeneratedText(
      value
    );

  try {
    return JSON.parse(
      cleaned
    );
  } catch {
    const first =
      cleaned.indexOf("{");

    const last =
      cleaned.lastIndexOf("}");

    if (
      first >= 0 &&
      last > first
    ) {
      try {
        return JSON.parse(
          cleaned.slice(
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


function buildVideoPrompt({
  title,
  summary,
  category,
  source,
  platform,
  region,
  duration,
  voiceStyle,
}) {
  return `
You are the Video Production AI
for ZEESHAN NEWS AI.

Create a production-ready short
news video plan from the supplied
news information.

IMPORTANT RULES:

1. Never invent facts.
2. Never invent quotes.
3. Never invent statistics.
4. Never create unsupported claims.
5. Do not copy the source article.
6. Keep narration original.
7. Do not use misleading clickbait.
8. Do not exaggerate breaking news.
9. Political content must remain neutral.
10. Do not present speculation as fact.
11. Do not claim a video has been generated.
12. Do not claim that an external asset exists.
13. Visual suggestions must be relevant to the supplied news.
14. Use placeholders for assets that still require a real provider.
15. The final package must be suitable for human/CEO review.
16. Do not include fake quotes or fake statistics.

PLATFORM:
${platform}

TARGET REGION:
${region}

TARGET DURATION:
${duration} seconds

VOICE STYLE:
${voiceStyle}

NEWS TITLE:
${title}

NEWS SUMMARY:
${summary}

CATEGORY:
${category}

SOURCE:
${source}

RETURN ONLY VALID JSON:

{
  "videoTitle": "...",
  "hook": "...",
  "narration": "...",
  "closing": "...",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "narration": "...",
      "visualPrompt": "...",
      "onScreenText": "...",
      "transition": "..."
    }
  ],
  "thumbnail": {
    "text": "...",
    "visualPrompt": "..."
  },
  "voice": {
    "style": "...",
    "language": "English"
  },
  "captions": "...",
  "description": "...",
  "hashtags": [],
  "disclaimer": ""
}

Make the total scene duration
approximately match the target duration.

Use concise scenes suitable for
short-form news video.

Do not add explanations outside JSON.
`;
}


function normalizeScenes(
  scenes,
  targetDuration
) {
  if (
    !Array.isArray(
      scenes
    )
  ) {
    return [];
  }

  const result = [];

  let totalDuration = 0;

  for (
    const scene of scenes
  ) {
    if (
      !scene ||
      typeof scene !==
        "object"
    ) {
      continue;
    }

    const duration =
      Number(
        scene.duration
      );

    const safeDuration =
      Number.isFinite(
        duration
      )
        ? Math.min(
            30,
            Math.max(
              1,
              Math.floor(
                duration
              )
            )
          )
        : 5;

    if (
      totalDuration >=
      targetDuration
    ) {
      break;
    }

    const remaining =
      targetDuration -
      totalDuration;

    const finalDuration =
      Math.min(
        safeDuration,
        remaining
      );

    result.push({
      sceneNumber:
        result.length + 1,

      duration:
        finalDuration,

      narration:
        normalizeText(
          scene.narration,
          1000
        ),

      visualPrompt:
        normalizeText(
          scene.visualPrompt,
          1000
        ),

      onScreenText:
        normalizeText(
          scene.onScreenText,
          300
        ),

      transition:
        normalizeText(
          scene.transition,
          100
        ) ||
        "cut",
    });

    totalDuration +=
      finalDuration;
  }

  return result;
}


function calculateSceneDuration(
  scenes
) {
  return scenes.reduce(
    (
      total,
      scene
    ) =>
      total +
      Number(
        scene.duration || 0
      ),
    0
  );
}


function createAssetRequirements(
  scenes
) {
  return scenes.map(
    (scene) => ({
      sceneNumber:
        scene.sceneNumber,

      visualAssetRequired:
        true,

      visualPrompt:
        scene.visualPrompt,

      voiceRequired:
        Boolean(
          scene.narration
        ),

      captionRequired:
        Boolean(
          scene.narration
        ),

      status:
        "pending_provider",
    })
  );
}


export function getVideoFormats() {
  return Object.fromEntries(
    Object.entries(
      VIDEO_FORMATS
    ).map(
      ([
        name,
        config,
      ]) => [
        name,
        {
          ...config,
        },
      ]
    )
  );
}


export function getVoiceStyles() {
  return Array.from(
    VOICE_STYLES
  );
}


export function getVideoFormat(
  format
) {
  const normalized =
    normalizeFormat(
      format
    );

  return {
    name:
      normalized,

    ...VIDEO_FORMATS[
      normalized
    ],
  };
}


export async function generateVideoProductionPlan(
  article,
  {
    format =
      "youtube_shorts",

    region =
      "Worldwide",

    voiceStyle =
      "professional",
  } = {}
) {
  if (
    !article ||
    typeof article !==
      "object"
  ) {
    throw new Error(
      "Article data is required"
    );
  }

  const title =
    normalizeText(
      article.title,
      1000
    );

  if (!title) {
    throw new Error(
      "Article title is required"
    );
  }

  const summary =
    normalizeText(
      article.ai_summary ||
        article.description ||
        article.content ||
        "",
      4000
    );

  const category =
    normalizeText(
      article.ai_category ||
        "general",
      100
    );

  const source =
    normalizeText(
      article.source ||
        "Unknown",
      300
    );

  const normalizedFormat =
    normalizeFormat(
      format
    );

  const normalizedVoiceStyle =
    normalizeVoiceStyle(
      voiceStyle
    );

  const videoConfig =
    VIDEO_FORMATS[
      normalizedFormat
    ];

  const normalizedRegion =
    normalizeText(
      region,
      200
    ) ||
    "Worldwide";

  if (
    !isAIConfigured()
  ) {
    throw new Error(
      "AI provider is not configured"
    );
  }


  const aiVideoContent =
    await generateVideoContent(
      article,
      {
        platform:
          normalizedFormat ===
          "youtube"
            ? "youtube"
            : normalizedFormat ===
                "tiktok"
              ? "tiktok"
              : normalizedFormat ===
                  "instagram_reel"
                ? "instagram"
                : normalizedFormat ===
                    "facebook_video"
                  ? "facebook"
                  : "youtube_shorts",

        region:
          normalizedRegion,
      }
    );


  const prompt =
    buildVideoPrompt({
      title,

      summary,

      category,

      source,

      platform:
        normalizedFormat,

      region:
        normalizedRegion,

      duration:
        videoConfig.targetDuration,

      voiceStyle:
        normalizedVoiceStyle,
    });


  const generated =
    await generateAIText(
      prompt
    );


  const parsed =
    parseJSON(
      generated
    );


  if (!parsed) {
    throw new Error(
      "AI video planner returned invalid JSON"
    );
  }


  const scenes =
    normalizeScenes(
      parsed.scenes,
      videoConfig.targetDuration
    );


  if (
    scenes.length === 0
  ) {
    throw new Error(
      "AI video planner returned no usable scenes"
    );
  }


  const totalDuration =
    calculateSceneDuration(
      scenes
    );


  const safety =
    evaluateContentSafety({
      title,

      content:
        aiVideoContent.content ||
        parsed.narration ||
        "",

      headline:
        parsed.videoTitle ||
        title,

      summary,

      category,

      source,

      thumbnailText:
        parsed?.thumbnail?.text ||
        "",

      platform:
        normalizedFormat ===
        "youtube_shorts"
          ? "youtube_shorts"
          : normalizedFormat ===
              "tiktok"
            ? "tiktok"
            : normalizedFormat ===
                "instagram_reel"
              ? "instagram"
              : normalizedFormat ===
                  "facebook_video"
                ? "facebook"
                : "youtube",

      originalContent:
        article.content ||
        "",

      previousContent: [],
    });


  const assetRequirements =
    createAssetRequirements(
      scenes
    );


  return {
    success: true,

    type:
      "video_production_plan",

    status:
      "awaiting_media_provider",

    videoGenerated:
      false,

    previewAvailable:
      false,

    readyForPublishing:
      false,

    platform:
      normalizedFormat,

    region:
      normalizedRegion,

    format: {
      aspectRatio:
        videoConfig.aspectRatio,

      resolution:
        videoConfig.resolution,

      targetDuration:
        videoConfig.targetDuration,

      maxDuration:
        videoConfig.maxDuration,

      generatedDuration:
        totalDuration,
    },

    article: {
      id:
        article.id ||
        null,

      title,

      category,

      source,
    },

    video: {
      title:
        normalizeText(
          parsed.videoTitle ||
            title,
          1000
        ),

      hook:
        normalizeText(
          parsed.hook,
          1000
        ),

      narration:
        normalizeText(
          parsed.narration,
          8000
        ),

      closing:
        normalizeText(
          parsed.closing,
          1000
        ),

      scenes,

      thumbnail: {
        text:
          normalizeText(
            parsed?.thumbnail
              ?.text,
            200
          ),

        visualPrompt:
          normalizeText(
            parsed?.thumbnail
              ?.visualPrompt,
            1000
          ),
      },

      voice: {
        style:
          normalizedVoiceStyle,

        language:
          normalizeText(
            parsed?.voice
              ?.language ||
              "English",
            100
          ),

        status:
          "pending_voice_provider",
      },

      captions:
        normalizeText(
          parsed.captions,
          12000
        ),

      description:
        normalizeText(
          parsed.description,
          3000
        ),

      hashtags:
        Array.isArray(
          parsed.hashtags
        )
          ? parsed.hashtags
              .map(
                (item) =>
                  normalizeText(
                    item,
                    100
                  )
              )
              .filter(Boolean)
              .slice(0, 10)
          : [],

      disclaimer:
        normalizeText(
          parsed.disclaimer,
          500
        ),
    },

    assets:
      assetRequirements,

    safety,

    production: {
      scriptReady:
        true,

      scenesReady:
        scenes.length > 0,

      voiceReady:
        false,

      visualsReady:
        false,

      videoRenderReady:
        false,

      previewReady:
        false,

      publishingReady:
        false,
    },

    generatedAt:
      new Date().toISOString(),
  };
}


export function createVideoProviderPayload(
  productionPlan
) {
  if (
    !productionPlan ||
    productionPlan.type !==
      "video_production_plan"
  ) {
    throw new Error(
      "Valid video production plan is required"
    );
  }


  return {
    platform:
      productionPlan.platform,

    aspectRatio:
      productionPlan.format
        ?.aspectRatio,

    resolution:
      productionPlan.format
        ?.resolution,

    duration:
      productionPlan.format
        ?.generatedDuration,

    title:
      productionPlan.video
        ?.title,

    scenes:
      productionPlan.video
        ?.scenes || [],

    voice: {
      style:
        productionPlan.video
          ?.voice?.style,

      language:
        productionPlan.video
          ?.voice?.language,
    },

    thumbnail:
      productionPlan.video
        ?.thumbnail,

    captions:
      productionPlan.video
        ?.captions,

    description:
      productionPlan.video
        ?.description,

    status:
      "ready_for_video_provider",
  };
}


export function markVideoProviderPending(
  productionPlan
) {
  if (
    !productionPlan ||
    typeof productionPlan !==
      "object"
  ) {
    throw new Error(
      "Production plan is required"
    );
  }


  return {
    ...productionPlan,

    status:
      "awaiting_media_provider",

    production: {
      ...productionPlan.production,

      voiceReady:
        false,

      visualsReady:
        false,

      videoRenderReady:
        false,

      previewReady:
        false,

      publishingReady:
        false,
    },

    updatedAt:
      new Date().toISOString(),
  };
}


export function getVideoEngineStatus() {
  return {
    success: true,

    engine:
      "ZEESHAN NEWS AI Video Content Engine",

    status:
      "ready",

    videoGenerationProvider:
      "not_connected",

    voiceProvider:
      "not_connected",

    renderingProvider:
      "not_connected",

    preview:
      "pending_provider",

    supportedFormats:
      Object.keys(
        VIDEO_FORMATS
      ),

    generatedAt:
      new Date().toISOString(),
  };
}
