import {
  runRssEngine,
} from "./rssEngine.js";

import {
  analyzeNewsBatch,
} from "./aiNewsEngine.js";

import {
  cleanupOldArticles,
} from "./cleanupEngine.js";

import {
  createAutomationRun,
  completeAutomationRun,
  failAutomationRun,
} from "./automationHistory.js";

import {
  runTrendingCron,
} from "./trendingCron.js";

import {
  recordAutomationHealth,
} from "./automationFailureMonitor.js";

import {
  cleanupAllOperationalLogs,
} from "./adminAuditRetention.js";

import {
  getAutomationControl,
  assertAutomationAllowed,
} from "./automationControl.js";

let automationRunning = false;
let lastRun = null;
let lastReport = null;

/* =========================
   AUTOMATION CONTROL GUARD
========================= */

async function checkAutomationControl(
  db
) {
  const state =
    await getAutomationControl(
      db
    );

  if (
    state.enabled !== true ||
    state.emergencyStop === true
  ) {
    const reason =
      state.reason ||
      (
        state.emergencyStop
          ? "Emergency stop is active"
          : "Automation is disabled"
      );

    return {
      allowed: false,

      emergencyStop:
        state.emergencyStop === true,

      enabled:
        state.enabled === true,

      reason,
    };
  }

  return {
    allowed: true,

    emergencyStop: false,

    enabled: true,

    reason: "",
  };
}

async function requireAutomationAllowed(
  db,
  stage
) {
  try {
    await assertAutomationAllowed(
      db
    );

    return true;
  } catch (error) {
    throw new Error(
      `AUTOMATION_STOPPED at ${stage}: ${error.message}`
    );
  }
}

/* =========================
   GET UNANALYZED ARTICLES
========================= */

async function getUnanalyzedArticles(
  db,
  limit = 20
) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      50
    );

  const result =
    await db.query(`
      SELECT
        id,
        title,
        content,
        description,
        source,
        link,
        published_at
      FROM articles
      WHERE
        (
          is_analyzed = FALSE
          OR is_analyzed IS NULL
        )
      AND
        (
          legal_hold = FALSE
          OR legal_hold IS NULL
        )
      AND
        (
          legal_review_required = FALSE
          OR legal_review_required IS NULL
        )
      ORDER BY
        published_at DESC NULLS LAST,
        created_at DESC
      LIMIT $1
    `, [safeLimit]);

  return result.rows;
}

/* =========================
   SAVE AI RESULT
========================= */

async function saveAIResult(
  db,
  analysis
) {
  if (
    !analysis?.success ||
    !analysis?.articleId
  ) {
    return false;
  }

  const isAIAnalyzed =
    analysis.status ===
    "ai_analyzed";

  await db.query(`
    UPDATE articles
    SET
      ai_headline = $1,
      ai_summary = $2,
      ai_category = $3,
      seo_title = $4,
      ai_sentiment = $5,
      key_points = $6,
      is_analyzed = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
  `, [
    analysis.headline || "",

    analysis.summary || "",

    analysis.category ||
      "world",

    analysis.seoTitle || "",

    analysis.sentiment ||
      "neutral",

    JSON.stringify(
      Array.isArray(
        analysis.keyPoints
      )
        ? analysis.keyPoints
        : []
    ),

    isAIAnalyzed,

    analysis.articleId,
  ]);

  return true;
}

/* =========================
   AI PROCESSING
========================= */

async function processUnanalyzedNews(
  db
) {
  await requireAutomationAllowed(
    db,
    "AI"
  );

  const articles =
    await getUnanalyzedArticles(
      db,
      20
    );

  if (
    articles.length === 0
  ) {
    return {
      found: 0,
      analyzed: 0,
      saved: 0,
    };
  }

  console.log(
    `🤖 AI processing ${articles.length} articles...`
  );

  const analyses =
    await analyzeNewsBatch(
      articles
    );

  let saved = 0;

  for (
    const analysis of analyses
  ) {
    await requireAutomationAllowed(
      db,
      "AI result saving"
    );

    const result =
      await saveAIResult(
        db,
        analysis
      );

    if (result) {
      saved++;
    }
  }

  return {
    found:
      articles.length,

    analyzed:
      analyses.length,

    saved,
  };
}

/* =========================
   ARTICLE CLEANUP
========================= */

async function runArticleCleanup(
  db
) {
  try {
    await requireAutomationAllowed(
      db,
      "Article Cleanup"
    );

    console.log(
      "🧹 Running article cleanup..."
    );

    const report =
      await cleanupOldArticles(
        db,
        {
          retentionDays: 90,
          maxDelete: 500,
        }
      );

    console.log(
      `🧹 Article cleanup completed. Deleted: ${
        report.deleted || 0
      }`
    );

    return report;
  } catch (error) {
    if (
      String(error.message)
        .startsWith(
          "AUTOMATION_STOPPED"
        )
    ) {
      throw error;
    }

    console.error(
      "❌ Article cleanup failed:",
      error.message
    );

    return {
      success: false,
      deleted: 0,
      error:
        error.message,
    };
  }
}

