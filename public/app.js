"use strict";

/*
  ZEESHAN NEWS AI
  Main Frontend Application

  Includes:
  - Latest News
  - Trending News
  - News Count
  - Search
  - Categories
  - Category News
  - Article Links
  - Web Push Notifications
  - Push Preferences
  - Analytics Tracking
*/


/* =========================================
   GLOBAL CONFIG
========================================= */

const API_BASE = "/api";


/* =========================================
   SAFE HELPERS
========================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function safeURL(value) {
  try {
    const url = new URL(
      String(value || ""),
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


function formatDate(value) {
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

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}


function truncateText(
  value,
  length = 180
) {
  const text =
    String(value || "").trim();

  if (
    text.length <= length
  ) {
    return text;
  }

  return (
    text.slice(0, length).trim() +
    "..."
  );
}


function getElement(id) {
  return document.getElementById(id);
}


/* =========================================
   API HELPER
========================================= */

async function apiRequest(
  endpoint,
  options = {}
) {
  const response =
    await fetch(
      API_BASE + endpoint,
      {
        cache: "no-store",
        ...options,
        headers: {
          Accept:
            "application/json",

          ...(options.headers || {}),
        },
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


/* =========================================
   NEWS CARD
========================================= */

function createNewsCard(
  article
) {
  const id =
    article?.id;

  const title =
    article?.title ||
    "Untitled News";

  const source =
    article?.source ||
    "Unknown Source";

  const category =
    article?.ai_category ||
    "General";

  const summary =
    article?.ai_summary ||
    article?.description ||
    article?.content ||
    "No summary available.";

  const publishedAt =
    article?.published_at ||
    article?.created_at;

  const articleURL =
    id
      ? `/article.html?id=${encodeURIComponent(id)}`
      : safeURL(article?.link);

  return `
    <article class="news-card">

      <div class="news-card-meta">

        <span class="news-source">
          ${escapeHTML(source)}
        </span>

        <span class="news-category">
          ${escapeHTML(category)}
        </span>

      </div>


      <h3 class="news-card-title">

        <a
          href="${escapeHTML(articleURL)}"
          data-article-id="${escapeHTML(id || "")}"
        >
          ${escapeHTML(title)}
        </a>

      </h3>


      <p class="news-card-summary">
        ${escapeHTML(
          truncateText(summary)
        )}
      </p>


      <div class="news-card-footer">

        <time>
          ${escapeHTML(
            formatDate(publishedAt)
          )}
        </time>


        ${
          article?.link
            ? `
              <a
                href="${escapeHTML(
                  safeURL(article.link)
                )}"
                target="_blank"
                rel="noopener noreferrer"
                data-source-click="true"
                data-article-id="${escapeHTML(
                  id || ""
                )}"
              >
                Original Source ↗
              </a>
            `
            : ""
        }

      </div>

    </article>
  `;
}


/* =========================================
   NEWS LIST RENDER
========================================= */

function renderNewsList(
  container,
  articles,
  emptyMessage =
    "No news available."
) {
  if (!container) {
    return;
  }

  if (
    !Array.isArray(articles) ||
    articles.length === 0
  ) {
    container.innerHTML = `
      <div class="empty-state">
        ${escapeHTML(emptyMessage)}
      </div>
    `;

    return;
  }

  container.innerHTML =
    articles
      .map(createNewsCard)
      .join("");
}


/* =========================================
   LATEST NEWS
========================================= */

async function loadLatestNews() {
  const container =
    getElement("latestNews") ||
    getElement("latest-news") ||
    getElement("newsGrid");

  if (!container) {
    return;
  }

  try {

    const data =
      await apiRequest(
        "/news?limit=30"
      );

    const articles =
      data?.news ||
      data?.articles ||
      data?.data ||
      [];

    renderNewsList(
      container,
      articles,
      "No latest news available yet."
    );

  } catch (error) {

    console.error(
      "❌ Latest news error:",
      error.message
    );

    container.innerHTML = `
      <div class="empty-state">
        Unable to load latest news.
      </div>
    `;
  }
}


/* =========================================
   TRENDING NEWS
========================================= */

async function loadTrendingNews() {
  const container =
    getElement("trendingNews") ||
    getElement("trending-news");

  if (!container) {
    return;
  }

  try {

    const data =
      await apiRequest(
        "/news/trending?limit=6"
      );

    const articles =
      data?.news ||
      data?.articles ||
      data?.data ||
      [];

    renderNewsList(
      container,
      articles,
      "No trending news available yet."
    );

    trackAnalytics(
      "trending_view",
      {
        pagePath:
          window.location.pathname,

        metadata: {
          count:
            articles.length,
        },
      }
    );

  } catch (error) {

    console.error(
      "❌ Trending news error:",
      error.message
    );

    container.innerHTML = `
      <div class="empty-state">
        Unable to load trending news.
      </div>
    `;
  }
}


/* =========================================
   NEWS COUNT
========================================= */

