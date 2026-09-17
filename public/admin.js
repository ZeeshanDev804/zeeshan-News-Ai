// ========================================
// ZEESHAN NEWS AI
// ADMIN / CEO DASHBOARD
// ========================================

let adminToken = "";

let dashboardLoading = false;


// ========================================
// ELEMENT HELPER
// ========================================

function $(id) {
  return document.getElementById(id);
}


// ========================================
// HTML SAFETY
// ========================================

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ========================================
// DATE FORMAT
// ========================================

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown time";
  }

  return date.toLocaleString();
}


// ========================================
// API REQUEST
// ========================================

async function adminFetch(
  endpoint,
  options = {}
) {
  const headers = {
    ...(options.headers || {}),
    Authorization:
      `Bearer ${adminToken}`,
  };

  const response =
    await fetch(
      endpoint,
      {
        ...options,
        headers,
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
    throw new Error(
      data?.error ||
      `Request failed: ${response.status}`
    );
  }

  return data;
}


// ========================================
// CONNECTION STATUS
// ========================================

function setConnectionStatus(
  online,
  text = ""
) {
  const element =
    $("connectionStatus");

  if (!element) {
    return;
  }

  if (online) {
    element.className =
      "status online";

    element.textContent =
      "● CONNECTED";
  } else {
    element.className =
      "status offline";

    element.textContent =
      text ||
      "● DISCONNECTED";
  }
}


// ========================================
// AUTH ERROR
// ========================================

function showAuthError(
  message
) {
  const element =
    $("authError");

  if (element) {
    element.textContent =
      message || "";
  }
}


// ========================================
// LOGIN
// ========================================

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
    await loadDashboard();

    $("authSection")
      ?.classList.add(
        "hidden"
      );

    $("dashboard")
      ?.classList.remove(
        "hidden"
      );

    input.value = "";

    setConnectionStatus(
      true
    );

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


// ========================================
// LOAD FULL DASHBOARD
// ========================================

async function loadDashboard() {
  if (
    dashboardLoading
  ) {
    return;
  }

  dashboardLoading = true;

  try {
    const data =
      await adminFetch(
        "/api/admin/dashboard"
      );

    renderDashboard(
      data
    );

    setConnectionStatus(
      true
    );
  } finally {
    dashboardLoading =
      false;
  }
}


// ========================================
// RENDER DASHBOARD
// ========================================

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

  $("totalNews")
    .textContent =
    Number(
      overview.totalNews || 0
    );

  $("legalReviewCount")
    .textContent =
    Number(
      legal.reviewQueueCount ||
        0
    );

  $("complaintCount")
    .textContent =
    Number(
      legal.complaintCount ||
        0
    );

  $("auditCount")
    .textContent =
    Number(
      legal.auditCount ||
        0
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


// ========================================
// SYSTEM STATUS
// ========================================

function renderSystem(
  system
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

  $("databaseStatus")
    .textContent =
    String(
      databaseStatus
    ).toUpperCase();

  $("aiStatus")
    .textContent =
    aiConfigured
      ? "READY"
      : "NOT CONFIGURED";

  $("cronStatus")
    .textContent =
    cronConfigured
      ? "PROTECTED"
      : "NOT CONFIGURED";

  $("schedulerStatus")
    .textContent =
    schedulerRunning
      ? "RUNNING"
      : "STOPPED";

  $("killSwitchStatus")
    .textContent =
    killSwitchEnabled
      ? "ACTIVE"
      : "OFF";

  $("adminAuthStatus")
    .textContent =
    "PROTECTED";
}


// ========================================
// SYSTEM BANNER
// ========================================

function updateSystemBanner(
  dashboard,
  system
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


// ========================================
// LATEST NEWS
// ========================================

function renderLatestNews(
  news = []
) {
  const container =
    $("latestNews");

  if (!container) {
    return;
  }

  if (
    !Array.isArray(news) ||
    news.length === 0
  ) {
    container.innerHTML =
      `<div class="empty-state">
        No latest news
