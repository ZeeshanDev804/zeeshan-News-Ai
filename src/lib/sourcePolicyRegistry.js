const DEFAULT_POLICY = {
  attributionRequired: true,
  fullArticleRepublishing: false,
  originalContentRequired: true,
  copyrightReviewRequired: false,
  active: true,
};

const SOURCE_POLICIES = new Map();

function normalizeSource(source) {
  return String(source ?? "")
    .trim()
    .toLowerCase();
}

function createPolicy(source, policy = {}) {
  return {
    source: String(source).trim(),

    attributionRequired:
      policy.attributionRequired ??
      DEFAULT_POLICY.attributionRequired,

    fullArticleRepublishing:
      policy.fullArticleRepublishing ??
      DEFAULT_POLICY.fullArticleRepublishing,

    originalContentRequired:
      policy.originalContentRequired ??
      DEFAULT_POLICY.originalContentRequired,

    copyrightReviewRequired:
      policy.copyrightReviewRequired ??
      DEFAULT_POLICY.copyrightReviewRequired,

    active:
      policy.active ??
      DEFAULT_POLICY.active,

    updatedAt: new Date(),
  };
}


// ========================================
// REGISTER SOURCE POLICY
// ========================================

export function registerSourcePolicy(
  source,
  policy = {}
) {
  const normalized =
    normalizeSource(source);

  if (!normalized) {
    throw new Error(
      "Source name is required"
    );
  }

  const sourcePolicy =
    createPolicy(
      source,
      policy
    );

  SOURCE_POLICIES.set(
    normalized,
    sourcePolicy
  );

  return sourcePolicy;
}


// ========================================
// GET SOURCE POLICY
// ========================================

export function getSourcePolicy(
  source
) {
  const normalized =
    normalizeSource(source);

  if (!normalized) {
    return {
      ...DEFAULT_POLICY,
    };
  }

  return (
    SOURCE_POLICIES.get(
      normalized
    ) || {
      source,
      ...DEFAULT_POLICY,
    }
  );
}


// ========================================
// CHECK SOURCE
// ========================================

export function evaluateSourcePolicy(
  article = {}
) {
  const source =
    String(
      article.source ?? ""
    ).trim();

  const policy =
    getSourcePolicy(
      source
    );

  const reasons = [];

  if (!policy.active) {
    reasons.push(
      "Source is disabled"
    );
  }

  if (
    policy.attributionRequired &&
    !article.source
  ) {
    reasons.push(
      "Source attribution is required"
    );
  }

  if (
    policy.fullArticleRepublishing
  ) {
    reasons.push(
      "Source policy allows full article republishing only when separately verified"
    );
  }

  if (
    policy.originalContentRequired
  ) {
    reasons.push(
      "Published content must be original or meaningfully transformed"
    );
  }

  return {
    source,

    allowed:
      policy.active &&
      reasons.every(
        (reason) =>
          reason !==
          "Source attribution is required"
      ),

    policy,

    reasons,
  };
}


// ========================================
// GET ALL POLICIES
// ========================================

export function getAllSourcePolicies() {
  return Array.from(
    SOURCE_POLICIES.values()
  );
}


// ========================================
// REMOVE SOURCE POLICY
// ========================================

export function removeSourcePolicy(
  source
) {
  const normalized =
    normalizeSource(source);

  if (!normalized) {
    return false;
  }

  return SOURCE_POLICIES.delete(
    normalized
  );
}


// ========================================
// REGISTER DEFAULT SOURCES
// ========================================

registerSourcePolicy(
  "BBC",
  {
    attributionRequired: true,
    fullArticleRepublishing: false,
    originalContentRequired: true,
    copyrightReviewRequired: true,
    active: true,
  }
);

registerSourcePolicy(
  "Al Jazeera",
  {
    attributionRequired: true,
    fullArticleRepublishing: false,
    originalContentRequired: true,
    copyrightReviewRequired: true,
    active: true,
  }
);

registerSourcePolicy(
  "Dawn",
  {
    attributionRequired: true,
    fullArticleRepublishing: false,
    originalContentRequired: true,
    copyrightReviewRequired: true,
    active: true,
  }
);


// ========================================
// EXPORT DEFAULT POLICY
// ========================================

export {
  DEFAULT_POLICY,
};
