const MAX_ERROR_MESSAGE_LENGTH = 1000;

function normalizeValue(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeSourceName(source) {
  return normalizeValue(
    source,
    "Unknown Source"
  );
}

function normalizeErrorMessage(error) {
  return normalizeValue(
    error?.message || error,
    "Unknown error"
  ).slice(
    0,
    MAX_ERROR_MESSAGE_LENGTH
  );
}

export async function ensureSourceHealthTable(db) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS source_health (
      id SERIAL PRIMARY KEY,

      source_name TEXT NOT NULL UNIQUE,

      source_url TEXT,

      status TEXT DEFAULT 'healthy',

      success_count INTEGER DEFAULT 0,

      failure_count INTEGER DEFAULT 0,

      consecutive_failures INTEGER DEFAULT 0,

      last_success_at TIMESTAMP,

      last_failure_at TIMESTAMP,

      last_error TEXT,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_source_health_status
      ON source_health(status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_source_health_updated_at
      ON source_health(updated_at DESC)
  `);

  return {
    success: true,
  };
}

export async function recordSourceSuccess(
  db,
  sourceName,
  sourceUrl = ""
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const name =
    normalizeSourceName(
      sourceName
    );

  const url =
    normalizeValue(
      sourceUrl
    );

  await ensureSourceHealthTable(db);

  const result =
    await db.query(
      `
      INSERT INTO source_health
        (
          source_name,
          source_url,
          status,
          success_count,
          failure_count,
          consecutive_failures,
          last_success_at,
          last_error,
          updated_at
        )
      VALUES
        (
          $1,
          $2,
          'healthy',
          1,
          0,
          0,
          CURRENT_TIMESTAMP,
          NULL,
          CURRENT_TIMESTAMP
        )

      ON CONFLICT (source_name)
      DO UPDATE SET
        source_url =
          CASE
            WHEN EXCLUDED.source_url <> ''
            THEN EXCLUDED.source_url
            ELSE source_health.source_url
          END,

        status = 'healthy',

        success_count =
          source_health.success_count + 1,

        consecutive_failures = 0,

        last_success_at =
          CURRENT_TIMESTAMP,

        last_error = NULL,

        updated_at =
          CURRENT_TIMESTAMP

      RETURNING *
      `,
      [
        name,
        url,
      ]
    );

  return result.rows[0];
}

export async function recordSourceFailure(
  db,
  sourceName,
  sourceUrl = "",
  error = null
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const name =
    normalizeSourceName(
      sourceName
    );

  const url =
    normalizeValue(
      sourceUrl
    );

  const errorMessage =
    normalizeErrorMessage(
      error
    );

  await ensureSourceHealthTable(db);

  const result =
    await db.query(
      `
      INSERT INTO source_health
        (
          source_name,
          source_url,
          status,
          success_count,
          failure_count,
          consecutive_failures,
          last_failure_at,
          last_error,
          updated_at
        )
      VALUES
        (
          $1,
          $2,
          'degraded',
          0,
          1,
          1,
          CURRENT_TIMESTAMP,
          $3,
          CURRENT_TIMESTAMP
        )

      ON CONFLICT (source_name)
      DO UPDATE SET
        source_url =
          CASE
            WHEN EXCLUDED.source_url <> ''
            THEN EXCLUDED.source_url
            ELSE source_health.source_url
          END,

        status =
          CASE
            WHEN source_health.consecutive_failures + 1 >= 3
            THEN 'down'
            ELSE 'degraded'
          END,

        failure_count =
          source_health.failure_count + 1,

        consecutive_failures =
          source_health.consecutive_failures + 1,

        last_failure_at =
          CURRENT_TIMESTAMP,

        last_error =
          EXCLUDED.last_error,

        updated_at =
          CURRENT_TIMESTAMP

      RETURNING *
      `,
      [
        name,
        url,
        errorMessage,
      ]
    );

  return result.rows[0];
}

export async function getSourceHealth(
  db,
  sourceName = null
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureSourceHealthTable(db);

  if (
    sourceName &&
    normalizeValue(sourceName)
  ) {
    const result =
      await db.query(
        `
        SELECT
          *
        FROM source_health
        WHERE source_name = $1
        LIMIT 1
        `,
        [
          normalizeSourceName(
            sourceName
          ),
        ]
      );

    return result.rows[0] || null;
  }

  const result =
    await db.query(`
      SELECT
        *
      FROM source_health
      ORDER BY
        updated_at DESC
    `);

  return result.rows;
}

export async function getUnhealthySources(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureSourceHealthTable(db);

  const result =
    await db.query(`
      SELECT
        *
      FROM source_health
      WHERE
        status <> 'healthy'
      ORDER BY
        consecutive_failures DESC,
        updated_at DESC
    `);

  return result.rows;
}

export function getSourceHealthStatus(
  consecutiveFailures
) {
  const failures =
    Number(
      consecutiveFailures
    ) || 0;

  if (failures >= 3) {
    return "down";
  }

  if (failures > 0) {
    return "degraded";
  }

  return "healthy";
}
