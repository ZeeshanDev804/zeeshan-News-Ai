
import { DATABASE_CONFIG } from "../config/database.js";
import { checkPostgres } from "../config/postgres.js";

export async function checkDatabase() {
  if (!DATABASE_CONFIG.configured) {
    return {
      status: "NOT_CONFIGURED",
      provider: DATABASE_CONFIG.provider
    };
  }

  try {
    const result = await checkPostgres();

    return {
      status: "CONNECTED",
      provider: DATABASE_CONFIG.provider,
      serverTime: result.now
    };
  } catch (error) {
    return {
      status: "ERROR",
      provider: DATABASE_CONFIG.provider,
      message: error.message
    };
  }
}