async function loadNewsCount() {
  const elements = [
    getElement("newsCount"),
    getElement("articleCount"),
    getElement("totalNews"),
  ].filter(Boolean);

  if (
    elements.length === 0
  ) {
    return;
  }

  try {

    const data =
      await apiRequest(
        "/news/count"
      );

    const count =
      data?.count ??
      data?.total ??
      0;

    elements.forEach(
      (element) => {
        element.textContent =
          Number(count).toLocaleString();
      }
    );

  } catch (error) {

    console.error(
      "❌ News count error:",
      error.message
    );

    elements.forEach(
      (element) => {
        element.textContent =
          "—";
      }
    );
  }
}


/* =========================================
   CATEGORY LIST
========================================= */

async function loadCategories() {
  const container =
    getElement("categories");

  if (!container) {
    return;
  }

  try {

    const data =
      await apiRequest(
        "/news/categories"
      );

    const categories =
      data?.categories ||
      data?.data ||
      [];

    if (
      !Array.isArray(categories) ||
      categories.length === 0
    ) {
      return;
    }

    /*
      If the homepage already has
      category buttons, keep them.
      Otherwise create them.
    */

    const existingButtons =
      container.querySelectorAll(
        "[data-category]"
      );

    if (
      existingButtons.length > 0
    ) {
      return;
    }

    container.innerHTML =
      categories
        .map((item) => {

          const category =
            typeof item === "string"
              ? item
              : item.category;

          return `
            <button
              type="button"
              class="category-button"
              data-category="${escapeHTML(
                category
              )}"
            >
              ${escapeHTML(
                category
              )}
            </button>
          `;
        })
        .join("");

  } catch (error) {

    console.error(
      "❌ Categories error:",
      error.message
    );
  }
}


/* =========================================
   CATEGORY NEWS
========================================= */

async function loadCategoryNews(
  category
) {
  const normalized =
    String(category || "")
      .trim()
      .toLowerCase();

  if (!normalized) {
    return;
  }

  const container =
    getElement("latestNews") ||
    getElement("latest-news") ||
    getElement("newsGrid");

  if (!container) {
    return;
  }

  try {

    const data =
      await apiRequest(
        `/news/category/${encodeURIComponent(
          normalized
        )}?limit=50`
      );

    const articles =
      data?.news ||
      data?.articles ||
      data?.data ||
      [];

    renderNewsList(
      container,
      articles,
      `No ${normalized} news available.`
    );

    trackAnalytics(
      "category_view",
      {
        pagePath:
          window.location.pathname,

        metadata: {
          category:
            normalized,

          count:
            articles.length,
        },
      }
    );

  } catch (error) {

    console.error(
      "❌ Category news error:",
      error.message
    );
  }
}


/* =========================================
   SEARCH
========================================= */

async function performSearch(
  query
) {
  const searchQuery =
    String(query || "")
      .trim();

  if (!searchQuery) {
    return;
  }

  const container =
    getElement("searchResults") ||
    getElement("search-results");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="empty-state">
      Searching...
    </div>
  `;

  try {

    const data =
      await apiRequest(
        `/news/search?q=${encodeURIComponent(
          searchQuery
        )}`
      );

    const articles =
      data?.news ||
      data?.articles ||
      data?.results ||
      data?.data ||
      [];

    renderNewsList(
      container,
      articles,
      "No matching news found."
    );

    trackAnalytics(
      "search",
      {
        pagePath:
          window.location.pathname,

        metadata: {
          query:
            searchQuery.slice(
              0,
              200
            ),

          resultCount:
            articles.length,
        },
      }
    );

  } catch (error) {

    console.error(
      "❌ Search error:",
      error.message
    );

    container.innerHTML = `
      <div class="empty-state">
        Search could not be completed.
      </div>
    `;
  }
}


/* =========================================
   SEARCH FORM
========================================= */

function setupSearch() {
  const forms =
    document.querySelectorAll(
      "form"
    );

  forms.forEach(
    (form) => {

      const input =
        form.querySelector(
          'input[type="search"]'
        ) ||
        form.querySelector(
          'input[name="q"]'
        );

      if (!input) {
        return;
      }

      form.addEventListener(
        "submit",
        (event) => {

          event.preventDefault();

          performSearch(
            input.value
          );
        }
      );
    }
  );
}


/* =========================================
   CATEGORY BUTTONS
========================================= */

function setupCategoryButtons() {
  document.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          "[data-category]"
        );

      if (!button) {
        return;
      }

      const category =
        button.dataset.category;

      if (!category) {
        return;
      }

      loadCategoryNews(
        category
      );
    }
  );
}


/* =========================================
   ARTICLE CLICK ANALYTICS
========================================= */

function setupArticleAnalytics() {
  document.addEventListener(
    "click",
    (event) => {

      const link =
        event.target.closest(
          "[data-article-id]"
        );

      if (!link) {
        return;
      }

      const articleId =
        link.dataset.articleId;

      if (!articleId) {
        return;
      }

      trackAnalytics(
        "article_view",
        {
          articleId,

          pagePath:
            window.location.pathname,

          metadata: {
            target:
              link.getAttribute(
                "href"
              ),
          },