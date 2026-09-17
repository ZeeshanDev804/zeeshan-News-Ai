const AI_API_KEY = process.env.AI_API_KEY;

export function isAIConfigured() {
  return Boolean(AI_API_KEY);
}

export async function generateAIText(prompt) {
  if (!AI_API_KEY) {
    throw new Error(
      "AI_API_KEY is not configured"
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are the AI engine for ZEESHAN NEWS AI. Return accurate, concise, neutral news-processing output.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
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

  const content =
    data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "AI provider returned an empty response"
    );
  }

  return content;
}
