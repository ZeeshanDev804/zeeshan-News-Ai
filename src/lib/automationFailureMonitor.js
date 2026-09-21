import {
  recordProductionHealth,
} from "./productionMonitor.js";

const MAX_MESSAGE_LENGTH = 2000;

function validateDatabase(db) {
  if (!db || typeof db.query !== "function") {
    throw new Error(
      "Database connection is required"
    );
  }
}

function normalizeReport(report) {
  if (!report || typeof report !== "object") {
    return {};
  }

  return report;
}

function getComponentStatus(report) {
  if (report?.success === true) {
    return "healthy";
  }

  return "critical";
}

function createHealthMessage(report, status) {
  if (status === "healthy") {
    return "News automation completed successfully";
  }

  const errorMessage =
    report?.error ||
    report?.message ||
    "News automation failed";

  return String(errorMessage)
    .slice(0, MAX_MESSAGE_LENGTH);
}

function buildHealthDetails(report) {
  return {
    success:
      report?.success === true,

    rss:
      report?.rss || null,

    ai:
      report?.ai || null,

    trending:
      report?.trending || null,

    cleanup:
      report?.cleanup || null,

    operationalCleanup:
      report?.operationalCleanup || null,

    automation:
      report?.automation || null,

    durationMs:
      Number.isFinite(
        Number(report?.durationMs)
      )
        ? Number(report.durationMs)
        : null,

    timestamp:
      new Date().toISOString(),
  };
}

export async function recordAutomationHealth(
  db,
  report
) {
  validateDatabase(db);

  const normalizedReport =
    normalizeReport(report);

  const status =
    getComponentStatus(
      normalizedReport
    );

  const message =
    createHealthMessage(
      normalizedReport,
      status
    );

  const details =
    buildHealthDetails(
      normalizedReport
    );

  return recordProductionHealth(
    db,
    "news-automation",
    status,
    message,
    details
  );
}

export function getAutomationFailureMonitorStatus() {
  return {
    enabled: true,

    component:
      "news-automation",

    productionHealthLogging:
      true,

    successTracking:
      true,

    failureTracking:
      true,

    databasePersistence:
      true,

    rssHealthTracking:
      true,

    aiHealthTracking:
      true,

    trendingHealthTracking:
      true,

    cleanupHealthTracking:
      true,

    operationalCleanupTracking:
      true,

    durationTracking:
      true,

    timestamp:
      new Date().toISOString(),
  };
}