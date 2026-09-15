import { askAI } from "../integrations/aiClient.js";

export async function writeArticle({
  topic,
  research
}) {
  if (!topic || !research) {
    throw new Error(
      "Topic and research are required."
    );
  }

  const prompt = `
Write an original news article.

Topic:
${topic}

Research:
${research}

Rules:
- Do not copy source wording.
- Do not invent facts or quotes.
- Use only supported information.
- Write a clear headline.
- Write a short summary.
- Write a useful article body.
`;

  const result = await askAI(prompt);

  return {
    topic,
    draft: result.text,
    status: "DRAFT_READY",
    createdAt: new Date().toISOString()
  };
}
