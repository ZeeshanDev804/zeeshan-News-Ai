const DEFAULT_POLICY = {
  enabled: true,
  attributionRequired: true,
  allowFullSourceContent: false,
  allowAiSummary: true,
  copyrightRisk: "medium",
  autoHoldOnComplaint: true,
};

function normalizeValue(
  value,
  fallback = ""
) {
  return String(
    value ?? fallback
  ).trim();
}

function normalizeBoolean(
  value,
  fallback
) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function normalizeRisk(
  value
) {
  const risk =
    normalizeValue(
      value,
      DEFAULT_POLICY.copyrightRisk
    ).toLowerCase();

  if (
    ["low", "medium", "high"].includes(
      risk
    )
  ) {
    return risk;
  }

  return DEFAULT_POLICY.copyrightRisk;
}

export function getDefaultSourcePolicy() {
  return {
    ...DEFAULT_POLICY,
  };
}

export function normalizeSourcePolicy(
  policy = {}
) {
  return {
    enabled:
      normalizeBoolean(
        policy.enabled,
        DEFAULT_POLICY.enabled
      ),

    attributionRequired:
      normalizeBoolean(
        policy.attributionRequired,
        DEFAULT_POLICY.attributionRequired
      ),

    allowFullSourceContent:
      normalizeBoolean(
        policy.allowFullSourceContent,
        DEFAULT_POLICY.allowFullSourceContent
      ),

    allowAiSummary:
      normalizeBoolean(
        policy.allowAiSummary,
        DEFAULT_POLICY.allowAiSummary
      ),

    copyrightRisk:
      normalizeRisk(
        policy.copyrightRisk
      ),

    autoHoldOnComplaint:
      normalizeBoolean(
        policy.autoHoldOnComplaint,
        DEFAULT_POLICY.autoHoldOnComplaint
      ),
  };
}

export async function ensureSourcePolicyTable(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS source_policies (
      id SERIAL PRIMARY KEY,

      source_name TEXT NOT NULL UNIQUE,

      source_url TEXT,

      enabled BOOLEAN DEFAULT TRUE,

      attribution_required BOOLEAN DEFAULT TRUE,

      allow_full_source_content BOOLEAN DEFAULT FALSE,

      allow_ai_summary BOOLEAN DEFAULT TRUE,

      copyright_risk TEXT DEFAULT 'medium',

      auto_hold_on_complaint BOOLEAN DEFAULT TRUE,

      notes TEXT,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_source_policies_enabled
      ON source_policies(enabled)
  `);

  return {
    success: true,
  };
}

export async function getSourcePolicy(
  db,
  sourceName
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const name =
    normalizeValue(
      sourceName
    );

  if (!name) {
    throw new Error(
      "Source name is required"
    );
  }

  await ensureSourcePolicyTable(
    db
  );

  const result =
    await db.query(
      `
      SELECT
        *
      FROM source_policies
      WHERE source_name = $1
      LIMIT 1
      `,
      [name]
    );

  if (
    result.rows.length === 0
  ) {
    return {
      source_name: name,
      ...getDefaultSourcePolicy(),
    };
  }

  return {
    ...result.rows[0],
    ...normalizeSourcePolicy(
      result.rows[0]
    ),
  };
}

export async function saveSourcePolicy(
  db,
  sourceName,
  sourceUrl = "",
  policy = {},
  notes = ""
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const name =
    normalizeValue(
      sourceName
    );

  if (!name) {
    throw new Error(
      "Source name is required"
    );
  }

  const normalized =
    normalizeSourcePolicy(
      policy
    );

  await ensureSourcePolicyTable(
    db
  );

  const result =
    await db.query(
      `
      INSERT INTO source_policies
        (
          source_name,
          source_url,
          enabled,
          attribution_required,
          allow_full_source_content,
          allow_ai_summary,
          copyright_risk,
          auto_hold_on_complaint,
          notes,
          updated_at
        )
      VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          CURRENT_TIMESTAMP
        )

      ON CONFLICT (source_name)
      DO UPDATE SET
        source_url = EXCLUDED.source_url,
        enabled = EXCLUDED.enabled,
        attribution_required =
          EXCLUDED.attribution_required,
        allow_full_source_content =
          EXCLUDED.allow_full_source_content,
        allow_ai_summary =
          EXCLUDED.allow_ai_summary,
        copyright_risk =
          EXCLUDED.copyright_risk,
        auto_hold_on_complaint =
          EXCLUDED.auto_hold_on_complaint,
        notes = EXCLUDED.notes,
        updated_at =
          CURRENT_TIMESTAMP

      RETURNING *
      `,
      [
        name,
        normalizeValue(
          sourceUrl
        ),
        normalized.enabled,
        normalized.attributionRequired,
        normalized.allowFullSourceContent,
        normalized.allowAiSummary,
        normalized.copyrightRisk,
        normalized.autoHoldOnComplaint,
        normalizeValue(notes),
      ]
    );

  return result.rows[0];
}

export async function getAllSourcePolicies(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureSourcePolicyTable(
    db
  );

  const result =
    await db.query(`
      SELECT
        *
      FROM source_policies
      ORDER BY
        source_name ASC
    `);

  return result.rows;
}

export async function isSourceAllowed(
  db,
  sourceName
) {
  const policy =
    await getSourcePolicy(
      db,
      sourceName
    );

  return {
    allowed:
      policy.enabled === true,

    policy,
  };
}
