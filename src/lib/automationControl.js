const DEFAULT_STATE = {
  enabled: true,
  emergencyStop: false,
  reason: "",
  updatedBy: "system",
};

function validateDb(db) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }
}

function safeText(
  value,
  maxLength = 2000
) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/* =========================
   ENSURE CONTROL TABLE
========================= */

export async function ensureAutomationControlTable(
  db
) {
  validateDb(db);

  await db.query(`
    CREATE TABLE IF NOT EXISTS automation_control (
      id INTEGER PRIMARY KEY DEFAULT 1,

      enabled BOOLEAN NOT NULL DEFAULT TRUE,

      emergency_stop BOOLEAN NOT NULL DEFAULT FALSE,

      reason TEXT NOT NULL DEFAULT '',

      updated_by TEXT NOT NULL DEFAULT 'system',

      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT automation_control_single_row
        CHECK (id = 1)
    )
  `);

  await db.query(`
    INSERT INTO automation_control (
      id,
      enabled,
      emergency_stop,
      reason,
      updated_by
    )
    VALUES (
      1,
      TRUE,
      FALSE,
      '',
      'system'
    )
    ON CONFLICT (id)
    DO NOTHING
  `);

  return {
    success: true,
  };
}

/* =========================
   GET CONTROL STATE
========================= */

export async function getAutomationControl(
  db
) {
  validateDb(db);

  await ensureAutomationControlTable(
    db
  );

  const result =
    await db.query(`
      SELECT
        id,
        enabled,
        emergency_stop,
        reason,
        updated_by,
        updated_at,
        created_at
      FROM automation_control
      WHERE id = 1
      LIMIT 1
    `);

  if (
    result.rows.length === 0
  ) {
    return {
      success: true,
      ...DEFAULT_STATE,
    };
  }

  const row =
    result.rows[0];

  return {
    success: true,

    enabled:
      row.enabled === true,

    emergencyStop:
      row.emergency_stop === true,

    reason:
      safeText(
        row.reason,
        2000
      ),

    updatedBy:
      safeText(
        row.updated_by,
        200
      ),

    updatedAt:
      row.updated_at,

    createdAt:
      row.created_at,
  };
}

/* =========================
   CHECK IF AUTOMATION MAY RUN
========================= */

export async function isAutomationAllowed(
  db
) {
  const state =
    await getAutomationControl(
      db
    );

  return (
    state.enabled === true &&
    state.emergencyStop !== true
  );
}

/* =========================
   ENABLE AUTO-PILOT
========================= */

export async function enableAutomation(
  db,
  updatedBy = "CEO"
) {
  validateDb(db);

  await ensureAutomationControlTable(
    db
  );

  const actor =
    safeText(
      updatedBy,
      200
    ) || "CEO";

  const result =
    await db.query(
      `
      UPDATE automation_control
      SET
        enabled = TRUE,

        emergency_stop = FALSE,

        reason = '',

        updated_by = $1,

        updated_at = CURRENT_TIMESTAMP

      WHERE id = 1

      RETURNING *
      `,
      [actor]
    );

  return {
    success: true,

    action:
      "automation_enabled",

    state:
      result.rows[0] || null,
  };
}

/* =========================
   DISABLE AUTO-PILOT
========================= */

export async function disableAutomation(
  db,
  reason = "Automation disabled by CEO",
  updatedBy = "CEO"
) {
  validateDb(db);

  await ensureAutomationControlTable(
    db
  );

  const safeReason =
    safeText(
      reason,
      2000
    ) ||
    "Automation disabled by CEO";

  const actor =
    safeText(
      updatedBy,
      200
    ) || "CEO";

  const result =
    await db.query(
      `
      UPDATE automation_control
      SET
        enabled = FALSE,

        reason = $1,

        updated_by = $2,

        updated_at = CURRENT_TIMESTAMP

      WHERE id = 1

      RETURNING *
      `,
      [
        safeReason,
        actor,
      ]
    );

  return {
    success: true,

    action:
      "automation_disabled",

    state:
      result.rows[0] || null,
  };
}

/* =========================
   EMERGENCY STOP
========================= */

export async function activateEmergencyStop(
  db,
  reason = "Emergency stop activated",
  updatedBy = "CEO"
) {
  validateDb(db);

  await ensureAutomationControlTable(
    db
  );

  const safeReason =
    safeText(
      reason,
      2000
    ) ||
    "Emergency stop activated";

  const actor =
    safeText(
      updatedBy,
      200
    ) || "CEO";

  const result =
    await db.query(
      `
      UPDATE automation_control
      SET
        enabled = FALSE,

        emergency_stop = TRUE,

        reason = $1,

        updated_by = $2,

        updated_at = CURRENT_TIMESTAMP

      WHERE id = 1

      RETURNING *
      `,
      [
        safeReason,
        actor,
      ]
    );

  return {
    success: true,

    action:
      "emergency_stop_activated",

    state:
      result.rows[0] || null,
  };
}

/* =========================
   CLEAR EMERGENCY STOP
========================= */

export async function clearEmergencyStop(
  db,
  updatedBy = "CEO"
) {
  validateDb(db);

  await ensureAutomationControlTable(
    db
  );

  const actor =
    safeText(
      updatedBy,
      200
    ) || "CEO";

  const result =
    await db.query(
      `
      UPDATE automation_control
      SET
        enabled = TRUE,

        emergency_stop = FALSE,

        reason = '',

        updated_by = $1,

        updated_at = CURRENT_TIMESTAMP

      WHERE id = 1

      RETURNING *
      `,
      [actor]
    );

  return {
    success: true,

    action:
      "emergency_stop_cleared",

    state:
      result.rows[0] || null,
  };
}

/* =========================
   SAFE AUTOMATION GUARD
========================= */

export async function assertAutomationAllowed(
  db
) {
  const allowed =
    await isAutomationAllowed(
      db
    );

  if (!allowed) {
    const state =
      await getAutomationControl(
        db
      );

    const reason =
      state.reason ||
      "Automation is currently disabled";

    throw new Error(
      `AUTOMATION_STOPPED: ${reason}`
    );
  }

  return true;
}

/* =========================
   STATUS
========================= */

export function getAutomationControlStatus() {
  return {
    enabled: true,

    component:
      "ZEESHAN NEWS AI Automation Control",

    autoPilotControl:
      true,

    emergencyStop:
      true,

    ceoEnableDisable:
      true,

    databasePersistence:
      true,

    safeExecutionGuard:
      true,

    defaultEnabled:
      true,

    fakeTraffic:
      false,

    fakeEngagement:
      false,
  };
}
