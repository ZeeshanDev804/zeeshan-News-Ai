import express from "express";

const router =
  express.Router();

/* =========================
   SITE URL
========================= */

function getSiteUrl(req) {
  const configuredUrl =
    process.env.PUBLIC_SITE_URL ||
    process.env.SITE_URL;

  if (configuredUrl) {
    return String(
      configuredUrl
    ).replace(/\/+$/, "");
  }

  const protocol =
    req.headers["x-forwarded-proto"] ||
    req.protocol ||
    "https";

  const host =
    req.get("host");

  return `${protocol}://${host}`;
}

/* =========================
   XML ESCAPE
========================= */

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================
   CORE URLS
========================= */

function getCoreUrls(baseUrl) {
  return [
    {
      loc: `${baseUrl}/`,
      priority: "1.0",
      changefreq: "hourly",
    },

    {
      loc: `${baseUrl}/latest`,
      priority: "0.9",
      changefreq: "hourly",
    },

    {
      loc: `${baseUrl}/trending`,
      priority: "0.9",
      changefreq: "hourly",
    },

    {
      loc: `${baseUrl}/technology`,
      priority: "0.8",
      changefreq: "hourly",
    },

    {
      loc: `${baseUrl}/business`,
      priority: "0.8",
      changefreq: "hourly",
    },

    {
      loc: `${baseUrl}/sports`,
      priority: "0.8",
      changefreq: "hourly",
    },

    {
      loc: `${baseUrl}/entertainment`,
      priority: "0.8",
      changefreq: "hourly",
    },

    {
      loc: `${baseUrl}/privacy.html`,
      priority: "0.3",
      changefreq: "monthly",
    },

    {
      loc: `${baseUrl}/terms.html`,
      priority: "0.3",
      changefreq: "monthly",
    },

    {
      loc:
        `${baseUrl}/editorial-policy.html`,
      priority: "0.3",
      changefreq: "monthly",
    },

    {
      loc:
        `${baseUrl}/copyright.html`,
      priority: "0.3",
      changefreq: "monthly",
    },
  ];
}

/* =========================
   ARTICLE URL
========================= */

function getArticleUrl(
  baseUrl,
  article
) {
  const id =
    article?.id ??
    article?.article_id;

  if (!id) {
    return null;
  }

  return `${baseUrl}/article/${encodeURIComponent(
    String(id)
  )}`;
}

/* =========================
   BUILD XML
========================= */

function buildSitemapXml(
  urls
) {
  const items =
    urls
      .filter(Boolean)
      .map((item) => {
        const lastmod =
          item.lastmod
            ? `<lastmod>${escapeXml(
                item.lastmod
              )}</lastmod>`
            : "";

        const changefreq =
          item.changefreq
            ? `<changefreq>${escapeXml(
                item.changefreq
              )}</changefreq>`
            : "";

        const priority =
          item.priority
            ? `<priority>${escapeXml(
                item.priority
              )}</priority>`
            : "";

        return `
  <url>
    <loc>${escapeXml(
      item.loc
    )}</loc>
    ${lastmod}
    ${changefreq}
    ${priority}
  </url>`;
      })
      .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${items}
</urlset>`;
}

/* =========================
   DYNAMIC SITEMAP
========================= */

router.get(
  "/sitemap.xml",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const baseUrl =
        getSiteUrl(req);

      const urls =
        getCoreUrls(baseUrl);

      /*
       * Database failure should not
       * destroy the whole sitemap.
       */

      if (db) {
        try {
          const result =
            await db.query(`
              SELECT
                id,
                published_at,
                created_at
              FROM articles

              WHERE
                COALESCE(
                  legal_hold,
                  FALSE
                ) = FALSE

              AND
                (
                  legal_review_required = FALSE
                  OR legal_review_required IS NULL
                )

              ORDER BY
                COALESCE(
                  published_at,
                  created_at
                ) DESC

              LIMIT 5000
            `);

          for (
            const article
            of result.rows || []
          ) {
            const articleUrl =
              getArticleUrl(
                baseUrl,
                article
              );

            if (!articleUrl) {
              continue;
            }

            const date =
              article.published_at ||
              article.created_at;

            urls.push({
              loc:
                articleUrl,

              lastmod:
                date
                  ? new Date(
                      date
                    ).toISOString()
                  : null,

              changefreq:
                "hourly",

              priority:
                "0.7",
            });
          }
        } catch (
          databaseError
        ) {
          console.error(
            "⚠️ Sitemap database query error:",
            databaseError.message
          );
        }
      }

      const xml =
        buildSitemapXml(
          urls
        );

      res
        .status(200)
        .type("application/xml")
        .set(
          "Cache-Control",
          "public, max-age=300, s-maxage=300"
        )
        .send(xml);
    } catch (error) {
      console.error(
        "❌ Sitemap error:",
        error.message
      );

      res.status(500).type(
        "application/xml"
      ).send(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
</urlset>`
      );
    }
  }
);

export default router;