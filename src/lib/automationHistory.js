function normalizeValue(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function safeJson(value) {
  try {
    return JSON.stringify(
      value ?? {}
    );
  } catch {
    return JSON.stringify({});
  }
}

export async function ensureAutomationHistoryTable(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id SERIAL PRIMARY KEY,

      status TEXT NOT NULL DEFAULT 'running',

      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      completed_at TIMESTAMP,

      duration_ms INTEGER,

      rss_report JSONB DEFAULT '{}'::jsonb,

      ai_report JSONB DEFAULT '{}'::jsonb,

      cleanup_report JSONB DEFAULT '{}'::jsonb,

      error_message TEXT,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_automation_runs_status
      ON automation_runs(status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at
      ON automation_runs(started_at DESC)
  `);

  return {
    success: true,
  };
}

export async function createAutomationRun(
  db,
  startedAt = new Date()
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureAutomationHistoryTable(
    db
  );

  const result =
    await db.query(
      `
      INSERT INTO automation_runs
        (
          status,
          started_at
        )
      VALUES
        (
          'running',
          $1
        )
      RETURNING *
      `,
      [startedAt]
    );

  return result.rows[0];
}

export async function completeAutomationRun(
  db,
  runId,
  report = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id =
    Number(runId);

  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    throw new Error(
      "Valid automation run ID is required"
    );
  }

  const completedAt =
    report.completedAt ||
    new Date();

  const startedAt =
    report.startedAt
      ? new Date(
          report.startedAt
        )
      : completedAt;

  const durationMs =
    Math.max(
      completedAt.getTime() -
        startedAt.getTime(),
      0
    );

  const result =
    await db.query(
      `
      UPDATE automation_runs
      SET
        status = $1,

        completed_at = $2,

        duration_ms = $3,

        rss_report = $4::jsonb,

        ai_report = $5::jsonb,

        cleanup_report = $6::jsonb,

        error_message = NULL

      WHERE id = $7

      RETURNING *
      `,
      [
        report.success
          ? "completed"
          : "failed",

        completedAt,

        durationMs,

        safeJson(
          report.rss
        ),

        safeJson(
          report.ai
        ),

        safeJson(
          report.cleanup
        ),

        id,
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

export async function failAutomationRun(
  db,
  runId,
  error,
  report = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id =
    Number(runId);

  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    throw new Error(
      "Valid automation run ID is required"
    );
  }

  const completedAt =
    new Date();

  const startedAt =
    report.startedAt
      ? new Date(
          report.startedAt
        )
      : completedAt;

  const durationMs =
    Math.max(
      completedAt.getTime() -
        startedAt.getTime(),
      0
    );

  const errorMessage =
    normalizeValue(
      error?.message ||
        error,
      "Automation failed"
    ).slice(
      0,
      2000
    );

  const result =
    await db.query(
      `
      UPDATE automation_runs
      SET
        status = 'failed',

        completed_at = $1,

        duration_ms = $2,

        rss_report = $3::jsonb,

        ai_report = $4::jsonb,

        cleanup_report = $5::jsonb,

        error_message = $6

      WHERE id = $7

      RETURNING *
      `,
      [
        completedAt,

        durationMs,

        safeJson(
          report.rss
        ),

        safeJson(
          report.ai
        ),

        safeJson(
          report.cleanup
        ),

        errorMessage,

        id,
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

export async function getAutomationHistory(
  db,
  limit = 50
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureAutomationHistoryTable(
    db
  );

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 50,
        1
      ),
      200
    );

  const result =
    await db.query(
      `
      SELECT
        id,
        status,
        started_at,
        completed_at,
        duration_ms,
        rss_report,
        ai_report,
        cleanup_report,
        error_message,
        created_at
      FROM automation_runs
      ORDER BY started_at DESC
      LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows;
}

export async function getAutomationRun(
  db,
  runId
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const id =
    Number(runId);

  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    throw new Error(
      "Valid automation run ID is required"
    );
  }

  await ensureAutomationHistoryTable(
    db
  );

  const result =
    await db.query(
      `
      SELECT
        id,
        status,
        started_at,
        completed_at,
        duration_ms,
        rss_report,
        ai_report,
        cleanup_report,
        error_message,
        created_at
      FROM automation_runs
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

  return (
    result.rows[0] ||
    null
  );
}
