function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createBloggerPostPayload({
  article,
  seo,
  source = null
}) {
  if (!article || typeof article !== "object") {
    throw new Error("Article is required.");
  }

  if (!seo || typeof seo !== "object") {
    throw new Error("SEO data is required.");
  }

  if (!article.title || !article.body) {
    throw new Error(
      "Article title and body are required."
    );
  }

  const title = cleanText(
    seo.title || article.title
  );

  const description = cleanText(
    seo.description || article.summary || ""
  );

  const body = cleanText(article.body);

  const sourceBlock = source?.url
    ? `
      <p>
        <strong>Source:</strong>
        <a href="${escapeHtml(source.url)}"
           rel="nofollow noopener"
           target="_blank">
          ${escapeHtml(source.name || "Source")}
        </a>
      </p>
    `
    : "";

  return {
    title,

    content: `
      <article>
        <h1>${escapeHtml(title)}</h1>

        ${
          description
            ? `<p><strong>${escapeHtml(
                description
              )}</strong></p>`
            : ""
        }

        <div>
          ${body}
        </div>

        ${sourceBlock}
      </article>
    `,

    labels: [
      cleanText(article.category || "Trending"),
      cleanText(article.region || "GLOBAL")
    ],

    customMetaData: {
      description,
      canonicalPath: seo.canonicalPath || null,
      slug: seo.slug || null
    }
  };
}

export function createBloggerApiConfig() {
  return {
    blogId: process.env.BLOGGER_BLOG_ID || null,
    apiKey: process.env.BLOGGER_API_KEY || null,

    configured: Boolean(
      process.env.BLOGGER_BLOG_ID &&
      process.env.BLOGGER_API_KEY
    )
  };
}

export function checkBloggerConfiguration() {
  const config = createBloggerApiConfig();

  return {
    configured: config.configured,

    missing: [
      !config.blogId ? "BLOGGER_BLOG_ID" : null,
      !config.apiKey ? "BLOGGER_API_KEY" : null
    ].filter(Boolean)
  };
}

export function createBloggerPublishResult({
  postId = null,
  url = null,
  status = "PUBLISHED"
}) {
  return {
    platform: "BLOGGER",
    postId,
    url,
    status,
    publishedAt: new Date().toISOString()
  };
}
