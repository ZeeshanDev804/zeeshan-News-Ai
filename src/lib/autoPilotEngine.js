import {
  evaluateContentSafety,
  canAutoPublish,
  requiresCEOApproval,
  isContentBlocked,
} from "./contentSafetyEngine.js";

import {
  createPublishingSchedule,
  calculateNextPublishTime,
} from "./publishingScheduler.js";


const AUTO_PILOT_MODES = {
  OFF: "off",
  ASSISTED: "assisted",
  AUTO: "auto",
};


const PUBLISHING_STATUSES = {
  READY: "ready",
  SCHEDULED: "scheduled",
  CEO_APPROVAL: "ceo_approval",
  HELD: "held",
  BLOCKED: "blocked",
  PENDING: "pending",
};


function normalizeText(
  value,
  maxLength = 10000
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


function normalizeMode(
  value
) {
  const mode =
    String(
      value ||
        AUTO_PILOT_MODES.ASSISTED
    )
      .trim()
      .toLowerCase();

  if (
    !Object.values(
      AUTO_PILOT_MODES
    ).includes(mode)
  ) {
    return AUTO_PILOT_MODES.ASSISTED;
  }

  return mode;
}


function normalizeBoolean(
  value,
  fallback = false
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  return fallback;
}


function normalizeRegion(
  value
) {
  return (
    normalizeText(
      value,
      200
    ) ||
    "Worldwide"
  );
}


function normalizePlatform(
  value
) {
  return (
    normalizeText(
      value,
      100
    )
      .toLowerCase() ||
    "website"
  );
}


function isEmergencyStopEnabled(
  settings = {}
) {
  return Boolean(
    settings.emergencyStop ===
      true
  );
}


function isAutoPublishAllowedBySettings(
  settings = {}
) {
  if (
    settings.autoPublish ===
    false
  ) {
    return false;
  }

  return true;
}


function isPlatformEnabled(
  platform,
  settings = {}
) {
  const disabledPlatforms =
    Array.isArray(
      settings.disabledPlatforms
    )
      ? settings.disabledPlatforms
      : [];

  return !disabledPlatforms
    .map(
      (item) =>
        String(
          item
        ).toLowerCase()
    )
    .includes(
      platform.toLowerCase()
    );
}


function getDecisionReason(
  {
    mode,
    safety,
    emergencyStop,
    platformEnabled,
    autoPublishEnabled,
  }
) {
  if (
    emergencyStop
  ) {
    return "Emergency stop is enabled.";
  }

  if (
    !platformEnabled
  ) {
    return "Publishing platform is disabled.";
  }

  if (
    mode ===
    AUTO_PILOT_MODES.OFF
  ) {
    return "Auto-Pilot is disabled.";
  }

  if (
    !autoPublishEnabled
  ) {
    return "Automatic publishing is disabled by CEO settings.";
  }

  if (
    isContentBlocked(
      safety
    )
  ) {
    return (
      safety.reason ||
      "Content is blocked by the safety engine."
    );
  }

  if (
    requiresCEOApproval(
      safety
    )
  ) {
    return (
      safety.reason ||
      "CEO approval is required."
    );
  }

  if (
    canAutoPublish(
      safety
    )
  ) {
    return "Content passed safety checks and is eligible for Auto-Pilot.";
  }

  return "Content requires manual review.";
}


function determinePublishingStatus(
  {
    mode,
    safety,
    emergencyStop,
    platformEnabled,
    autoPublishEnabled,
  }
) {
  if (
    emergencyStop
  ) {
    return {
      status:
        PUBLISHING_STATUSES.HELD,

      decision:
        "hold",
    };
  }

  if (
    !platformEnabled
  ) {
    return {
      status:
        PUBLISHING_STATUSES.HELD,

      decision:
        "platform_disabled",
    };
  }

  if (
    mode ===
    AUTO_PILOT_MODES.OFF
  ) {
    return {
      status:
        PUBLISHING_STATUSES.PENDING,

      decision:
        "manual_mode",
    };
  }

  if (
    !autoPublishEnabled
  ) {
    return {
      status:
        PUBLISHING_STATUSES.CEO_APPROVAL,

      decision:
        "ceo_approval",
    };
  }

  if (
    isContentBlocked(
      safety
    )
  ) {
    return {
      status:
        PUBLISHING_STATUSES.BLOCKED,

      decision:
        "blocked",
    };
  }

  if (
    requiresCEOApproval(
      safety
    )
  ) {
    return {
      status:
        PUBLISHING_STATUSES.CEO_APPROVAL,

      decision:
        "ceo_approval",
    };
  }

  if (
    canAutoPublish(
      safety
    )
  ) {
    return {
      status:
        PUBLISHING_STATUSES.SCHEDULED,

      decision:
        "auto_publish",
    };
  }

  return {
    status:
      PUBLISHING_STATUSES.CEO_APPROVAL,

    decision:
      "ceo_approval",
  };
}


export function evaluateAutoPilot(
  {
    title = "",
    content = "",
    headline = "",
    summary = "",
    category = "general",
    source = "Unknown",
    thumbnailText = "",
    platform = "website",
    region = "Worldwide",
    originalContent = "",
    previousContent = [],
    mode = AUTO_PILOT_MODES.ASSISTED,
    settings = {},
  } = {}
) {
  const normalizedMode =
    normalizeMode(
      mode
    );

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  const normalizedRegion =
    normalizeRegion(
      region
    );

  const emergencyStop =
    isEmergencyStopEnabled(
      settings
    );

  const autoPublishEnabled =
    isAutoPublishAllowedBySettings(
      settings
    );

  const platformEnabled =
    isPlatformEnabled(
      normalizedPlatform,
      settings
    );


  const safety =
    evaluateContentSafety({
      title:
        normalizeText(
          title,
          1000
        ),

      content:
        normalizeText(
          content,
          10000
        ),

      headline:
        normalizeText(
          headline,
          1000
        ),

      summary:
        normalizeText(
          summary,
          5000
        ),

      category,

      source,

      thumbnailText:
        normalizeText(
          thumbnailText,
          300
        ),

      platform:
        normalizedPlatform,

      originalContent,

      previousContent,
    });


  const decision =
    determinePublishingStatus({
      mode:
        normalizedMode,

      safety,

      emergencyStop,

      platformEnabled,

      autoPublishEnabled,
    });


  const reason =
    getDecisionReason({
      mode:
        normalizedMode,

      safety,

      emergencyStop,

      platformEnabled,

      autoPublishEnabled,
    });


  return {
    success: true,

    mode:
      normalizedMode,

    platform:
      normalizedPlatform,

    region:
      normalizedRegion,

    emergencyStop,

    platformEnabled,

    autoPublishEnabled,

    safety,

    status:
      decision.status,

    decision:
      decision.decision,

    reason,

    autoPublish:
      decision.decision ===
      "auto_publish",

    requiresCEOApproval:
      decision.decision ===
      "ceo_approval",

    held:
      decision.status ===
      PUBLISHING_STATUSES.HELD,

    blocked:
      decision.status ===
      PUBLISHING_STATUSES.BLOCKED,

    evaluatedAt:
      new Date().toISOString(),
  };
}


export function createAutoPilotSchedule(
  {
    contentId = null,
    title = "",
    platform = "website",
    region = "Worldwide",
    timezone = null,
    mode = AUTO_PILOT_MODES.ASSISTED,
    settings = {},
    scheduledFor = null,
    publishWindow = null,
    safetyInput = {},
  } = {}
) {
  const evaluation =
    evaluateAutoPilot({
      title:
        title ||
        safetyInput.title,

      content:
        safetyInput.content,

      headline:
        safetyInput.headline,

      summary:
        safetyInput.summary,

      category:
        safetyInput.category,

      source:
        safetyInput.source,

      thumbnailText:
        safetyInput.thumbnailText,

      platform,

      region,

      originalContent:
        safetyInput.originalContent,

      previousContent:
        safetyInput.previousContent,

      mode,

      settings,
    });


  if (
    evaluation.blocked
  ) {
    return {
      success: true,

      created: false,

      status:
        PUBLISHING_STATUSES.BLOCKED,

      evaluation,
    };
  }


  if (
    evaluation.held
  ) {
    return {
      success: true,

      created: false,

      status:
        PUBLISHING_STATUSES.HELD,

      evaluation,
    };
  }


  if (
    evaluation.requiresCEOApproval
  ) {
    return {
      success: true,

      created: false,

      status:
        PUBLISHING_STATUSES.CEO_APPROVAL,

      evaluation,
    };
  }


  if (
    evaluation.decision !==
    "auto_publish"
  ) {
    return {
      success: true,

      created: false,

      status:
        PUBLISHING_STATUSES.PENDING,

      evaluation,
    };
  }


  const schedule =
    createPublishingSchedule({
      contentId,

      title,

      platform,

      region,

      timezone,

      scheduledFor,

      publishWindow,

      autoPublish:
        true,
    });


  return {
    success: true,

    created: true,

    status:
      PUBLISHING_STATUSES.SCHEDULED,

    evaluation,

    schedule,
  };
}


export function getNextAutoPublishTime(
  {
    platform = "website",
    region = "Worldwide",
    timezone = null,
    fromDate = new Date(),
    publishWindow = null,
  } = {}
) {
  return calculateNextPublishTime({
    fromDate,

    platform,

    region,

    timezone,

    publishWindow,
  });
}


export function shouldAutoPublish(
  {
    safetyResult,
    mode = AUTO_PILOT_MODES.AUTO,
    settings = {},
  } = {}
) {
  const normalizedMode =
    normalizeMode(
      mode
    );

  if (
    normalizedMode !==
    AUTO_PILOT_MODES.AUTO
  ) {
    return false;
  }

  if (
    isEmergencyStopEnabled(
      settings
    )
  ) {
    return false;
  }

  if (
    !isAutoPublishAllowedBySettings(
      settings
    )
  ) {
    return false;
  }

  return canAutoPublish(
    safetyResult
  );
}


export function getAutoPilotStatus(
  {
    mode = AUTO_PILOT_MODES.ASSISTED,
    settings = {},
  } = {}
) {
  const normalizedMode =
    normalizeMode(
      mode
    );

  const emergencyStop =
    isEmergencyStopEnabled(
      settings
    );

  const autoPublishEnabled =
    isAutoPublishAllowedBySettings(
      settings
    );


  let status =
    "assisted";

  if (
    emergencyStop
  ) {
    status =
      "emergency_stop";
  } else if (
    normalizedMode ===
    AUTO_PILOT_MODES.OFF
  ) {
    status =
      "off";
  } else if (
    normalizedMode ===
      AUTO_PILOT_MODES.AUTO &&
    autoPublishEnabled
  ) {
    status =
      "auto";
  }


  return {
    success: true,

    mode:
      normalizedMode,

    status,

    autoPublishEnabled,

    emergencyStop,

    description:
      emergencyStop
        ? "Auto-Pilot is stopped by the CEO emergency switch."
        : status === "auto"
        ? "Low-risk content may be automatically scheduled for publishing."
        : status === "off"
        ? "Auto-Pilot is disabled."
        : "Auto-Pilot prepares content but requires CEO control for publishing.",

    updatedAt:
      new Date().toISOString(),
  };
}


export function createCEOApprovalItem(
  {
    contentId = null,
    title = "",
    platform = "website",
    region = "Worldwide",
    safety = null,
    reason = "CEO approval required.",
  } = {}
) {
  return {
    success: true,

    id:
      `approval-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    contentId,

    title:
      normalizeText(
        title,
        1000
      ),

    platform:
      normalizePlatform(
        platform
      ),

    region:
      normalizeRegion(
        region
      ),

    status:
      PUBLISHING_STATUSES.CEO_APPROVAL,

    reason,

    safety,

    createdAt:
      new Date().toISOString(),
  };
}


export function createEmergencyStopState(
  enabled = true
) {
  return {
    emergencyStop:
      Boolean(enabled),

    changedAt:
      new Date().toISOString(),

    effect:
      enabled
        ? "All Auto-Pilot publishing decisions are held until the CEO disables the emergency stop."
        : "Auto-Pilot may operate according to configured safety and publishing rules.",
  };
}


export function getAutoPilotModes() {
  return {
    ...AUTO_PILOT_MODES,
  };
}


export function getPublishingStatuses() {
  return {
    ...PUBLISHING_STATUSES,
  };
}
