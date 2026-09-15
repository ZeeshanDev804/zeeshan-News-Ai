export const DATABASE_CONFIG = {
  provider: process.env.DATABASE_PROVIDER || "POSTGRESQL",
  url: process.env.DATABASE_URL || null,
  configured: Boolean(process.env.DATABASE_URL)
};

export function getDatabaseStatus() {
  return {
    provider: DATABASE_CONFIG.provider,
    configured: DATABASE_CONFIG.configured,
    status: DATABASE_CONFIG.configured
      ? "READY"
      : "NOT_CONFIGURED"
  };
}
