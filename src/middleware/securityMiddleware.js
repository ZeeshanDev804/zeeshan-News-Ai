function getClientIp(req) {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {
    return String(forwarded)
      .split(",")[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function isApiRequest(req) {
  return (
    req.path === "/api" ||
    req.path.startsWith("/api/")
  );
}

export function securityMiddleware(
  req,
  res,
  next
) {
  try {
    const isApi = isApiRequest(req);

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "X-Frame-Options",
      "SAMEORIGIN"
    );

    res.setHeader(
      "Referrer-Policy",
      "strict-origin-when-cross-origin"
    );

    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );

    res.setHeader(
      "Cross-Origin-Opener-Policy",
      "same-origin"
    );

    res.setHeader(
      "Cross-Origin-Resource-Policy",
      "same-origin"
    );

    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }

    if (isApi) {
      res.setHeader(
        "Cache-Control",
        "no-store"
      );
    }

    req.securityContext = {
      ip: getClientIp(req),
      userAgent:
        req.headers["user-agent"] ||
        "unknown",
      isApiRequest: isApi,
      timestamp:
        new Date().toISOString(),
    };

    next();
  } catch (error) {
    console.error(
      "❌ Security middleware error:",
      error.message
    );

    next(error);
  }
}

export function securityStatus() {
  return {
    enabled: true,
    headers: [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
    ],
    productionHsts: true,
    apiNoStoreCache: true,
    requestContext: true,
  };
}
