"use strict";

/*
========================================
ZEESHAN NEWS AI
ADMIN / CEO CONTROL CENTER
========================================

This file provides:
- Admin authentication
- System status
- AutoPilot status/control
- Emergency stop/release
- CEO approval statistics
- Distribution status
- Safe API handling
- Automatic dashboard refresh
*/


/* ========================================
   GLOBAL STATE
======================================== */

let adminToken = "";

let dashboardLoading = false;

let refreshTimer = null;


/* ========================================
   ELEMENT HELPER
======================================== */

function $(id) {
  return document.getElementById(id);
}


/* ========================================
   HTML SAFETY
======================================== */

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* ========================================
   DATE FORMAT
======================================== */

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown time";
  }

  return date.toLocaleString();
}


/* ========================================
   API REQUEST
======================================== */

async function adminFetch(
  endpoint,
  options = {}
) {
  const headers = {
    Accept:
      "application/json",

    ...(options.headers || {}),
  };

  if (adminToken) {
    headers.Authorization =
      `Bearer ${adminToken}`;
  }

  if (
    options.body &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  const response =
    await fetch(
      endpoint,
      {
        ...options,
        headers,
        cache: "no-store",
      }
    );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error =
      new Error(
        data?.error ||
        data?.message ||
        `Request failed: ${response.status}`
      );

    error.status =
      response.status;

    throw error;
  }

  return data;
}


/* ========================================
   CONNECTION STATUS
======================================== */

function setConnectionStatus(
  online,
  text = ""
) {
  const element =
    $("connectionStatus");

  if (!element) {
    return;
  }

  element.className =
    online
      ? "status online"
      : "status offline";

  element.textContent =
    online
      ? "● CONNECTED"
      : (
          text ||
          "● DISCONNECTED"
        );
}


/* ========================================
   AUTH ERROR
======================================== */

function showAuthError(
  message = ""
) {
  const element =
    $("authError");

  if (element) {
    element.textContent =
      String(message);
  }
}


/* ========================================
   SAFE TEXT SETTER
======================================== */

function setText(
  id,
  value
) {
  const element =
    $(id);

  if (!element) {
    return;
  }

  element.textContent =
    String(value ?? "—");
}


/* ========================================
   LOGIN
======================================== */

async function login() {
  const input =
    $("adminKey");

  const key =
    String(
      input?.value || ""
    ).trim();

  showAuthError("");

  if (!key) {
    showAuthError(
      "Admin API Key is required."
    );

    return;
  }

  adminToken = key;

  const button =
    $("loginButton");

  if (button) {
    button.disabled = true;

    button.textContent =
      "CONNECTING...";
  }

  try {
    await verifyAdminAccess();

    $("authSection")
      ?.classList.add(
        "hidden"
      );

    $("dashboard")
      ?.classList.remove(
        "hidden"
      );

    if (input) {
      input.value = "";
    }

    setConnectionStatus(
      true
    );

    await loadDashboard();

  } catch (error) {
    adminToken = "";

    showAuthError(
      error.message ||
      "Admin authentication failed."
    );

    setConnectionStatus(
      false,
      "● ACCESS DENIED"
    );
  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        "ENTER COMMAND CENTER";
    }
  }
}


/* ========================================
   VERIFY ADMIN ACCESS
======================================== */

async function verifyAdminAccess() {
  /*
    Try the protected admin system endpoint
    first when available.
  */

  try {
    return await adminFetch(
      "/api/admin/system-status"
    );
  } catch (error) {

    /*
      A 404 means the endpoint is not mounted
      in the current server configuration.

      Fall back to the protected dashboard.
    */

    if (
      error.status === 404
    ) {
      return await adminFetch(
        "/api/admin/dashboard"
      );
    }

    throw error;
  }
}


/* ========================================
   LOAD DASHBOARD
======================================== */

async function loadDashboard() {
  if (
    dashboardLoading
  ) {
    return;
  }

  dashboardLoading = true;

  try {
    /*
      The current project may expose either
      /api/admin/dashboard or only individual
      status endpoints.
    */

    let dashboardData =
      null;

    try {
      dashboardData =
        await adminFetch(
          "/api/admin/dashboard"
        );
    } catch (error) {
      if (
        error.status !== 404
      ) {
        throw error;
      }
    }

    if (dashboardData) {
      renderDashboard(
        dashboardData
      );
    }

    await Promise.allSettled([
      loadSystemStatus(),
      loadAutoPilotControl(),
      loadApprovalStats(),
      loadDistributionStatus(),
    ]);

    setConnectionStatus(
      true
    );

  } finally {
    dashboardLoading =
      false;
  }
}


