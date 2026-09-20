import crypto from "crypto";

export function generateAdminToken(
  length = 48
) {
  const safeLength =
    Math.min(
      Math.max(
        Number(length) || 48,
        32
      ),
      128
    );

  return crypto
    .randomBytes(safeLength)
    .toString("hex");
}

export function isAdminTokenConfigured() {
  return Boolean(
    String(
      process.env.ADMIN_API_TOKEN || ""
    ).trim()
  );
}

export function getAdminSecurityStatus() {
  return {
    enabled: true,

    tokenConfigured:
      isAdminTokenConfigured(),

    environmentVariable:
      "ADMIN_API_TOKEN",

    minimumRecommendedBytes:
      32,

    tokenStoredInEnvironment:
      true,

    hardcodedToken:
      false,
  };
}
