import {
  runNewsAutomation,
} from "./newsAutomation.js";

let schedulerRunning = false;
let lastExecution = null;
let lastResult = null;

/* =========================
   RUN SCHEDULED AUTOMATION
========================= */

export async function runScheduledAutomation(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (schedulerRunning) {
    return {
      success: false,
      skipped: true,
      message:
        "Scheduled automation is already running",
      timestamp:
        new Date().toISOString(),
    };
  }

  schedulerRunning = true;

  const startedAt =
    new Date();

  try {
    console.log(
      "⏰ Scheduled automation started..."
    );

    const result =
      await runNewsAutomation(
        db
      );

    lastExecution =
      new Date();

    lastResult =
      result;

    console.log(
      "✅ Scheduled automation completed"
    );

    return {
      success:
        result?.success !== false,

      source:
        "automation-scheduler",

      startedAt,

      completedAt:
        new Date(),

      result,
    };
  } catch (error) {
    lastExecution =
      new Date();

    lastResult = {
      success: false,
      error:
        error.message,
    };

    console.error(
      "❌ Scheduled automation failed:",
      error.message
    );

    return {
      success: false,

      source:
        "automation-scheduler",

      startedAt,

      completedAt:
        new Date(),

      error:
        error.message,
    };
  } finally {
    schedulerRunning =
      false;
  }
}

/* =========================
   SCHEDULER STATUS
========================= */

export function getAutomationSchedulerStatus() {
  return {
    enabled: true,

    running:
      schedulerRunning,

    schedule:
      "*/30 * * * *",

    intervalMinutes:
      30,

    execution:
      "external-cron",

    provider:
      "Vercel Cron",

    lastExecution,

    lastResult,

    overlapProtection:
      true,

    automatic:
      true,
  };
}