/* =========================
   OPERATIONAL LOG CLEANUP
========================= */

async function runOperationalCleanup(
  db
) {
  try {
    await requireAutomationAllowed(
      db,
      "Operational Cleanup"
    );

    console.log(
      "🧽 Running operational log cleanup..."
    );

    const report =
      await cleanupAllOperationalLogs(
        db
      );

    console.log(
      `🧽 Operational cleanup completed. Audit deleted: ${
        report.audit?.deleted || 0
      }`
    );

    console.log(
      `🧽 Health logs deleted: ${
        report.health?.deleted || 0
      }`
    );

    console.log(
      `🧽 Resolved source failures deleted: ${
        report.sourceFailures?.deleted || 0
      }`
    );

    return report;
  } catch (error) {
    if (
      String(error.message)
        .startsWith(
          "AUTOMATION_STOPPED"
        )
    ) {
      throw error;
    }

    console.error(
      "❌ Operational cleanup failed:",
      error.message
    );

    return {
      success: false,

      audit: {
        deleted: 0,
      },

      health: {
        deleted: 0,
      },

      sourceFailures: {
        deleted: 0,
      },

      error:
        error.message,
    };
  }
}

/* =========================
   TRENDING
========================= */

async function runTrending(
  db
) {
  try {
    await requireAutomationAllowed(
      db,
      "Trending"
    );

    console.log(
      "📈 Running trending intelligence..."
    );

    const report =
      await runTrendingCron(
        db
      );

    console.log(
      `📈 Trending completed. Processed: ${
        report.processed || 0
      }`
    );

    return report;
  } catch (error) {
    if (
      String(error.message)
        .startsWith(
          "AUTOMATION_STOPPED"
        )
    ) {
      throw error;
    }

    console.error(
      "❌ Trending failed:",
      error.message
    );

    return {
      success: false,
      processed: 0,
      failed: 0,
      error:
        error.message,
    };
  }
}

/* =========================
   RSS
========================= */

async function runRss(
  db
) {
  try {
    await requireAutomationAllowed(
      db,
      "RSS"
    );

    console.log(
      "📡 Running RSS news engine..."
    );

    const report =
      await runRssEngine(
        db
      );

    console.log(
      `📡 RSS completed. Sources: ${
        report.totalSources || 0
      } | Saved: ${
        report.articlesSaved || 0
      } | Duplicates: ${
        report.duplicates || 0
      }`
    );

    return report;
  } catch (error) {
    if (
      String(error.message)
        .startsWith(
          "AUTOMATION_STOPPED"
        )
    ) {
      throw error;
    }

    console.error(
      "❌ RSS engine failed:",
      error.message
    );

    return {
      success: false,

      totalSources: 0,

      successfulSources: 0,

      failedSources: 0,

      articlesFetched: 0,

      articlesSaved: 0,

      duplicates: 0,

      skipped: 0,

      failures: [],

      error:
        error.message,
    };
  }
}

/* =========================
   MAIN AUTOMATION
========================= */

