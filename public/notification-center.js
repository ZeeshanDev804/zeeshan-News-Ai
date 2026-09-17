// ========================================
// ZEESHAN NEWS AI — NOTIFICATION CENTER
// ========================================

(function () {
  "use strict";

  const manager =
    window.ZeeshanNotifications;

  if (!manager) {
    console.warn(
      "ZEESHAN Notification Manager is not available."
    );

    return;
  }

  // ========================================
  // CREATE PANEL
  // ========================================

  function createNotificationCenter() {
    if (
      document.getElementById(
        "zeeshan-notification-center"
      )
    ) {
      return;
    }

    const panel =
      document.createElement(
        "section"
      );

    panel.id =
      "zeeshan-notification-center";

    panel.className =
      "notification-center";

    panel.innerHTML = `
      <div class="notification-center-header">
        <div>
          <span class="notification-kicker">
            NOTIFICATIONS
          </span>

          <h2>
            News Alerts
          </h2>

          <p>
            Choose which ZEESHAN NEWS AI
            updates you want to receive.
          </p>
        </div>

        <span
          id="notification-status"
          class="notification-status"
        >
          Checking...
        </span>
      </div>

      <div class="notification-actions">

        <button
          type="button"
          id="notification-enable"
          class="notification-btn notification-btn-primary"
        >
          🔔 Enable Notifications
        </button>

        <button
          type="button"
          id="notification-disable"
          class="notification-btn"
        >
          🔕 Disable Notifications
        </button>

        <button
          type="button"
          id="notification-unsubscribe"
          class="notification-btn notification-btn-danger"
        >
          Unsubscribe
        </button>

      </div>

      <div class="notification-preferences">

        <label class="notification-option">
          <input
            type="checkbox"
            id="notify-new-news"
            checked
          />

          <span>
            <strong>New News</strong>
            <small>
              Receive important new news updates.
            </small>
          </span>
        </label>

        <label class="notification-option">
          <input
            type="checkbox"
            id="notify-trending-news"
            checked
          />

          <span>
            <strong>Trending News</strong>
            <small>
              Receive notifications about trending stories.
            </small>
          </span>
        </label>

        <label class="notification-option">
          <input
            type="checkbox"
            id="notify-breaking-news"
            checked
          />

          <span>
            <strong>Breaking News</strong>
            <small>
              Receive important breaking-news alerts.
            </small>
          </span>
        </label>

      </div>

      <div class="notification-frequency">

        <label for="notification-frequency">
          Notification frequency
        </label>

        <select
          id="notification-frequency"
        >
          <option value="limited">
            Limited — up to 5 per hour
          </option>

          <option value="daily">
            Daily — up to 3 per day
          </option>

          <option value="off">
            Off
          </option>
        </select>

      </div>

      <p
        id="notification-message"
        class="notification-message"
        aria-live="polite"
      ></p>

      <p class="notification-privacy">
        You can unsubscribe or change these
        preferences at any time.
      </p>
    `;

    const target =
      document.querySelector(
        "main"
      ) ||
      document.body;

    target.appendChild(
      panel
    );

    bindEvents();

    refreshStatus();
  }


  // ========================================
  // ELEMENT HELPERS
  // ========================================

  function getElement(id) {
    return document.getElementById(
      id
    );
  }


  // ========================================
  // MESSAGE
  // ========================================

  function showMessage(
    message,
    type = "info"
  ) {
    const element =
      getElement(
        "notification-message"
      );

    if (!element) {
      return;
    }

    element.textContent =
      message;

    element.dataset.type =
      type;
  }


  // ========================================
  // READ PREFERENCES
  // ========================================

  function readPreferences() {
    return {
      enabled: true,

      newNews:
        getElement(
          "notify-new-news"
        )?.checked ?? true,

      trendingNews:
        getElement(
          "notify-trending-news"
        )?.checked ?? true,

      breakingNews:
        getElement(
          "notify-breaking-news"
        )?.checked ?? true,

      frequency:
        getElement(
          "notification-frequency"
        )?.value ||
        "limited",
    };
  }


  // ========================================
  // ENABLE
  // ========================================

  async function enableNotifications() {
    try {
      showMessage(
        "Requesting notification permission..."
      );

      const preferences =
        readPreferences();

      const result =
        await manager.subscribe(
          preferences
        );

      if (
        result.success
      ) {
        showMessage(
          "Notifications are enabled.",
          "success"
        );

        await refreshStatus();
      }
    } catch (error) {
      console.error(
        "❌ Notification enable error:",
        error
      );

      showMessage(
        error.message ||
          "Unable to enable notifications.",
        "error"
      );
    }
  }


  // ========================================
  // DISABLE
  // ========================================

  async function disableNotifications() {
    try {
      showMessage(
        "Disabling notifications..."
      );

      await manager.disable();

      showMessage(
        "Notifications have been disabled.",
        "success"
      );

      await refreshStatus();
    } catch (error) {
      console.error(
        "❌ Notification disable error:",
        error
      );

      showMessage(
        error.message ||
          "Unable to disable notifications.",
        "error"
      );
    }
  }


  // ========================================
  // UNSUBSCRIBE
  // ========================================

  async function unsubscribeNotifications() {
    try {
      showMessage(
        "Unsubscribing..."
      );

      await manager.unsubscribe();

      showMessage(
        "You have been unsubscribed from push notifications.",
        "success"
      );

      await refreshStatus();
    } catch (error) {
      console.error(
        "❌ Notification unsubscribe error:",
        error
      );

      showMessage(
        error.message ||
          "Unable to unsubscribe.",
        "error"
      );
    }
  }


  // ========================================
  // SAVE PREFERENCES
  // ========================================

  async function savePreferences() {
    try {
      const preferences =
        readPreferences();

      await manager.updatePreferences(
        preferences
      );

      showMessage(
        "Notification preferences updated.",
        "success"
      );
    } catch (error) {
      console.error(
        "❌ Preference update error:",
        error
      );

      showMessage(
        error.message ||
          "Unable to update preferences.",
        "error"
      );
    }
  }


  // ========================================
  // REFRESH STATUS
  // ========================================

  async function refreshStatus() {
    const statusElement =
      getElement(
        "notification-status"
      );

    if (!statusElement) {
      return;
    }

    if (
      !manager.isSupported()
    ) {
      statusElement.textContent =
        "Not Supported";

      return;
    }

    try {
      const subscription =
        await manager.getSubscription();

      if (
        subscription
      ) {
        statusElement.textContent =
          "Subscribed";

        return;
      }

      if (
        Notification.permission ===
        "denied"
      ) {
        statusElement.textContent =
          "Blocked";

        return;
      }

      statusElement.textContent =
        "Not Enabled";
    } catch {
      statusElement.textContent =
        "Unavailable";
    }
  }


  // ========================================
  // BIND EVENTS
  // ========================================

  function bindEvents() {
    const enableButton =
      getElement(
        "notification-enable"
      );

    const disableButton =
      getElement(
        "notification-disable"
      );

    const unsubscribeButton =
      getElement(
        "notification-unsubscribe"
      );

    const preferenceInputs = [
      getElement(
        "notify-new-news"
      ),

      getElement(
        "notify-trending-news"
      ),

      getElement(
        "notify-breaking-news"
      ),

      getElement(
        "notification-frequency"
      ),
    ];

    enableButton?.addEventListener(
      "click",
      enableNotifications
    );

    disableButton?.addEventListener(
      "click",
      disableNotifications
    );

    unsubscribeButton?.addEventListener(
      "click",
      unsubscribeNotifications
    );

    preferenceInputs.forEach(
      (element) => {
        element?.addEventListener(
          "change",
          savePreferences
        );
      }
    );
  }


  // ========================================
  // INITIALIZE
  // ========================================

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      createNotificationCenter
    );
  } else {
    createNotificationCenter();
  }
})();
