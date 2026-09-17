// ========================================
// ZEESHAN NEWS AI
// FRONTEND APPLICATION
// ========================================

const latestNewsContainer =
  document.getElementById("latestNews");

const trendingNewsContainer =
  document.getElementById("trendingNews");

const searchResultsContainer =
  document.getElementById("searchResults");

const searchResultsSection =
  document.getElementById(
    "searchResultsSection"
  );

const searchResultsTitle =
  document.getElementById(
    "searchResultsTitle"
  );

const searchForm =
  document.getElementById("searchForm");

const searchInput =
  document.getElementById("searchInput");

const articleCount =
  document.getElementById("articleCount");

const engineStatus =
  document.getElementById("engineStatus");

const menuButton =
  document.getElementById("menuButton");

const mainNav =
  document.getElementById("mainNav");


// ========================================
// API HELPER
// ========================================

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status}`
    );
  }

  return response.json();
}


// ========================================
// DATE FORMATTER
// ========================================

function formatDate(dateValue) {
  if (!dateValue) {
    return "Unknown date";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


// ========================================
// TEXT HELPER
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
// CATEGORY HELPER
// ========================================

function normalizeCategory(
  category = ""
) {
  const value = String(category)
    .trim()
    .toLowerCase();

  const allowed = [
    "world",
    "politics",
    "technology",
    "business",
    "sports",
    "entertainment",
  ];

  return allowed.includes(value)
    ? value
    : "world";
}


// ========================================
// ARTICLE CARD
// ========================================

function createNewsCard(article) {
  const title =
    escapeHTML(
      article.title ||
      "Untitled news"
    );

  const source =
    escapeHTML(
      article.source ||
      "Unknown source"
    );

  const category =
    normalizeCategory(
      article.ai_category ||
      article.category ||
      "world"
    );

  const summary =
    escapeHTML(
      article.ai_summary ||
      article.content ||
      article.description ||
      "No summary available."
    );

  const link =
    article.link || "#";

  const date =
    formatDate(
      article.published_at ||
      article.created_at
    );

  return `
    <article class="news-card">

      <div class="news-card-top">

        <span class="news-source">
          ${source}
        </span>

        <span class="news-category">
          ${escapeHTML(category)}
        </span>

      </div>

      <div class="news-card-body">

        <h3>
          ${title}
        </h3>

        <p class="news-summary">
          ${summary}
        </p>

      </div>

      <div class="news-card-footer">

        <span class="news-date">
          ${escapeHTML(date)}
        </span>

        <a
          class="read-link"
          href="${escapeHTML(link)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read Source →
        </a>

      </div>

    </article>
  `;
}


// ========================================
// RENDER NEWS
// ========================================

function renderNews(
  container,
  articles
) {
  if (!container) {
    return;
  }

  if (
    !Array.isArray(articles) ||
    articles.length === 0
  ) {
    container.innerHTML = `
      <div class="empty-card">
        No news articles found.
      </div>
    `;

    return;
  }

  container.innerHTML =
    articles
      .map(createNewsCard)
      .join("");
}


// ========================================
// ERROR DISPLAY
// ========================================

function renderError(
  container,
  message
) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="error-card">
      ${escapeHTML(message)}
    </div>
  `;
}


// ========================================
// LOAD LATEST NEWS
// ========================================

async function loadLatestNews() {
  try {
    engineStatus.textContent =
      "ONLINE";

    const data =
      await fetchJSON(
        "/api/news?limit=30"
      );

    renderNews(
      latestNewsContainer,
      data.articles || []
    );

  } catch (error) {

    console.error(
      "Latest news failed:",
      error
    );

    engineStatus.textContent =
      "ERROR";

    renderError(
      latestNewsContainer,
      "Unable to load latest news."
    );
  }
}


// ========================================
// LOAD TRENDING NEWS
// ========================================

