"use strict";

/*
========================================
ZEESHAN NEWS AI
RETRY ENGINE
========================================

Purpose:
- Retry failed operations safely
- Exponential backoff
- Maximum retry limit
- Optional custom retry conditions
- No infinite retry loops
========================================
*/


/* ========================================
   DEFAULT CONFIG
======================================== */

const DEFAULT_MAX_RETRIES = 3;

const DEFAULT_BASE_DELAY = 1000;

const DEFAULT_MAX_DELAY = 30000;


/* ========================================
   SLEEP
======================================== */

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


/* ========================================
   CALCULATE DELAY
======================================== */

function calculateRetryDelay(
  attempt,
  baseDelay = DEFAULT_BASE_DELAY,
  maxDelay = DEFAULT_MAX_DELAY
) {
  const safeAttempt =
    Math.max(
      0,
      Number(attempt) || 0
    );

  const safeBaseDelay =
    Math.max(
      0,
      Number(baseDelay) ||
        DEFAULT_BASE_DELAY
    );

  const safeMaxDelay =
    Math.max(
      safeBaseDelay,
      Number(maxDelay) ||
        DEFAULT_MAX_DELAY
    );

  /*
    Exponential backoff:

    attempt 0 → base
    attempt 1 → base × 2
    attempt 2 → base × 4
    attempt 3 → base × 8
  */

  const delay =
    safeBaseDelay *
    Math.pow(
      2,
      safeAttempt
    );

  return Math.min(
    delay,
    safeMaxDelay
  );
}


/* ========================================
   DEFAULT RETRY CONDITION
======================================== */

function shouldRetryError(
  error
) {
  if (!error) {
    return true;
  }

  /*
    Explicitly non-retryable errors.
  */

  if (
    error.retryable ===
    false
  ) {
    return false;
  }

  const status =
    Number(
      error.status ||
      error.statusCode ||
      error.response?.status
    );

  /*
    Client errors normally should not
    be retried.
  */

  if (
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  ) {
    return false;
  }

  /*
    Rate limit / timeout / server errors
    can normally be retried.
  */

  if (
    status === 408 ||
    status === 429 ||
    status >= 500
  ) {
    return true;
  }

  /*
    Network-style errors.
  */

  const code =
    String(
      error.code || ""
    ).toUpperCase();

  const retryableCodes = [
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
  ];

  if (
    retryableCodes.includes(
      code
    )
  ) {
    return true;
  }

  /*
    If there is no HTTP status or known
    non-retryable condition, retry once
    according to the configured limit.
  */

  return true;
}


/* ========================================
   RETRY OPERATION
======================================== */

async function retryOperation(
  operation,
  options = {}
) {
  if (
    typeof operation !==
    "function"
  ) {
    throw new TypeError(
      "retryOperation requires a function."
    );
  }

  const maxRetries =
    Math.max(
      0,
      Number(
        options.maxRetries ??
        DEFAULT_MAX_RETRIES
      )
    );

  const baseDelay =
    Math.max(
      0,
      Number(
        options.baseDelay ??
        DEFAULT_BASE_DELAY
      )
    );

  const maxDelay =
    Math.max(
      baseDelay,
      Number(
        options.maxDelay ??
        DEFAULT_MAX_DELAY
      )
    );

  const retryCondition =
    typeof options.shouldRetry ===
    "function"
      ? options.shouldRetry
      : shouldRetryError;

  const onRetry =
    typeof options.onRetry ===
    "function"
      ? options.onRetry
      : null;

  let lastError = null;


  /*
    Total attempts =
    initial attempt + maxRetries
  */

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      const result =
        await operation(
          attempt
        );

      return result;

    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(
              String(error)
            );


      /*
        No more retries.
      */

      if (
        attempt >=
        maxRetries
      ) {
        break;
      }


      /*
        Check whether this error
        should actually be retried.
      */

      let canRetry =
        false;

      try {
        canRetry =
          await retryCondition(
            lastError,
            attempt
          );
      } catch {
        canRetry =
          false;
      }

      if (!canRetry) {
        break;
      }


      const delay =
        calculateRetryDelay(
          attempt,
          baseDelay,
          maxDelay
        );


      /*
        Notify caller before retry.
      */

      if (onRetry) {
        try {
          await onRetry({
            error:
              lastError,

            attempt,

            nextAttempt:
              attempt + 1,

            delay,

            maxRetries,
          });
        } catch (callbackError) {
          console.warn(
            "Retry onRetry callback failed:",
            callbackError?.message ||
              callbackError
          );
        }
      }


      await sleep(
        delay
      );
    }
  }


  /*
    Preserve original error
    information.
  */

  throw lastError ||
    new Error(
      "Operation failed after retries."
    );
}


