const API_BASE = "";

let currentPushSubscription = null;

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeURL(value = "") {
  try {
    const url = new URL(
      value,
      window.location.origin
    );

    if (
      url.protocol === "http:" ||
      url.protocol === "https:"
    ) {
      return url.href;
    }

    return "#";
  } catch {
    return "#";
  }
}

async function fetchJSON(
  url,
  options = {}
) {
  const response =
    await fetch(
      `${API_BASE}${url}`,
      options
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        "Request failed"
    );
  }

  return data;
}

function formatDate(
  value
) {
  if (!value) {
    return "Unknown date";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown date";
  }

  return date.toLocaleString();
}

function articleCard(
  article
) {
  const articleUrl =
    `/article.html?id=${encodeURIComponent(
      article.id
    )}`;

  const source =
    escapeHTML(
      article.source ||
        "Unknown Source"
    );

  const title =
    escapeHTML(
      article.title ||
        "Untitled"
    );

  const summary =
    escapeHTML(
      article.ai_summary ||
        article.description ||
        article.content ||
        "No summary available."
    );

  const category =
    escapeHTML(
      article.ai_category ||
        "world"
    );

  return `
    <article class="news-card">
      <div class="news-card-meta">
        <span>${source}</span>
        <span>${category}</span>
      </div>

      <h3>
        <a href="${articleUrl}">
          ${title}
        </a>
      </h3>

      <p>${summary}</p>

      <div class="news-card-footer">
        <span>
          ${escapeHTML(
            formatDate(
              article.published_at ||
                article.created_at
            )
          )}
        </span>

        <a href="${articleUrl}">
          Read Article →
        </a>
      </div>
    </article>
  `;
}

function renderArticles(
  container,
  articles = []
) {
  if (!container) {
    return;
  }

  if (
    !Array.isArray(
      articles
    ) ||
    articles.length === 0
  ) {
    container.innerHTML =
      `
        <div class="empty-state">
          No news available right now.
        </div>
      `;

    return;
  }

  container.innerHTML =
    articles
      .map(articleCard)
      .join("");
}

async function loadLatestNews() {
  const container =
    document.querySelector(
      "#latestNews"
    );

  if (!container) {
    return;
  }

  try {
    const data =
      await fetchJSON(
        "/api/news?limit=30"
      );

    renderArticles(
      container,
      data.news ||
        data.articles ||
        []
    );

  } catch (error) {
    console.error(
      "Latest news error:",
      error
    );

    container.innerHTML =
      `
        <div class="empty-state">
          Unable to load latest news.
        </div>
      `;
  }
}

async function loadTrendingNews() {
  const container =
    document.querySelector(
      "#trendingNews"
    );

  if (!container) {
    return;
  }

  try {
    const data =
      await fetchJSON(
        "/api/news/trending?limit=6"
      );

    renderArticles(
      container,
      data.news ||
        data.articles ||
        []
    );

  } catch (error) {
    console.error(
      "Trending news error:",
      error
    );

    container.innerHTML =
      `
        <div class="empty-state">
          Unable to load trending news.
        </div>
      `;
  }
}

async function loadNewsCount() {
  const element =
    document.querySelector(
      "#newsCount"
    );

  if (!element) {
    return;
  }

  try {
    const data =
      await fetchJSON(
        "/api/news/count"
      );

    element.textContent =
      Number(
        data.count || 0
      ).toLocaleString();

  } catch (error) {
    console.error(
      "News count error:",
      error
    );

    element.textContent =
      "—";
  }
}

async function loadCategories() {
  const container =
    document.querySelector(
      "#categoryButtons"
    );

  if (!container) {
    return;
  }

  try {
    const data =
      await fetchJSON(
        "/api/news/categories"
      );

    const categories =
      data.categories ||
      data.data ||
      [];

    if (
      !Array.isArray(
        categories
      )
    ) {
      return;
    }

    container.innerHTML =
      categories
        .map((item) => {
          const name =
            typeof item ===
            "string"
              ? item
              : item.category;

          const count =
            typeof item ===
            "object"
              ? item.count
              : null;

          return `
            <button
              class="category-button"
              data-category="${escapeHTML(
                name
              )}"
            >
              ${escapeHTML(
                name
              )}

              ${
                count !== null
                  ? `<span>${escapeHTML(
                      count
                    )}</span>`
                  : ""
              }
            </button>
          `;
        })
        .join("");

    container
      .querySelectorAll(
        ".category-button"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            loadCategoryNews(
              button.dataset.category
            );
          }
        );
      });

  } catch (error) {
    console.error(
      "Category error:",
      error
    );
  }
}

async function loadCategoryNews(
  category
) {
  const container =
    document.querySelector(
      "#searchResults"
    );

  if (!container) {
    return;
  }

  try {
    const data =
      await fetchJSON(
        `/api/news/category/${encodeURIComponent(
          category
        )}?limit=50`
      );

    renderArticles(
      container,
      data.news ||
        data.articles ||
        []
    );

  } catch (error) {
    console.error(
      "Category news error:",
      error
    );

    container.innerHTML =
      `
        <div class="empty-state">
          Unable to load category news.
        </div>
      `;
  }
}