async function loadTrendingNews() {
  try {

    const data =
      await fetchJSON(
        "/api/news?limit=10"
      );

    const articles =
      Array.isArray(data.articles)
        ? data.articles
        : [];

    renderNews(
      trendingNewsContainer,
      articles.slice(0, 6)
    );

  } catch (error) {

    console.error(
      "Trending news failed:",
      error
    );

    renderError(
      trendingNewsContainer,
      "Unable to load trending news."
    );
  }
}


// ========================================
// LOAD ARTICLE COUNT
// ========================================

async function loadArticleCount() {
  try {

    const data =
      await fetchJSON(
        "/api/news/count"
      );

    articleCount.textContent =
      Number(data.total || 0)
        .toLocaleString();

  } catch (error) {

    console.error(
      "Article count failed:",
      error
    );

    articleCount.textContent =
      "—";
  }
}


// ========================================
// SEARCH NEWS
// ========================================

async function searchNews(query) {

  const cleanQuery =
    String(query || "").trim();

  if (!cleanQuery) {
    return;
  }

  try {

    searchResultsSection
      .classList
      .remove("hidden");

    searchResultsTitle.textContent =
      `Results for "${cleanQuery}"`;

    searchResultsContainer.innerHTML = `
      <div class="loading-card">
        Searching news...
      </div>
    `;

    searchResultsSection
      .scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

    const url =
      `/api/news/search?q=${encodeURIComponent(
        cleanQuery
      )}&limit=30`;

    const data =
      await fetchJSON(url);

    renderNews(
      searchResultsContainer,
      data.articles || []
    );

  } catch (error) {

    console.error(
      "News search failed:",
      error
    );

    renderError(
      searchResultsContainer,
      "Search failed. Please try again."
    );
  }
}


// ========================================
// CATEGORY FILTER
// ========================================

async function loadCategory(
  category
) {

  const normalized =
    normalizeCategory(category);

  try {

    searchResultsSection
      .classList
      .remove("hidden");

    searchResultsTitle.textContent =
      `${normalized.toUpperCase()} NEWS`;

    searchResultsContainer.innerHTML = `
      <div class="loading-card">
        Loading ${escapeHTML(
          normalized
        )} news...
      </div>
    `;

    searchResultsSection
      .scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

    const data =
      await fetchJSON(
        "/api/news?limit=100"
      );

    const articles =
      Array.isArray(data.articles)
        ? data.articles
        : [];

    const filtered =
      articles.filter(
        (article) =>
          normalizeCategory(
            article.ai_category ||
            article.category ||
            "world"
          ) === normalized
      );

    renderNews(
      searchResultsContainer,
      filtered
    );

  } catch (error) {

    console.error(
      "Category loading failed:",
      error
    );

    renderError(
      searchResultsContainer,
      "Unable to load category news."
    );
  }
}


// ========================================
// SEARCH FORM
// ========================================

if (searchForm) {

  searchForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      await searchNews(
        searchInput.value
      );

    }
  );
}


// ========================================
// CATEGORY BUTTONS
// ========================================

document
  .querySelectorAll(
    ".category-card"
  )
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        const category =
          button.dataset.category;

        loadCategory(category);
      }
    );

  });


// ========================================
// MOBILE MENU
// ========================================

if (
  menuButton &&
  mainNav
) {

  menuButton.addEventListener(
    "click",
    () => {

      mainNav.classList.toggle(
        "open"
      );

    }
  );

  mainNav
    .querySelectorAll("a")
    .forEach((link) => {

      link.addEventListener(
        "click",
        () => {

          mainNav.classList.remove(
            "open"
          );

        }
      );

    });

}


// ========================================
// INITIALIZE APPLICATION
// ========================================

async function initializeNewsApp() {

  await Promise.all([
    loadLatestNews(),
    loadTrendingNews(),
    loadArticleCount(),
  ]);

  console.log(
    "🚀 ZEESHAN NEWS AI frontend initialized"
  );
}

initializeNewsApp();
