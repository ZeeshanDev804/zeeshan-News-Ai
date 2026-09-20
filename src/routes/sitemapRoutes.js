import express from "express";

const router = express.Router();

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getBaseUrl(req) {
  const configuredUrl =
    process.env.PUBLIC_SITE_URL ||
    process.env.SITE_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const protocol =
    req.headers["x-forwarded-proto"] ||
    req.protocol ||
    "https";

  const host =
    req.get("host");

  return `${protocol}://${host}`;
}

router.get(
  "/sitemap.xml",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const baseUrl =
        getBaseUrl(req);

      const urls = [
        {
          loc: `${baseUrl}/`,
          changefreq: "hourly",
          priority: "1.0",
        },
        {
          loc: `${baseUrl}/latest`,
          changefreq: "hourly",
          priority: "0.9",
        },
        {
          loc: `${baseUrl}/trending`,
          changefreq: "hourly",
          priority: "0.9",
        },
        {
          loc: `${baseUrl}/technology`,
          changefreq: "daily",
          priority: "0.8",
        },
        {
          loc: `${baseUrl}/business`,
          changefreq: "daily",
          priority: "0.8",
        },
        {
          loc: `${baseUrl}/sports`,
          changefreq: "daily",
          priority: "0.8",
        },
        {
          loc: `${baseUrl}/entertainment`,
          changefreq: "daily",
          priority: "0.8",
        },
        {
          loc: `${baseUrl}/privacy.html`,
          changefreq: "monthly",
          priority: "0.3",
        },
        {
          loc: `${baseUrl}/terms.html`,
          changefreq: "monthly",
          priority: "0.3",
        },
        {
          loc: `${baseUrl}/editorial-policy.html`,
          changefreq: "monthly",
          priority: "0.3",
        },
        {
          loc: `${baseUrl}/copyright.html`,
          changefreq: "monthly",
          priority: "0.3",
        },
      ];

      /*
       * Try to add published articles.
       *
       * The query is intentionally protected so
       * the sitemap still works if the production
       * database uses a different article table.
       */

      try {
        const result =
          await db.query(`
            SELECT
              id,
              updated_at,
              published_at
            FROM news_articles
            WHERE
              COALESCE(
                status,
                'published'
              ) = 'published'
            ORDER BY
              COALESCE(
                published_at,
                updated_at
              ) DESC
            LIMIT 5000
          `);

        for (
          const article
          of result.rows
        ) {
          const articleDate =
            article.published_at ||
            article.updated_at;

          urls.push({
            loc:
              `${baseUrl}/article/${encodeURIComponent(
                article.id
              )}`,

            lastmod:
              articleDate
                ? new Date(
                    articleDate
                  ).toISOString()
                : null,

            changefreq: "daily",
            priority: "0.7",
          });
        }
      } catch (articleError) {
        console.warn(
          "⚠️ Sitemap article query skipped:",
          articleError.message
        );
      }

      const xmlUrls =
        urls
          .map((url) => {
            const lastmod =
              url.lastmod
                ? `
    <lastmod>${escapeXml(
      url.lastmod
    )}</lastmod>`
                : "";

            return `
  <url>
    <loc>${escapeXml(
      url.loc
    )}</loc>${lastmod}
    <changefreq>${escapeXml(
      url.changefreq
    )}</changefreq>
    <priority>${escapeXml(
      url.priority
    )}</priority>
  </url>`;
          })
          .join("");

      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>${xmlUrls}
</urlset>`;

      res
        .status(200)
        .type("application/xml")
        .send(xml);
    } catch (error) {
      console.error(
        "❌ Sitemap error:",
        error.message
      );

      res
        .status(500)
        .type("application/xml")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`
        );
    }
  }
);

export default router;