/* ========================================
   RENDER DASHBOARD
======================================== */

function renderDashboard(
  data
) {
  const dashboard =
    data?.dashboard || {};

  const overview =
    data?.overview || {};

  const legal =
    data?.legal || {};

  const system =
    data?.system || {};

  setText(
    "totalNews",
    Number(
      overview.totalNews || 0
    )
  );

  setText(
    "legalReviewCount",
    Number(
      legal.reviewQueueCount || 0
    )
  );

  setText(
    "complaintCount",
    Number(
      legal.complaintCount || 0
    )
  );

  setText(
    "auditCount",
    Number(
      legal.auditCount || 0
    )
  );

  renderLatestNews(
    overview.latestNews
  );

  renderTrendingNews(
    overview.trendingNews
  );

  renderLegalQueue(
    legal.reviewQueue
  );

  renderComplaints(
    legal.complaints
  );

  renderAudit(
    legal.recentAudit
  );

  renderCategories(
    overview.categoryCounts
  );

  renderSystem(
    system
  );

  updateSystemBanner(
    dashboard,
    system
  );
}


/* ========================================
   SYSTEM STATUS
======================================== */

async function loadSystemStatus() {
  try {
    const data =
      await adminFetch(
        "/api/system/status"
      );

    const system =
      data?.system || {};

    const features =
      data?.features || {};

    const database =
      system.database ||
      "connected";

    const autoPilot =
      Boolean(
        features.autoPilot
      );

    setText(
      "serverStatus",
      data?.status ||
      "operational"
    );

    setText(
      "databaseStatus",
      String(
        database
      ).toUpperCase()
    );

    setText(
      "autoPilotStatus",
      autoPilot
        ? "ENABLED"
        : "DISABLED"
    );

    renderSystem(
      system
    );

    return data;

  } catch (error) {
    console.error(
      "System status error:",
      error.message
    );

    setText(
      "serverStatus",
      "ERROR"
    );

    setText(
      "databaseStatus",
      "UNKNOWN"
    );

    return null;
  }
}


/* ========================================
   RENDER SYSTEM
======================================== */

function renderSystem(
  system = {}
) {
  const databaseStatus =
    system.database ||
    "unknown";

  const aiConfigured =
    Boolean(
      system.ai?.configured
    );

  const cronConfigured =
    Boolean(
      system.cron?.configured
    );

  const schedulerRunning =
    Boolean(
      system.scheduler?.running
    );

  const killSwitchEnabled =
    Boolean(
      system
        .emergencyKillSwitch
        ?.enabled
    );

  setText(
    "databaseStatus",
    String(
      databaseStatus
    ).toUpperCase()
  );

  setText(
    "aiStatus",
    aiConfigured
      ? "READY"
      : "NOT CONFIGURED"
  );

  setText(
    "cronStatus",
    cronConfigured
      ? "PROTECTED"
      : "NOT CONFIGURED"
  );

  setText(
    "schedulerStatus",
    schedulerRunning
      ? "RUNNING"
      : "STOPPED"
  );

  setText(
    "killSwitchStatus",
    killSwitchEnabled
      ? "ACTIVE"
      : "OFF"
  );

  setText(
    "adminAuthStatus",
    "PROTECTED"
  );

  setText(
    "emergencyStatus",
    killSwitchEnabled
      ? "ACTIVE"
      : "OFF"
  );
}


/* ========================================
   SYSTEM BANNER
======================================== */

function updateSystemBanner(
  dashboard = {},
  system = {}
) {
  const element =
    $("systemBannerText");

  if (!element) {
    return;
  }

  const killSwitch =
    Boolean(
      system
        ?.emergencyKillSwitch
        ?.enabled
    );

  if (killSwitch) {
    element.textContent =
      "EMERGENCY PUBLICATION BLOCK IS ACTIVE";

    return;
  }

  element.textContent =
    `${dashboard?.platform || "ZEESHAN NEWS AI"} — ` +
    `${dashboard?.role || "Founder & CEO"} control center operational`;
}


/* ========================================
   LATEST NEWS
======================================== */

function renderLatestNews