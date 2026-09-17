const AI_API_KEY = process.env.AI_API_KEY;

const AI_MODEL = process.env.AI_MODEL;

export function isAIConfigured() {
  return Boolean(AI_API_KEY && AI_MODEL);
}

export async function generateAIText(prompt) {
  if (!AI_API_KEY) {
    throw new Error(
      "AI_API_KEY is not configured"
    );
  }

  if (!AI_MODEL) {
    throw new Error(
      "AI_MODEL is not configured"
    );
  }

  if (!prompt || !String(prompt).trim()) {
    throw new Error(
      "AI prompt is required"
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },

      body: JSON.stringify({
        model: AI_MODEL,

        instructions:
          "You are the AI engine for ZEESHAN NEWS AI. Process news accurately, neutrally, and concisely. Never invent facts.",

        input: String(prompt),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `AI provider request failed: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  const content = data?.output_text;

  if (!content) {
    throw new Error(
      "AI provider returned an empty response"
    );
  }

  return content;
}