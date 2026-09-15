import { DATABASE_CONFIG } from "../config/database.js";

export function getDatabaseConnection() {
  if (!DATABASE_CONFIG.configured) {
    return {
      status: "NOT_CONFIGURED",
      provider: DATABASE_CONFIG.provider
    };
  }

  return {
    status: "READY",
    provider: DATABASE_CONFIG.provider,
    urlConfigured: true
  };
}

export function checkDatabase() {
  return getDatabaseConnection();
}