/* ========================================
   RETRY WITH JITTER
======================================== */

function calculateJitterDelay(
  attempt,
  options = {}
) {
  const baseDelay =
    Number(
      options.baseDelay ??
      DEFAULT_BASE_DELAY
    );

  const maxDelay =
    Number(
      options.maxDelay ??
      DEFAULT_MAX_DELAY
    );

  const calculated =
    calculateRetryDelay(
      attempt,
      baseDelay,
      maxDelay
    );

  /*
    Add 0–25% random jitter.
    This helps prevent many workers
    retrying at exactly the same time.
  */

  const jitter =
    Math.random() *
    calculated *
    0.25;

  return Math.min(
    maxDelay,
    Math.round(
      calculated + jitter
    )
  );
}


/* ========================================
   RETRY WITH JITTER
======================================== */

async function retryOperationWithJitter(
  operation,
  options = {}
) {
  if (
    typeof operation !==
    "function"
  ) {
    throw new TypeError(
      "retryOperationWithJitter requires a function."
    );
  }

  const maxRetries =
    Math.max(
      0,
      Number(
        options.maxRetries ??
        DEFAULT_MAX_RETRIES
      )
    );

  const baseDelay =
    Math.max(
      0,
      Number(
        options.baseDelay ??
        DEFAULT_BASE_DELAY
      )
    );

  const maxDelay =
    Math.max(
      baseDelay,
      Number(
        options.maxDelay ??
        DEFAULT_MAX_DELAY
      )
    );

  const retryCondition =
    typeof options.shouldRetry ===
    "function"
      ? options.shouldRetry
      : shouldRetryError;

  const onRetry =
    typeof options.onRetry ===
    "function"
      ? options.onRetry
      : null;

  let lastError = null;


  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      return await operation(
        attempt
      );

    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(
              String(error)
            );

      if (
        attempt >=
        maxRetries
      ) {
        break;
      }

      let canRetry =
        false;

      try {
        canRetry =
          await retryCondition(
            lastError,
            attempt
          );
      } catch {
        canRetry =
          false;
      }

      if (!canRetry) {
        break;
      }

      const delay =
        calculateJitterDelay(
          attempt,
          {
            baseDelay,
            maxDelay,
          }
        );

      if (onRetry) {
        try {
          await onRetry({
            error:
              lastError,

            attempt,

            nextAttempt:
              attempt + 1,

            delay,

            maxRetries,
          });
        } catch (callbackError) {
          console.warn(
            "Retry callback failed:",
            callbackError?.message ||
              callbackError
          );
        }
      }

      await sleep(
        delay
      );
    }
  }

  throw lastError ||
    new Error(
      "Operation failed after retries."
    );
}


/* ========================================
   SIMPLE RETRY WRAPPER
======================================== */

async function withRetry(
  operation,
  maxRetries = DEFAULT_MAX_RETRIES,
  baseDelay = DEFAULT_BASE_DELAY
) {
  return retryOperation(
    operation,
    {
      maxRetries,
      baseDelay,
    }
  );
}


/* ========================================
   RETRY ENGINE OBJECT
======================================== */

const retryEngine = {
  retryOperation,

  retryOperationWithJitter,

  withRetry,

  calculateRetryDelay,

  calculateJitterDelay,

  shouldRetryError,

  sleep,
};


/* ========================================
   EXPORTS
======================================== */

export {
  retryOperation,

  retryOperationWithJitter,

  withRetry,

  calculateRetryDelay,

  calculateJitterDelay,

  shouldRetryError,

  sleep,
};

export default retryEngine;