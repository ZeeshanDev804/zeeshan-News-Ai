export async function getDashboardStats(db) {
  const [
    newsCount,
    analyzedCount,
    categoryCounts,
    sourceCounts,
    recentRuns,
    unhealthySources,
    complaints,
    pushStats,
  ] = await Promise.all([
    db.query(`
      SELECT COUNT(*)::INTEGER AS count
      FROM articles
    `),

    db.query(`
      SELECT COUNT(*)::INTEGER AS count
      FROM articles
      WHERE is_analyzed = TRUE
    `),

    db.query(`
      SELECT
        COALESCE(ai_category, 'uncategorized') AS category,
        COUNT(*)::INTEGER AS count
      FROM articles
      GROUP BY ai_category
      ORDER BY count DESC
    `),

    db.query(`
      SELECT
        COALESCE(source, 'Unknown') AS source,
        COUNT(*)::INTEGER AS count
      FROM articles
      GROUP BY source
      ORDER BY count DESC
    `),

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

    db.query(`
      SELECT
        COUNT(*)::INTEGER AS count
      FROM takedown_complaints
      WHERE status IN (
        'received',
        'under_review'
      )
    `).catch(() => ({
      rows: [{ count: 0 }],
    })),

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
  ]);

  return {
    success: true,

    overview: {
      totalNews:
        newsCount.rows[0]?.count || 0,

      analyzedNews:
        analyzedCount.rows[0]?.count || 0,

      pendingAnalysis:
        Math.max(
          0,
          (newsCount.rows[0]?.count || 0) -
            (analyzedCount.rows[0]?.count || 0)
        ),

      openComplaints:
        complaints.rows[0]?.count || 0,

      activePushUsers:
        pushStats.rows[0]?.active || 0,

      totalPushSubscriptions:
        pushStats.rows[0]?.total || 0,
    },

    categories:
      categoryCounts.rows,

    sources:
      sourceCounts.rows,

    recentAutomation:
      recentRuns.rows,

    unhealthySources:
      unhealthySources.rows,

    push:
      pushStats.rows[0] || {
        active: 0,
        disabled: 0,
        total: 0,
      },

    generatedAt:
      new Date().toISOString(),
  };
}
