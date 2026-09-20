const buckets = new Map();

const DEFAULT_WINDOW_MS =
  60 * 1000;

const DEFAULT_MAX_REQUESTS = 120;

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

function cleanupExpiredBuckets(
  now,
  windowMs
) {
  for (
    const [key, bucket]
    of buckets.entries()
  ) {
    if (
      now - bucket.start >
      windowMs
    ) {
      buckets.delete(key);
    }
  }
}

export function rateLimitMiddleware(
  options = {}
) {
  const windowMs =
    Number(
      options.windowMs
    ) || DEFAULT_WINDOW_MS;

  const maxRequests =
    Number(
      options.maxRequests
    ) || DEFAULT_MAX_REQUESTS;

  return (req, res, next) => {
    try {
      const now =
        Date.now();

      const ip =
        getClientIp(req);

      const key =
        `${ip}:${req.path.startsWith("/api") ? "api" : "web"}`;

      cleanupExpiredBuckets(
        now,
        windowMs
      );

      let bucket =
        buckets.get(key);

      if (!bucket) {
        bucket = {
          start: now,
          count: 0,
        };

        buckets.set(
          key,
          bucket
        );
      }

      if (
        now - bucket.start >=
        windowMs
      ) {
        bucket.start = now;
        bucket.count = 0;
      }

      bucket.count += 1;

      const remaining =
        Math.max(
          maxRequests -
            bucket.count,
          0
        );

      const resetSeconds =
        Math.ceil(
          (
            bucket.start +
            windowMs -
            now
          ) / 1000
        );

      res.setHeader(
        "X-RateLimit-Limit",
        String(maxRequests)
      );

      res.setHeader(
        "X-RateLimit-Remaining",
        String(remaining)
      );

      res.setHeader(
        "X-RateLimit-Reset",
        String(
          Math.max(
            resetSeconds,
            0
          )
        )
      );

      if (
        bucket.count >
        maxRequests
      ) {
        res.setHeader(
          "Retry-After",
          String(
            Math.max(
              resetSeconds,
              1
            )
          )
        );

        return res
          .status(429)
          .json({
            success: false,
            error:
              "Too many requests. Please try again later.",
            retryAfterSeconds:
              Math.max(
                resetSeconds,
                1
              ),
          });
      }

      next();
    } catch (error) {
      console.error(
        "❌ Rate limiter error:",
        error.message
      );

      next(error);
    }
  };
}

export function getRateLimitStatus() {
  return {
    enabled: true,
    type:
      "in-memory-ip-rate-limit",
    defaultWindowSeconds:
      DEFAULT_WINDOW_MS / 1000,
    defaultMaxRequests:
      DEFAULT_MAX_REQUESTS,
    automaticCleanup: true,
  };
}
