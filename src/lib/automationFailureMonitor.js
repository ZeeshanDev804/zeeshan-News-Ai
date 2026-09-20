import {
  recordProductionHealth,
} from "./productionMonitor.js";

export async function recordAutomationHealth(
  db,
  report
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const success =
    report?.success === true;

  const status =
    success
      ? "healthy"
      : "critical";

  const message =
    success
      ? "News automation completed successfully"
      : String(
          report?.error ||
            "News automation failed"
        ).slice(0, 2000);

  return recordProductionHealth(
    db,
    "news-automation",
    status,
    message,
    {
      rss:
        report?.rss || null,

      ai:
        report?.ai || null,

      trending:
        report?.trending || null,

      cleanup:
        report?.cleanup || null,

      timestamp:
        new Date().toISOString(),
    }
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
  };
}
