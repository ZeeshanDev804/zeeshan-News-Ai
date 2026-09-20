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
    return String(headerToken).trim();
  }

  return "";
}

export function adminAuthMiddleware(
  req,
  res,
  next
) {
  try {
    const expectedToken =
      process.env.ADMIN_API_TOKEN;

    if (!expectedToken) {
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
      return res.status(401).json({
        success: false,
        error:
          "Unauthorized",
      });
    }

    req.isAdminAuthenticated =
      true;

    next();
  } catch (error) {
    console.error(
      "❌ Admin authentication error:",
      error.message
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
    tokenEnvironmentVariable:
      "ADMIN_API_TOKEN",
    supportedMethods: [
      "Authorization: Bearer <token>",
      "X-Admin-Token: <token>",
    ],
  };
}
