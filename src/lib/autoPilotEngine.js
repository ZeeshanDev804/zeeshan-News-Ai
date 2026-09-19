import {
  evaluateContentSafety,
} from "./contentSafetyEngine.js";

import {
  createPublishingSchedule,
} from "./publishingScheduler.js";

import {
  getAutoPilotControl,
} from "./autoPilotStore.js";

export const AUTO_PILOT_MODES = {
  OFF: "off",
  ASSISTED: "assisted",
  AUTO: "auto",
};

export const AUTO_PILOT_STATUSES = {
  READY: "ready",
  SCHEDULED: "scheduled",
  CEO_APPROVAL: "ceo_approval",
  HELD: "held",
  BLOCKED: "blocked",
};

function normalizeMode(mode) {
  const value = String(
    mode || AUTO_PILOT_MODES.ASSISTED
  )
    .trim()
    .toLowerCase();

  if (
    !Object.values(AUTO_PILOT_MODES).includes(
      value
    )
  ) {
    return AUTO_PILOT_MODES.ASSISTED;
  }

  return value;
}

function normalizePlatform(platform) {
  return String(platform || "")
    .trim()
    .toLowerCase();
}

function normalizeRegion(region) {
  return String(region || "worldwide")
    .trim()
    .toLowerCase();
}

export async function evaluateAutoPilot({
  db = null,
  title = "",
  content = "",
  summary = "",
  category = "",
  source = "",
  sourceUrl = "",
  platform = "website",
  region = "worldwide",
  mode = null,
  timezone = null,
  hasAttribution = true,
  exactSourceReproduction = false,
  duplicateMatch = false,
} = {}) {
  let control = {
    mode: normalizeMode(mode),
    emergency_stop: false,
    stop_reason: null,
    stopped_by: null,
    stopped_at: null,
  };

  if (db) {
    try {
      control =
        await getAutoPilotControl(db);
    } catch (error) {
      console.error(
        "⚠️ Auto-Pilot control read failed:",
        error.message
      );
    }
  }

  const activeMode = normalizeMode(
    mode || control.mode
  );

  const emergencyStop = Boolean(
    control.emergency_stop
  );

  const safety = evaluateContentSafety({
    title,
    content,
    summary,
    category,
    source,
    sourceUrl,
    platform,
    hasAttribution,
    exactSourceReproduction,
    duplicateMatch,
  });

  if (emergencyStop) {
    return {
      mode: activeMode,
      status: AUTO_PILOT_STATUSES.HELD,
      decision: "hold",
      emergencyStop: true,
      riskLevel:
        safety.riskLevel || "high",
      safety,
      reason:
        control.stop_reason ||
        "Emergency stop is active",
      nextStep:
        "CEO must release the emergency stop before publishing can continue.",
      schedule: null,
    };
  }

  if (
    safety.decision === "hold" ||
    safety.riskLevel === "high"
  ) {
    return {
      mode: activeMode,
      status: AUTO_PILOT_STATUSES.HELD,
      decision: "hold",
      emergencyStop: false,
      riskLevel:
        safety.riskLevel || "high",
      safety,
      reason:
        safety.reasons?.join("; ") ||
        "Content requires safety review",
      nextStep:
        "Hold content for review before publishing.",
      schedule: null,
    };
  }

  if (
    safety.decision === "ceo_approval" ||
    safety.riskLevel === "medium"
  ) {
    return {
      mode: activeMode,
      status:
        AUTO_PILOT_STATUSES.CEO_APPROVAL,
      decision: "ceo_approval",
      emergencyStop: false,
      riskLevel:
        safety.riskLevel || "medium",
      safety,
      reason:
        safety.reasons?.join("; ") ||
        "CEO approval required",
      nextStep:
        "Send content to CEO Approval Queue.",
      schedule: null,
    };
  }

  if (
    activeMode === AUTO_PILOT_MODES.OFF
  ) {
    return {
      mode: activeMode,
      status: AUTO_PILOT_STATUSES.READY,
      decision: "manual",
      emergencyStop: false,
      riskLevel:
        safety.riskLevel || "low",
      safety,
      reason:
        "Auto-Pilot is disabled",
      nextStep:
        "Manual CEO action is required.",
      schedule: null,
    };
  }

  if (
    activeMode === AUTO_PILOT_MODES.ASSISTED
  ) {
    return {
      mode: activeMode,
      status:
        AUTO_PILOT_STATUSES.CEO_APPROVAL,
      decision: "ceo_approval",
      emergencyStop: false,
      riskLevel:
        safety.riskLevel || "low",
      safety,
      reason:
        "Assisted mode requires CEO confirmation.",
      nextStep:
        "CEO reviews and approves the publishing action.",
      schedule: null,
    };
  }

  if (
    activeMode === AUTO_PILOT_MODES.AUTO
  ) {
    let schedule = null;

    try {
      schedule = createPublishingSchedule({
        platform:
          normalizePlatform(platform),
        region:
          normalizeRegion(region),
        timezone,
      });
    } catch (error) {
      return {
        mode: activeMode,
        status:
          AUTO_PILOT_STATUSES.HELD,
        decision: "hold",
        emergencyStop: false,
        riskLevel:
          safety.riskLevel || "medium",
        safety,
        reason:
          `Publishing schedule error: ${error.message}`,
        nextStep:
          "Review scheduling configuration.",
        schedule: null,
      };
    }

    return {
      mode: activeMode,
      status:
        AUTO_PILOT_STATUSES.SCHEDULED,
      decision: "auto_publish",
      emergencyStop: false,
      riskLevel:
        safety.riskLevel || "low",
      safety,
      reason:
        "Low-risk content approved for Auto-Pilot scheduling.",
      nextStep:
        "Publish automatically at the scheduled time.",
      schedule,
    };
  }

  return {
    mode: activeMode,
    status: AUTO_PILOT_STATUSES.READY,
    decision: "manual",
    emergencyStop: false,
    riskLevel:
      safety.riskLevel || "low",
    safety,
    reason:
      "No automatic action selected.",
    nextStep:
      "CEO review required.",
    schedule: null,
  };
}

