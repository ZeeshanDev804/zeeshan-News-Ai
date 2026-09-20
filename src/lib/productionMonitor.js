/* =========================
   ZEESHAN NEWS AI
   PRODUCTION MONITOR
========================= */

const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_RETRY_LIMIT = 3;

/* =========================
   SAFE NUMBER
========================= */

function safeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

/* =========================
   ENSURE TABLES
========================= */

export async function ensureProductionMonitorTables(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS source_failure_log (
      id BIGSERIAL PRIMARY KEY,

      source TEXT NOT NULL,

      error_message TEXT,

      failure_count INTEGER
        NOT NULL DEFAULT 1,

      last_failed_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      resolved BOOLEAN
        NOT NULL DEFAULT FALSE,

      resolved_at TIMESTAMP,

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_source_failure_source
    ON source_failure_log(source)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_source_failure_resolved
    ON source_failure_log(resolved)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_source_failure_last_failed
    ON source_failure_log(last_failed_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS production_health_log (
      id BIGSERIAL PRIMARY KEY,

      component TEXT NOT NULL,

      status TEXT NOT NULL,

      message TEXT,

      details JSONB,

      checked_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_production_health_component
    ON production_health_log(component)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS
    idx_production_health_checked
    ON production_health_log(checked_at DESC)
  `);
}

/* =========================
   RECORD SOURCE FAILURE
========================= */

export async function recordSourceFailure(
  db,
  source,
  error
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureProductionMonitorTables(
    db
  );

  const safeSource =
    String(
      source || "unknown"
    ).trim();

  const errorMessage =
    String(
      error?.message ||
      error ||
      "Unknown source error"
    ).slice(0, 2000);

  const result =
    await db.query(
      `
      SELECT
        id,
        failure_count
      FROM source_failure_log

      WHERE
        source = $1

      AND
        resolved = FALSE

      ORDER BY
        id DESC

      LIMIT 1
      `,
      [safeSource]
    );

  if (
    result.rows.length > 0
  ) {
    const existing =
      result.rows[0];

    const failureCount =
      safeNumber(
        existing.failure_count,
        0
      ) + 1;

    const updated =
      await db.query(
        `
        UPDATE source_failure_log

        SET
          error_message = $1,

          failure_count = $2,

          last_failed_at =
            CURRENT_TIMESTAMP,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $3

        RETURNING *
        `,
        [
          errorMessage,
          failureCount,
          existing.id,
        ]
      );

    return updated.rows[0];
  }

  const inserted =
    await db.query(
      `
      INSERT INTO source_failure_log (
        source,
        error_message,
        failure_count,
        last_failed_at,
        resolved,
        created_at,
        updated_at
      )

      VALUES (
        $1,
        $2,
        1,
        CURRENT_TIMESTAMP,
        FALSE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )

      RETURNING *
      `,
      [
        safeSource,
        errorMessage,
      ]
    );

  return inserted.rows[0];
}

/* =========================
   RESOLVE SOURCE FAILURE
========================= */

export async function resolveSourceFailure(
  db,
  source
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureProductionMonitorTables(
    db
  );

  const result =
    await db.query(
      `
      UPDATE source_failure_log

      SET
        resolved = TRUE,

        resolved_at =
          CURRENT_TIMESTAMP,

        updated_at =
          CURRENT_TIMESTAMP

      WHERE
        source = $1

      AND
        resolved = FALSE

      RETURNING *
      `,
      [
        String(
          source || "unknown"
        ).trim(),
      ]
    );

  return result.rows;
}

/* =========================
   GET FAILED SOURCES
========================= */

export async function getFailedSources(
  db,
  limit = 100
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureProductionMonitorTables(
    db
  );

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 100,
        1
      ),
      500
    );

  const result =
    await db.query(
      `
      SELECT *
      FROM source_failure_log

      WHERE
        resolved = FALSE

      ORDER BY
        failure_count DESC,
        last_failed_at DESC

      LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows;
}

/* =========================
   SOURCE HEALTH
========================= */

export async function checkSourceHealth(
  db,
  source
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const safeSource =
    String(
      source || "unknown"
    ).trim();

  const result =
    await db.query(
      `
      SELECT
        COUNT(*)::INTEGER
          AS failure_events,

        COALESCE(
          MAX(failure_count),
          0
        )::INTEGER
          AS failure_count,

        MAX(last_failed_at)
          AS last_failed_at

      FROM source_failure_log

      WHERE
        source = $1

      AND
        resolved = FALSE
      `,
      [safeSource]
    );

  const row =
    result.rows[0] || {};

  const failureCount =
    safeNumber(
      row.failure_count
    );

  let status =
    "healthy";

  if (
    failureCount >=
    DEFAULT_MAX_FAILURES
  ) {
    status =
      "critical";
  } else if (
    failureCount >= 3
  ) {
    status =
      "warning";
  }

  return {
    source:
      safeSource,

    status,

    failureEvents:
      safeNumber(
        row.failure_events
      ),

    failureCount,

    lastFailedAt:
      row.last_failed_at ||
      null,

    automaticRetry:
      true,

    retryLimit:
      DEFAULT_RETRY_LIMIT,
  };
}

/* =========================
   RETRY POLICY
========================= */

export function shouldRetry(
  attempt
) {
  const currentAttempt =
    safeNumber(
      attempt,
      0
    );

  return (
    currentAttempt <
    DEFAULT_RETRY_LIMIT
  );
}

export function getRetryDelay(
  attempt
) {
  const currentAttempt =
    Math.max(
      safeNumber(
        attempt,
        0
      ),
      0
    );

  /*
   * Exponential backoff:
   * 1st retry = 2 seconds
   * 2nd retry = 4 seconds
   * 3rd retry = 8 seconds
   */

  return Math.min(
    1000 *
      Math.pow(
        2,
        currentAttempt
      ),
    30000
  );
}

/* =========================
   HEALTH LOG
========================= */

export async function recordProductionHealth(
  db,
  component,
  status,
  message = "",
  details = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureProductionMonitorTables(
    db
  );

  const result =
    await db.query(
      `
      INSERT INTO production_health_log (
        component,
        status,
        message,
        details,
        checked_at
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        CURRENT_TIMESTAMP
      )

      RETURNING *
      `,
      [
        String(
          component || "unknown"
        ).trim(),

        String(
          status || "unknown"
        ).trim(),

        String(
          message || ""
        ).slice(0, 2000),

        JSON.stringify(
          details || {}
        ),
      ]
    );

  return result.rows[0];
}

/* =========================
   FULL SYSTEM HEALTH
========================= */

export async function getProductionHealth(
  db
) {
  if (!db) {
    return {
      status:
        "critical",

      database:
        "unavailable",

      timestamp:
        new Date().toISOString(),
    };
  }

  try {
    await db.query(
      "SELECT 1"
    );

    await ensureProductionMonitorTables(
      db
    );

    const failedSources =
      await getFailedSources(
        db,
        100
      );

    const criticalSources =
      failedSources.filter(
        (item) =>
          safeNumber(
            item.failure_count
          ) >=
          DEFAULT_MAX_FAILURES
      );

    const warningSources =
      failedSources.filter(
        (item) =>
          safeNumber(
            item.failure_count
          ) >= 3 &&
          safeNumber(
            item.failure_count
          ) <
            DEFAULT_MAX_FAILURES
      );

    let status =
      "healthy";

    if (
      criticalSources.length >
      0
    ) {
      status =
        "critical";
    } else if (
      warningSources.length >
      0
    ) {
      status =
        "warning";
    }

    return {
      status,

      database:
        "connected",

      failedSources:
        failedSources.length,

      warningSources:
        warningSources.length,

      criticalSources:
        criticalSources.length,

      retryEnabled:
        true,

      retryLimit:
        DEFAULT_RETRY_LIMIT,

      sourceFailureTracking:
        true,

      healthMonitoring:
        true,

      timestamp:
        new Date().toISOString(),
    };
  } catch (error) {
    return {
      status:
        "critical",

      database:
        "error",

      error:
        error.message,

      retryEnabled:
        true,

      retryLimit:
        DEFAULT_RETRY_LIMIT,

      sourceFailureTracking:
        true,

      healthMonitoring:
        true,

      timestamp:
        new Date().toISOString(),
    };
  }
}

/* =========================
   STATUS
========================= */

export function getProductionMonitorStatus() {
  return {
    enabled:
      true,

    engine:
      "ZEESHAN NEWS AI Production Monitor",

    retry: {
      enabled:
        true,

      maximumAttempts:
        DEFAULT_RETRY_LIMIT,

      exponentialBackoff:
        true,

      maximumDelayMs:
        30000,
    },

    sourceFailureTracking:
      true,

    sourceHealthMonitoring:
      true,

    databaseHealthCheck:
      true,

    criticalFailureThreshold:
      DEFAULT_MAX_FAILURES,

    artificialTraffic:
      false,

    fakeEngagement:
      false,
  };
}
