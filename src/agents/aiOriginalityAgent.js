import { askAI } from "../integrations/aiClient.js";

export async function checkOriginality({
  title,
  article,
  sourceContent = ""
}) {
  if (!title || !article) {
    throw new Error("Title and article are required.");
  }

  const prompt = `
Check this article for originality.

Title:
${title}

Article:
${article}

Source content:
${sourceContent}

Return:
- Similarity concerns
- Copied wording concerns
- Original value
- Risk level
- Final recommendation

Do not claim certainty without evidence.
`;

  const result = await askAI(prompt);

  return {
    title,
    result: result.text,
    status: "ORIGINALITY_CHECK_COMPLETE",
    createdAt: new Date().toISOString()
  };
}
