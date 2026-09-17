// ========================================
// ZEESHAN NEWS AI — ADMIN AUTH
// ========================================

const ADMIN_API_KEY =
  process.env.ADMIN_API_KEY;


// ========================================
// CHECK CONFIGURATION
// ========================================

export function isAdminAuthConfigured() {
  return Boolean(
    ADMIN_API_KEY &&
    String(
      ADMIN_API_KEY
    ).trim()
  );
}


// ========================================
// VERIFY ADMIN REQUEST
// ========================================

export function verifyAdminRequest(
  req
) {
  if (
    !isAdminAuthConfigured()
  ) {
    return {
      valid: false,

      reason:
        "ADMIN_API_KEY is not configured",
    };
  }


  const authorization =
    String(
      req.headers.authorization ||
        ""
    ).trim();


  const expected =
    `Bearer ${ADMIN_API_KEY}`;


  if (
    authorization !==
    expected
  ) {
    return {
      valid: false,

      reason:
        "Invalid admin authorization",
    };
  }


  return {
    valid: true,
  };
}


// ========================================
// ADMIN MIDDLEWARE
// ========================================

export function requireAdmin(
  req,
  res,
  next
) {
  const verification =
    verifyAdminRequest(
      req
    );


  if (
    !verification.valid
  ) {
    return res.status(401).json({
      success: false,

      error:
        "Unauthorized admin request",
    });
  }


  req.admin =
    true;


  next();
}
