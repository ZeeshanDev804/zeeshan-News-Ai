import { askAI } from "../integrations/aiClient.js";

export async function optimizeArticleSEO({
  title,
  article,
  category = "Trending"
}) {
  if (!title || !article) {
    throw new Error("Title and article are required.");
  }

  const prompt = `
Optimize this original news article for SEO.

Title:
${title}

Category:
${category}

Article:
${article}

Return:
- SEO title
- Meta description
- URL slug
- Keywords
- Search-friendly headings

Do not use misleading keywords.
`;

  const result = await askAI(prompt);

  return {
    title,
    category,
    seo: result.text,
    status: "SEO_READY",
    createdAt: new Date().toISOString()
  };
}