export async function createAutoPilotSchedule({
  db = null,
  title = "",
  content = "",
  summary = "",
  category = "",
  source = "",
  sourceUrl = "",
  platform = "website",
  region = "worldwide",
  mode = null,
  timezone = null,
  hasAttribution = true,
  exactSourceReproduction = false,
  duplicateMatch = false,
} = {}) {
  const evaluation =
    await evaluateAutoPilot({
      db,
      title,
      content,
      summary,
      category,
      source,
      sourceUrl,
      platform,
      region,
      mode,
      timezone,
      hasAttribution,
      exactSourceReproduction,
      duplicateMatch,
    });

  return {
    success: true,
    ...evaluation,
  };
}

export function getNextAutoPublishTime(
  schedule
) {
  return (
    schedule?.nextPublishAt ||
    schedule?.scheduledAt ||
    null
  );
}

export async function shouldAutoPublish(
  options = {}
) {
  const result =
    await evaluateAutoPilot(options);

  return (
    result.decision === "auto_publish" &&
    result.status ===
      AUTO_PILOT_STATUSES.SCHEDULED &&
    result.emergencyStop === false
  );
}

export function getAutoPilotStatus() {
  return {
    name: "ZEESHAN NEWS AI Auto-Pilot",
    status: "ready",
    modes: Object.values(
      AUTO_PILOT_MODES
    ),
    statuses: Object.values(
      AUTO_PILOT_STATUSES
    ),
    humanControl: true,
    emergencyStop: true,
  };
}

export function createCEOApprovalItem(
  data = {}
) {
  return {
    articleId:
      data.articleId || null,
    platform:
      data.platform || "website",
    region:
      data.region || "worldwide",
    title:
      data.title || "",
    content:
      data.content || "",
    decision:
      data.decision || "ceo_approval",
    riskLevel:
      data.riskLevel || "medium",
    safetyResult:
      data.safetyResult || null,
    scheduleData:
      data.scheduleData || null,
    status: "pending",
  };
}

export function createEmergencyStopState(
  reason = "Emergency stop activated"
) {
  return {
    emergencyStop: true,
    reason,
    stoppedAt:
      new Date().toISOString(),
  };
}

export function getAutoPilotModes() {
  return Object.values(
    AUTO_PILOT_MODES
  );
}

export function getAutoPilotStatuses() {
  return Object.values(
    AUTO_PILOT_STATUSES
  );
}