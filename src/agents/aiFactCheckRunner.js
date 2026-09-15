import { askAI } from "../integrations/aiClient.js";

export async function checkArticle({
  title,
  article,
  sources = []
}) {
  if (!title || !article) {
    throw new Error(
      "Title and article are required."
    );
  }

  const prompt = `
Fact-check this article.

Title:
${title}

Article:
${article}

Sources:
${sources.join("\n")}

Return:
- VERIFIED facts
- UNVERIFIED claims
- Possible errors
- Risk level
- Final recommendation

Do not invent evidence.
`;

  const result = await askAI(prompt);

  return {
    title,
    result: result.text,
    status: "FACT_CHECK_COMPLETE",
    createdAt: new Date().toISOString()
  };
}