async function searchNews(
  query
) {
  const container =
    document.querySelector(
      "#searchResults"
    );

  if (!container) {
    return;
  }

  const cleanQuery =
    String(
      query || ""
    ).trim();

  if (!cleanQuery) {
    container.innerHTML = "";
    return;
  }

  try {
    const data =
      await fetchJSON(
        `/api/news/search?q=${encodeURIComponent(
          cleanQuery
        )}`
      );

    renderArticles(
      container,
      data.news ||
        data.articles ||
        []
    );

  } catch (error) {
    console.error(
      "Search error:",
      error
    );

    container.innerHTML =
      `
        <div class="empty-state">
          Search failed.
        </div>
      `;
  }
}

async function registerServiceWorker() {
  if (
    !("serviceWorker" in navigator)
  ) {
    console.warn(
      "Service Worker is not supported."
    );

    return null;
  }

  try {
    const registration =
      await navigator.serviceWorker.register(
        "/sw.js"
      );

    console.log(
      "✅ Push service worker registered"
    );

    return registration;

  } catch (error) {
    console.error(
      "❌ Service worker registration failed:",
      error
    );

    return null;
  }
}

function base64ToUint8Array(
  base64String
) {
  const padding =
    "=".repeat(
      (4 -
        (base64String.length %
          4)) %
        4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    window.atob(
      base64
    );

  return Uint8Array.from(
    [...rawData].map(
      (char) =>
        char.charCodeAt(0)
    )
  );
}

async function getVapidPublicKey() {
  const data =
    await fetchJSON(
      "/api/push/config"
    );

  if (
    !data.publicKey
  ) {
    throw new Error(
      "VAPID public key is not available"
    );
  }

  return data.publicKey;
}

async function subscribeToPush(
  registration
) {
  if (
    !("PushManager" in window)
  ) {
    throw new Error(
      "Push notifications are not supported."
    );
  }

  const permission =
    await Notification.requestPermission();

  if (
    permission !== "granted"
  ) {
    throw new Error(
      "Notification permission was not granted."
    );
  }

  const publicKey =
    await getVapidPublicKey();

  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe(
        {
          userVisibleOnly:
            true,

          applicationServerKey:
            base64ToUint8Array(
              publicKey
            ),
        }
      );
  }

  const saved =
    await fetchJSON(
      "/api/push/subscribe",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          subscription:
            subscription.toJSON(),

          preferences: {
            breakingNews:
              true,

            trendingNews:
              true,

            frequencyLimit:
              10,
          },
        }),
      }
    );

  currentPushSubscription =
    subscription;

  console.log(
    "🔔 Push subscription saved:",
    saved
  );

  return subscription;
}

async function unsubscribeFromPush() {
  if (
    !currentPushSubscription
  ) {
    const registration =
      await navigator.serviceWorker.getRegistration(
        "/"
      );

    if (registration) {
      currentPushSubscription =
        await registration.pushManager.getSubscription();
    }
  }

  if (
    !currentPushSubscription
  ) {
    return;
  }

  const endpoint =
    currentPushSubscription.endpoint;

  await fetchJSON(
    "/api/push/unsubscribe",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        endpoint,
      }),
    }
  );

  await currentPushSubscription.unsubscribe();

  currentPushSubscription =
    null;

  console.log(
    "🔕 Push subscription disabled"
  );
}

function setupPushUI(
  registration
) {
  const button =
    document.querySelector(
      "#enableNotifications"
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    async () => {
      try {
        button.disabled =
          true;

        button.textContent =
          "Enabling...";

        await subscribeToPush(
          registration
        );

        button.textContent =
          "Notifications ON";

      } catch (error) {
        console.error(
          "Push setup error:",
          error
        );

        button.textContent =
          "Enable Notifications";

        alert(
          error.message
        );

      } finally {
        button.disabled =
          false;
      }
    }
  );
}

async function setupPushNotifications() {
  const registration =
    await registerServiceWorker();

  if (!registration) {
    return;
  }

  setupPushUI(
    registration
  );
}

function setupMobileMenu() {
  const button =
    document.querySelector(
      "#menuToggle"
    );

  const nav =
    document.querySelector(
      "#mainNav"
    );

  if (
    !button ||
    !nav
  ) {
    return;
  }

  button.addEventListener(
    "click",
    () => {
      nav.classList.toggle(
        "open"
      );
    }
  );
}

function setupSearch() {
  const form =
    document.querySelector(
      "#searchForm"
    );

  const input =
    document.querySelector(
      "#searchInput"
    );

  if (
    !form ||
    !input
  ) {
    return;
  }

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      searchNews(
        input.value
      );
    }
  );
}

async function initializeApp() {
  setupMobileMenu();

  setupSearch();

  await Promise.all([
    loadLatestNews(),
    loadTrendingNews(),
    loadNewsCount(),
    loadCategories(),
  ]);

  setupPushNotifications();
}

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);