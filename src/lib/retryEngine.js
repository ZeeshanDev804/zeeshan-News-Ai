function normalizeValue(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizePositiveInteger(
  value,
  fallback
) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1
  ) {
    return fallback;
  }

  return number;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRetry(
  operation,
  options = {}
) {
  if (
    typeof operation !== "function"
  ) {
    throw new Error(
      "Retry operation must be a function"
    );
  }

  const maxAttempts =
    normalizePositiveInteger(
      options.maxAttempts,
      3
    );

  const baseDelayMs =
    normalizePositiveInteger(
      options.baseDelayMs,
      1000
    );

  const maxDelayMs =
    normalizePositiveInteger(
      options.maxDelayMs,
      10000
    );

  const label =
    normalizeValue(
      options.label,
      "Operation"
    );

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      const result =
        await operation(
          attempt
        );

      return {
        success: true,
        result,
        attempts: attempt,
      };

    } catch (error) {
      lastError = error;

      console.error(
        `⚠️ ${label} failed on attempt ${attempt}/${maxAttempts}:`,
        error?.message || error
      );

      if (
        attempt >= maxAttempts
      ) {
        break;
      }

      const exponentialDelay =
        baseDelayMs *
        Math.pow(
          2,
          attempt - 1
        );

      const delay =
        Math.min(
          exponentialDelay,
          maxDelayMs
        );

      console.log(
        `🔁 ${label} retrying in ${delay}ms...`
      );

      await wait(delay);
    }
  }

  return {
    success: false,
    result: null,
    attempts: maxAttempts,
    error:
      lastError?.message ||
      "Operation failed after retries",
  };
}

export async function retryOrThrow(
  operation,
  options = {}
) {
  const result =
    await withRetry(
      operation,
      options
    );

  if (!result.success) {
    throw new Error(
      result.error ||
        "Operation failed after retries"
    );
  }

  return result.result;
}

export function getRetryConfig() {
  return {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDe
