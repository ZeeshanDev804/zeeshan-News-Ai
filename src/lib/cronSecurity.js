const CRON_SECRET =
  process.env.CRON_SECRET;


// ========================================
// CHECK CRON CONFIGURATION
// ========================================

export function isCronConfigured() {
  return Boolean(
    CRON_SECRET &&
    String(CRON_SECRET).trim()
  );
}


// ========================================
// VERIFY CRON REQUEST
// ========================================

export function verifyCronRequest(
  req
) {
  if (!isCronConfigured()) {
    return {
      valid: false,
      reason:
        "CRON_SECRET is not configured",
    };
  }


  const authorization =
    String(
      req.headers.authorization ||
        ""
    ).trim();


  const expected =
    `Bearer ${CRON_SECRET}`;


  if (
    authorization !== expected
  ) {
    return {
      valid: false,
      reason:
        "Invalid cron authorization",
    };
  }


  return {
    valid: true,
  };
}
