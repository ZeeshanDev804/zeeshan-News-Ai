/* =========================
   CRON SECURITY
========================= */

function getCronSecret(req) {
  const authorization =
    req.headers.authorization;

  if (
    authorization &&
    authorization.startsWith("Bearer ")
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  const headerSecret =
    req.headers["x-cron-secret"];

  if (headerSecret) {
    return String(
      headerSecret
    ).trim();
  }

  return "";
}

/* =========================
   VERIFY CRON REQUEST
========================= */

export function verifyCronRequest(req) {
  const expectedSecret =
    String(
      process.env.CRON_SECRET || ""
    ).trim();

  /*
   * Cron security must be configured
   * before production automation runs.
   */

  if (!expectedSecret) {
    console.error(
      "❌ CRON_SECRET is not configured"
    );

    return false;
  }

  const providedSecret =
    getCronSecret(req);

  if (!providedSecret) {
    console.warn(
      "⚠️ Cron request rejected: missing secret"
    );

    return false;
  }

  if (
    providedSecret !==
    expectedSecret
  ) {
    console.warn(
      "⚠️ Cron request rejected: invalid secret"
    );

    return false;
  }

  return true;
}

/* =========================
   CRON SECURITY STATUS
========================= */

export function getCronSecurityStatus() {
  const configured =
    Boolean(
      String(
        process.env.CRON_SECRET || ""
      ).trim()
    );

  return {
    enabled: true,

    configured,

    environmentVariable:
      "CRON_SECRET",

    supportedMethods: [
      "Authorization: Bearer <CRON_SECRET>",
      "X-Cron-Secret: <CRON_SECRET>",
    ],

    productionRequired:
      true,

    secretHardcoded:
      false,
  };
}