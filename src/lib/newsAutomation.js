import { runRssEngine } from "./rssEngine.js";

import {
  analyzeNewsBatch,
} from "./aiNewsEngine.js";

import {
  createCopyrightDecision,
  saveCopyrightStatus,
} from "./copyrightProtection.js";

import {
  recordCopyrightDecision,
} from "./legalAudit.js";

import {
  evaluateSourcePolicy,
} from "./sourcePolicyRegistry.js";

import {
  shouldBlockArticle,
} from "./emergencyKillSwitch.js";


let automationRunning = false;

let lastRun = null;

let lastReport = null;


// ========================================
// GET UNANALYZED ARTICLES
// ========================================

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
    await db.query(
      `
      SELECT
        id,
        title,
        content,
        description,
        source,
        link,
        published_at,
        copyright_status,
        copyright_risk,
        legal_hold,
        legal_review_required,
        takedown_status
      FROM articles
      WHERE
        (
          is_analyzed = FALSE
          OR is_analyzed IS NULL
        )
      ORDER BY
        published_at DESC NULLS LAST,
        created_at DESC
      LIMIT $1
      `,
      [
        safeLimit,
      ]
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

      analysis.category ||
        "world",

      analysis.sentiment ||
        "neutral",

      isAIAnalyzed,

      analysis.articleId,
    ]
  );


  return true;
}


// ========================================
// PROCESS COPYRIGHT CHECKS
// ========================================

async function processCopyrightChecks(
  db,
  articles
) {
  let checked = 0;

  let held = 0;

  let reviewRequired = 0;

  let blocked = 0;


  for (
    const article of articles
  ) {
    try {

      const sourcePolicy =
        evaluateSourcePolicy(
          article
        );


      const decision =
        createCopyrightDecision(
          article
        );


      if (
        !sourcePolicy.policy.active
      ) {
        decision.copyrightStatus =
          "blocked";

        decision.copyrightRisk =
          "high";

        decision.legalHold =
          true;

        decision.legalReviewRequired =
          true;

        decision.reasons.push(
          "Source is disabled by source policy"
        );
      }


      if (
        sourcePolicy.policy
          .copyrightReviewRequired
      ) {
        decision.legalReviewRequired =
          true;

        if (
          decision.copyrightStatus ===
          "cleared"
        ) {
          decision.copyrightStatus =
            "review_required";
        }

        decision.reasons.push(
          "Source requires copyright review"
        );
      }


      const killStatus =
        shouldBlockArticle(
          {
            ...article,

            legal_hold:
              decision.legalHold,

            legal_review_required:
              decision.legalReviewRequired,

            copyright_status:
              decision.copyrightStatus,
          }
        );


      if (
        killStatus.blocked
      ) {
        decision.legalHold =
          true;

        decision.legalReviewRequired =
          true;

        decision.copyrightStatus =
          decision.copyrightStatus ===
            "blocked"
            ? "blocked"
            : "held";

        decision.reasons.push(
          killStatus.reason
        );
      }


      await saveCopyrightStatus(
        db,
        article.id,
        decision
      );


      await recordCopyrightDecision(
        db,
        article.id,
        {
          ...decision,

          reason:
            decision.reasons.join(
              "; "
            ),
        },
        "system"
      );


      checked++;


      if (
        decision.copyrightStatus ===
        "blocked"
      ) {
        blocked++;
      }


      if (
        decision.legalHold
      ) {
        held++;
      }


      if (
        decision.legalReviewRequired
      ) {
        reviewRequired++;
      }

    } catch (error) {

      console.error(
        `❌ Copyright check failed for article ${article.id}:`,
        error.message
      );
    }
  }


  return {
    checked,

    held,

    reviewRequired,

    blocked,
  };
}


// ========================================
// PROCESS UNANALYZED NEWS
// ========================================

async function processUnanalyzedNews(
  db,
  articles
) {
  const publishableArticles =
    articles.filter(
      (article) => {

        const blockStatus =
          shouldBlockArticle(
            article
          );

        return (
          !blockStatus.blocked
        );
      }
    );


  if (
    publishableArticles.length ===
    0
  ) {
    return {
      found:
        articles.length,

      eligible:
        0,

      analyzed:
        0,

      saved:
        0,
    };
  }


  console.log(
    `🤖 AI processing ${publishableArticles.length} legally eligible articles...`
  );


  const analyses =
    await analyzeNewsBatch(
      publishableArticles
    );


  let saved = 0;


  for (
    const analysis of analyses
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
    found:
      articles.length,

    eligible:
      publishableArticles.length,

    analyzed:
      analyses.length,

    saved,
  };
}


// ========================================
// RUN FULL NEWS AUTOMATION
// ========================================

export async function runNewsAutomation(
  db
) {
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


  automationRunning =
    true;


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

    // ------------------------------------
    // RSS FETCH
    // ------------------------------------

    const rssReport =
      await runRssEngine(
        db
      );


    // ------------------------------------
    // GET FRESH UNANALYZED ARTICLES
    // ------------------------------------

    const articles =
      await getUnanalyzedArticles(
        db,
        20
      );


    // ------------------------------------
    // COPYRIGHT / LEGAL CHECK
    // ------------------------------------

    const legalReport =
      await processCopyrightChecks(
        db,
        articles
      );


    // ------------------------------------
    // REFRESH ARTICLES AFTER LEGAL CHECK
    // ------------------------------------

    const refreshedArticles =
      await getUnanalyzedArticles(
        db,
        20
      );


    // ------------------------------------
    // AI PROCESSING
    // ------------------------------------

    const aiReport =
      await processUnanalyzedNews(
        db,
        refreshedArticles
      );


    const completedAt =
      new Date();


    const report = {
      success: true,

      startedAt,

      completedAt,

      rss:
        rssReport,

      legal:
        legalReport,

      ai:
        aiReport,
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