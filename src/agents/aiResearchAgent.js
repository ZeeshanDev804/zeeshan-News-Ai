import { askAI } from "../integrations/aiClient.js";

export async function researchWithAI({
  topic,
  region = "GLOBAL"
}) {
  if (!topic) {
    throw new Error("Topic is required.");
  }

  const prompt = `
Research this news topic:
${topic}

Region: ${region}

Return:
1. Key facts
2. Important dates
3. Reliable sources to verify
4. Possible risks
5. Original article angles

Do not invent facts or quotes.
`;

  const result = await askAI(prompt);

  return {
    topic,
    region,
    research: result.text,
    status: "AI_RESEARCH_COMPLETE",
    createdAt: new Date().toISOString()
  };
}
