import { createNewsDraft } from "../src/news/newsEngine.js";
import { buildSEO } from "../src/seo/seoEngine.js";

const article = createNewsDraft({
  title: "AI Technology Update",
  category: "AI & Technology",
  summary: "Latest verified AI technology update.",
  sourceName: "Test Source",
  sourceUrl: "https://example.com"
});

const seo = buildSEO(article);

console.log("Article:", article.id);
console.log("SEO Slug:", seo.slug);
console.log("TEST PASSED");
