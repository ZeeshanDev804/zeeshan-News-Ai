const DEFAULT_SITE_URL =
  "https://your-domain.com";

function normalizeUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getSiteUrl() {
  return normalizeUrl(
    process.env.GOOGLE_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL
  );
}

export function createCanonicalUrl(path = "/") {
  const siteUrl = getSiteUrl();

  const cleanPath = String(path)
    .trim()
    .replace(/^\/+/, "");

  return `${siteUrl}/${cleanPath}`;
}

export function createRobotsTxt() {
  const siteUrl = getSiteUrl();

  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`
  ].join("\n");
}

export function createSitemapXml(urls = []) {
  const uniqueUrls = [
    ...new Set(
      urls
        .map((url) => normalizeUrl(url))
        .filter(Boolean)
    )
  ];

  const entries = uniqueUrls
    .map(
      (url) => `
  <url>
    <loc>${escapeXml(url)}</loc>
  </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

export function buildArticleUrl(slug) {
  if (!slug) {
    throw new Error("Article slug is required.");
  }

  return createCanonicalUrl(
    `/news/${String(slug).trim()}`
  );
}

export function buildTopicUrl(slug) {
  if (!slug) {
    throw new Error("Topic slug is required.");
  }

  return createCanonicalUrl(
    `/topics/${String(slug).trim()}`
  );
}
