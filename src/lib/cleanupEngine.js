function normalizePositiveInteger(
  value,
  fallback
) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1
  ) {
    return fallback;
  }

  return number;
}

export async function cleanupOldArticles(
  db,
  options = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const retentionDays =
    normalizePositiveInteger(
      options.retentionDays,
      90
    );

  const maxDelete =
    normalizePositiveInteger(
      options.maxDelete,
      500
    );

  const result =
    await db.query(
      `
      DELETE FROM articles
      WHERE
        created_at <
        CURRENT_TIMESTAMP
        - ($1 * INTERVAL '1 day')
      AND
        legal_hold = FALSE
      AND
        takedown_status = 'none'
      AND
        id IN (
          SELECT id
          FROM articles
          WHERE
            created_at <
            CURRENT_TIMESTAMP
            - ($1 * INTERVAL '1 day')
          AND
            legal_hold = FALSE
          AND
            takedown_status = 'none'
          ORDER BY
            created_at ASC
          LIMIT $2
      )
      RETURNING id
      `,
      [
        retentionDays,
        maxDelete,
      ]
    );

  return {
    success: true,

    retentionDays,

    deleted:
      result.rowCount,

    deletedIds:
      result.rows.map(
        (row) => row.id
      ),
  };
}

export async function getCleanupPreview(
  db,
  options = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const retentionDays =
    normalizePositiveInteger(
      options.retentionDays,
      90
    );

  const result =
    await db.query(
      `
      SELECT
        COUNT(*)::INTEGER AS eligible_count
      FROM articles
      WHERE
        created_at <
        CURRENT_TIMESTAMP
        - ($1 * INTERVAL '1 day')
      AND
        legal_hold = FALSE
      AND
        takedown_status = 'none'
      `,
      [
        retentionDays,
      ]
    );

  return {
    success: true,

    retentionDays,

    eligibleCount:
      result.rows[0]
        ?.eligible_count || 0,
  };
}

export function getCleanupPolicy() {
  return {
    retentionDays: 90,

    maxDeletePerRun: 500,

    protectedStatuses: [
      "legal_hold",
      "takedown",
    ],
  };
}
