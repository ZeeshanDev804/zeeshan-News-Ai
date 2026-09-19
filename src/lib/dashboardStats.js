import {
  getAnalyticsOverview,
  getTopArticles,
  getTopSearches,
  getAnalyticsByDay,
  getAnalyticsByCategory,
} from "./analyticsEngine.js";


export async function getDashboardStats(
  db
) {

  const [
    newsCount,
    analyzedCount,
    categoryCounts,
    sourceCounts,
    recentRuns,
    unhealthySources,
    complaints,
    pushStats,

    analyticsOverview,
    topArticles,
    topSearches,
    analyticsByDay,
    analyticsByCategory,
  ] = await Promise.all([

    /* =========================
       NEWS COUNT
    ========================= */

    db.query(`
      SELECT
        COUNT(*)::INTEGER AS count
      FROM articles
    `),


    /* =========================
       AI ANALYZED COUNT
    ========================= */

    db.query(`
      SELECT
        COUNT(*)::INTEGER AS count
      FROM articles
      WHERE is_analyzed = TRUE
    `),


    /* =========================
       CATEGORY COUNTS
    ========================= */

    db.query(`
      SELECT
        COALESCE(
          ai_category,
          'uncategorized'
        ) AS category,

        COUNT(*)::INTEGER AS count

      FROM articles

      GROUP BY ai_category

      ORDER BY count DESC
    `),


    /* =========================
       SOURCE COUNTS
    ========================= */

    db.query(`
      SELECT
        COALESCE(
          source,
          'Unknown'
        ) AS source,

        COUNT(*)::INTEGER AS count

      FROM articles

      GROUP BY source

      ORDER BY count DESC
    `),


    /* =========================
       AUTOMATION HISTORY
    ========================= */

    db.query(`
      SELECT
        id,
        status,
        started_at,
        completed_at,
        duration_ms,
        rss_report,
        ai_report,
        cleanup_report,
        error

      FROM automation_runs

      ORDER BY started_at DESC

      LIMIT 10
    `),


    /* =========================
       SOURCE HEALTH
    ========================= */

    db.query(`
      SELECT
        source,
        status,
        failure_count,
        last_success_at,
        last_failure_at

      FROM source_health

      WHERE status != 'healthy'

      ORDER BY failure_count DESC

      LIMIT 10
    `).catch(() => ({
      rows: [],
    })),


    /* =========================
       TAKEDOWN COMPLAINTS
    ========================= */

    db.query(`
      SELECT
        COUNT(*)::INTEGER AS count

      FROM takedown_complaints

      WHERE status IN (
        'received',
        'under_review'
      )
    `).catch(() => ({
      rows: [
        {
          count: 0,
        },
      ],
    })),


    /* =========================
       PUSH STATISTICS
    ========================= */

    db.query(`
      SELECT

        COUNT(*) FILTER (
          WHERE enabled = TRUE
        )::INTEGER AS active,

        COUNT(*) FILTER (
          WHERE enabled = FALSE
        )::INTEGER AS disabled,

        COUNT(*)::INTEGER AS total

      FROM push_subscriptions
    `).catch(() => ({
      rows: [
        {
          active: 0,
          disabled: 0,
          total: 0,
        },
      ],
    })),


    /* =========================
       ANALYTICS OVERVIEW
    ========================= */

    getAnalyticsOverview(
      db,
      30
    ).catch(() => ({
      days: 30,

      overview: {
        total_events: 0,
        page_views: 0,
        article_views: 0,
        searches: 0,
        category_views: 0,
        trending_views: 0,
        notification_clicks: 0,
        source_clicks: 0,
      },
    })),


    /* =========================
       TOP ARTICLES
    ========================= */

    getTopArticles(
      db,
      30,
      10
    ).catch(() => []),


    /* =========================
       TOP SEARCHES
    ========================= */

    getTopSearches(
      db,
      30,
      10
    ).catch(() => []),


    /* =========================
       DAILY ANALYTICS
    ========================= */

    getAnalyticsByDay(
      db,
      30
    ).catch(() => []),


    /* =========================
       CATEGORY ANALYTICS
    ========================= */

    getAnalyticsByCategory(
      db,
      30
    ).catch(() => []),
  ]);


  const totalNews =
    Number(
      newsCount.rows[0]?.count || 0
    );


  const analyzedNews =
    Number(
      analyzedCount.rows[0]?.count || 0
    );


  const push =
    pushStats.rows[0] || {
      active: 0,
      disabled: 0,
      total: 0,
    };


  const analytics =
    analyticsOverview?.overview || {
      total_events: 0,
      page_views: 0,
      article_views: 0,
      searches: 0,
      category_views: 0,
      trending_views: 0,
      notification_clicks: 0,
      source_clicks: 0,
    };


  return {

    success: true,


    /* =========================
       MAIN OVERVIEW
    ========================= */

    overview: {

      totalNews,

      analyzedNews,

      pendingAnalysis:
        Math.max(
          0,
          totalNews -
            analyzedNews
        ),

      openComplaints:
        Number(
          complaints.rows[0]?.count || 0
        ),

      activePushUsers:
        Number(
          push.active || 0
        ),

      totalPushSubscriptions:
        Number(
          push.total || 0
        ),
    },


    /* =========================
       NEWS DATA
    ========================= */

    categories:
      categoryCounts.rows,

    sources:
      sourceCounts.rows,


    /* =========================
       AUTOMATION
    ========================= */

    recentAutomation:
      recentRuns.rows,


    /* =========================
       SOURCE HEALTH
    ========================= */

    unhealthySources:
      unhealthySources.rows,


    /* =========================
       PUSH
    ========================= */

    push,


    /* =========================
       ANALYTICS
    ========================= */

    analytics: {

      days:
        analyticsOverview?.days ||
        30,

      overview:
        analytics,

      topArticles,

      topSearches,

      daily:
        analyticsByDay,

      categories:
        analyticsByCategory,
    },


    /* =========================
       SYSTEM TIMESTAMP
    ========================= */

    generatedAt:
      new Date().toISOString(),
  };
}