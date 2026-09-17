import { runRssEngine } from "./rssEngine.js";
import {
  analyzeNewsBatch,
} from "./aiNewsEngine.js";


// ========================================
// AUTOMATION STATE
// ========================================

let automationRunning = false;

let lastRun = null;

let lastReport = null;


// ========================================
// GET NEW UNANALYZED ARTICLES
// ========================================

async function getUnanalyzedArticles(
  db,
  limit = 20
) {
  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 20,
      1
    ),
    50
  );

  const result =
    await db.query(
      `
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
        is_analyzed = FALSE
        OR is_analyzed IS NULL
      ORDER BY
        published_at DESC NULLS LAST,
        created_at DESC
      LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows;
}


// ========================================
// SAVE AI RESULT
// ========================================

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

  await db.query(
    `
    UPDATE articles
    SET
      ai_summary = $1,
      ai_category = $2,
      ai_sentiment = $3,
      is_analyzed = $4
    WHERE id = $5
    `,
    [
      analysis.summary || "",
      analysis.category || "world",
      analysis.sentiment || "neutral",
      isAIAnalyzed,
      analysis.articleId,
    ]
  );

  return true;
}


// ========================================
// RUN AI PROCESSING
// ========================================

async function processUnanalyzedNews(
  db
) {
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
    const analysis
    of analyses
  ) {

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
    found: articles.length,
    analyzed: analyses.length,
    saved,
  };
}


// ========================================
// RUN COMPLETE NEWS AUTOMATION
// ========================================

export async function runNewsAutomation(
  db
) {
  if (automationRunning) {

    return {
      success: false,
      skipped: true,
      message:
        "News automation is already running",
    };
  }


  automationRunning = true;

  const startedAt =
    new Date();


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

    // ====================================
    // STEP 1 — RSS
    // ====================================

    const rssReport =
      await runRssEngine(
        db
      );


    // ====================================
    // STEP 2 — AI
    // ====================================

    const aiReport =
      await processUnanalyzedNews(
        db
      );


    // ====================================
    // FINAL REPORT
    // ====================================

    const completedAt =
      new Date();

    const report = {
      success: true,

      startedAt,

      completedAt,

      rss: rssReport,

      ai: aiReport,
    };


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
      report
    );

    console.log(
      "================================="
    );


    return report;

  } catch (error) {

    const completedAt =
      new Date();

    const report = {
      success: false,

      startedAt,

      completedAt,

      error:
        error.message,
    };


    lastRun =
      completedAt;

    lastReport =
      report;


    console.error(
      "❌ News automation failed:",
      error.message
    );


    return report;

  } finally {

    automationRunning =
      false;
  }
}


// ========================================
// AUTOMATION STATUS
// ========================================

export function getAutomationStatus() {
  return {
    running:
      automationRunning,

    lastRun,

    lastReport,
  };
}
