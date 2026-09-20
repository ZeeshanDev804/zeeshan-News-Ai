import {
  recordAdminAudit,
} from "../lib/adminAuditLog.js";

function getAdminToken(req) {
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

  const headerToken =
    req.headers["x-admin-token"];

  if (headerToken) {
    return String(
      headerToken
    ).trim();
  }

  return "";
}

async function writeAudit(
  req,
  action,
  success,
  details = {}
) {
  try {
    const db =
      req.app.locals.db;

    if (!db) {
      return;
    }

    await recordAdminAudit(
      db,
      req,
      {
        action,
        success,
        details,
      }
    );
  } catch (error) {
    console.error(
      "⚠️ Admin audit log error:",
      error.message
    );
  }
}

export async function adminAuthMiddleware(
  req,
  res,
  next
) {
  try {
    const expectedToken =
      process.env.ADMIN_API_TOKEN;

    if (!expectedToken) {
      await writeAudit(
        req,
        "admin_auth_not_configured",
        false,
        {
          reason:
            "ADMIN_API_TOKEN is missing",
        }
      );

      console.error(
        "❌ ADMIN_API_TOKEN is not configured"
      );

      return res.status(503).json({
        success: false,
        error:
          "Admin authentication is not configured",
      });
    }

    const providedToken =
      getAdminToken(req);

    if (
      !providedToken ||
      providedToken !== expectedToken
    ) {
      await writeAudit(
        req,
        "admin_auth_failed",
        false,
        {
          reason:
            providedToken
              ? "Invalid admin token"
              : "Missing admin token",
        }
      );

      return res.status(401).json({
        success: false,
        error:
          "Unauthorized",
      });
    }

    req.isAdminAuthenticated =
      true;

    await writeAudit(
      req,
      "admin_auth_success",
      true
    );

    next();
  } catch (error) {
    console.error(
      "❌ Admin authentication error:",
      error.message
    );

    await writeAudit(
      req,
      "admin_auth_error",
      false,
      {
        reason:
          "Authentication middleware error",
      }
    );

    return res.status(500).json({
      success: false,
      error:
        "Authentication error",
    });
  }
}

export function adminAuthStatus() {
  return {
    enabled: true,

    tokenConfigured:
      Boolean(
        String(
          process.env.ADMIN_API_TOKEN ||
            ""
        ).trim()
      ),

    tokenEnvironmentVariable:
      "ADMIN_API_TOKEN",

    supportedMethods: [
      "Authorization: Bearer <token>",
      "X-Admin-Token: <token>",
    ],

    auditLogging:
      "enabled",
  };
}