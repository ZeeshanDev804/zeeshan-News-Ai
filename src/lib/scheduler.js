import {
  runNewsAutomation,
} from "./newsAutomation.js";


// ========================================
// SCHEDULER CONFIG
// ========================================

// ہر 30 منٹ بعد automation
const DEFAULT_INTERVAL =
  30 * 60 * 1000;


let schedulerTimer = null;

let schedulerStarted = false;


// ========================================
// RUN AUTOMATION SAFELY
// ========================================

async function runScheduledAutomation(
  db
) {
  try {

    console.log(
      "⏰ Scheduled news automation started"
    );


    const report =
      await runNewsAutomation(
        db
      );


    if (
      report?.success
    ) {

      console.log(
        "✅ Scheduled automation completed"
      );

    } else {

      console.log(
        "⚠️ Scheduled automation skipped or failed"
      );

    }

  } catch (error) {

    console.error(
      "❌ Scheduled automation error:",
      error.message
    );

  }
}


// ========================================
// START SCHEDULER
// ========================================

export function startScheduler(
  db,
  intervalMs = DEFAULT_INTERVAL
) {

  if (
    schedulerStarted
  ) {

    console.log(
      "⚠️ Scheduler is already running"
    );

    return {
      started: false,
      message:
        "Scheduler is already running",
    };
  }


  const safeInterval =
    Number(intervalMs);


  if (
    !Number.isFinite(
      safeInterval
    ) ||
    safeInterval < 60000
  ) {

    throw new Error(
      "Scheduler interval must be at least 60000 milliseconds"
    );
  }


  schedulerStarted =
    true;


  console.log(
    "================================="
  );

  console.log(
    "⏰ ZEESHAN NEWS AI SCHEDULER"
  );

  console.log(
    `🔁 Interval: ${safeInterval / 60000} minutes`
  );

  console.log(
    "================================="
  );


  // First automatic run
  runScheduledAutomation(
    db
  );


  // Repeating runs
  schedulerTimer =
    setInterval(
      () => {

        runScheduledAutomation(
          db
        );

      },
      safeInterval
    );


  return {
    started: true,
    intervalMs:
      safeInterval,
  };
}


// ========================================
// STOP SCHEDULER
// ========================================

export function stopScheduler() {

  if (
    schedulerTimer
  ) {

    clearInterval(
      schedulerTimer
    );

    schedulerTimer =
      null;
  }


  schedulerStarted =
    false;


  console.log(
    "⏹️ News scheduler stopped"
  );


  return {
    stopped: true,
  };
}


// ========================================
// SCHEDULER STATUS
// ========================================

export function getSchedulerStatus() {

  return {

    running:
      schedulerStarted,

    intervalMinutes:
      schedulerStarted
        ? DEFAULT_INTERVAL / 60000
        : null,

  };
}