export async function runNewsAutomation(
  db
) {
  if (!db) {
    return {
      success: false,

      error:
        "Database connection is required",
    };
  }

  if (
    automationRunning
  ) {
    return {
      success: false,

      skipped: true,

      message:
        "News automation is already running",
    };
  }

  /* =========================
     INITIAL CONTROL CHECK
  ========================= */

  const control =
    await checkAutomationControl(
      db
    );

  if (!control.allowed) {
    const stoppedReport = {
      success: false,

      skipped: true,

      automationStopped: true,

      emergencyStop:
        control.emergencyStop,

      enabled:
        control.enabled,

      reason:
        control.reason,

      timestamp:
        new Date().toISOString(),
    };

    lastRun =
      new Date();

    lastReport =
      stoppedReport;

    console.warn(
      "🛑 NEWS AUTOMATION BLOCKED:",
      control.reason
    );

    return stoppedReport;
  }

  automationRunning = true;

  const startedAt =
    new Date();

  let historyRun = null;

  console.log(
    "================================="
  );

  console.log(
    "🤖 ZEESHAN NEWS AI AUTOMATION STARTED"
  );

  console.log(
    "================================="
  );

  try {
    /* =========================
       HISTORY START
    ========================= */

    await requireAutomationAllowed(
      db,
      "History Start"
    );

    historyRun =
      await createAutomationRun(
        db,
        startedAt
      );

    /* =========================
       1. RSS
    ========================= */

    const rssReport =
      await runRss(
        db
      );

    /* =========================
       2. AI
    ========================= */

    await requireAutomationAllowed(
      db,
      "Before AI"
    );

    const aiReport =
      await processUnanalyzedNews(
        db
      );

    /* =========================
       3. TRENDING
    ========================= */

    await requireAutomationAllowed(
      db,
      "Before Trending"
    );

    const trendingReport =
      await runTrending(
        db
      );

    /* =========================
       4. ARTICLE CLEANUP
    ========================= */

    await requireAutomationAllowed(
      db,
      "Before Article Cleanup"
    );

    const cleanupReport =
      await runArticleCleanup(
        db
      );

    /* =========================
       5. OPERATIONAL CLEANUP
    ========================= */

    await requireAutomationAllowed(
      db,
      "Before Operational Cleanup"
    );

    const operationalCleanupReport =
      await runOperationalCleanup(
        db
      );

    /* =========================
       FINAL CONTROL CHECK
    ========================= */

    await requireAutomationAllowed(
      db,
      "Finalization"
    );

    const completedAt =
      new Date();

    const report = {
      success: true,

      startedAt,

      completedAt,

      rss:
        rssReport,

      ai:
        aiReport,

      trending:
        trendingReport,

      cleanup:
        cleanupReport,

      operationalCleanup:
        operationalCleanupReport,

      automationControl: {
        emergencyStop: false,
        enabled: true,
      },
    };

    /* =========================
       SAVE HISTORY
    ========================= */

    if (
      historyRun?.id
    ) {
      await completeAutomationRun(
        db,
        historyRun.id,
        report
      );
    }

    /* =========================
       PRODUCTION HEALTH
    ========================= */

    try {
      await recordAutomationHealth(
        db,
        report
      );
    } catch (
      healthError
    ) {
      console.error(
        "⚠️ Automation health logging failed:",
        healthError.message
      );
    }

    lastRun =
      completedAt;

    lastReport =
      report;

    console.log(
      "================================="
    );

    console.log(
      "✅ NEWS AUTOMATION COMPLETED"
    );

    console.log(
      `📰 RSS Saved: ${
        rssReport.articlesSaved ||
        0
      }`
    );

    console.log(
      `🤖 AI Saved: ${
        aiReport.saved || 0
      }`
    );

    console.log(
      `📈 Trending: ${
        trendingReport.processed ||
        0
      }`
    );

    console.log(
      `🧹 Articles Deleted: ${
        cleanupReport.deleted ||
        0
      }`
    );

    console.log(
      `🧽 Audit Logs Deleted: ${
        operationalCleanupReport.audit?.deleted ||
        0
      }`
    );

    console.log(
      "================================="
    );

    return report;

  } catch (error) {
    const completedAt =
      new Date();

    const stopped =
      String(error.message)
        .includes(
          "AUTOMATION_STOPPED"
        );

    const report = {
      success: false,

      startedAt,

      completedAt,

      automationStopped:
        stopped,

      error:
        error.message,
    };

    /* =========================
       FAILURE HISTORY
    ========================= */

    if (
      historyRun?.id
    ) {
      try {
        if (stopped) {
          await failAutomationRun(
            db,
            historyRun.id,
            error,
            report
          );
        } else {
          await failAutomationRun(
            db,
            historyRun.id,
            error,
            report
          );
        }
      } catch (
        historyError
      ) {
        console.error(
          "❌ Failed to save automation failure history:",
          historyError.message
        );
      }
    }

    /* =========================
       FAILURE HEALTH
    ========================= */

    try {
      await recordAutomationHealth(
        db,
        report
      );
    } catch (
      healthError
    ) {
      console.error(
        "⚠️ Automation failure health logging failed:",
      healthError.message
      );
    }

    lastRun =
      completedAt;

    lastReport =
      report;

    if (stopped) {
      console.warn(
        "🛑 NEWS AUTOMATION STOPPED BY CONTROL:",
        error.message
      );
    } else {
      console.error(
        "❌ News automation failed:",
        error.message
      );
    }

    return report;

  } finally {
    automationRunning =
      false;
  }
}

/* =========================
   AUTOMATION STATUS
========================= */

export function getAutomationStatus() {
  return {
    running:
      automationRunning,

    lastRun,

    lastReport,

    pipeline: [
      "RSS",
      "Database",
      "Duplicate Check",
      "AI Analysis",
      "Trending Intelligence",
      "Article Cleanup",
      "Operational Log Cleanup",
      "Production Health",
    ],

    automaticRSS:
      true,

    automaticAI:
      true,

    automaticTrending:
      true,

    automaticArticleCleanup:
      true,

    automaticOperationalCleanup:
      true,

    productionHealthLogging:
      true,

    emergencyStopControl:
      true,

    ceoAutomationControl:
      true,

    stopGuardBeforeStages:
      true,

    fakeTraffic:
      false,

    fakeEngagement:
      false,
  };
}