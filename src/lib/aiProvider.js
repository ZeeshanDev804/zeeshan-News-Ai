const AI_API_KEY =
  process.env.AI_API_KEY ||
  process.env.GEMINI_API_KEY;

const AI_MODEL =
  process.env.AI_MODEL ||
  "gemini-2.5-flash";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

const SYSTEM_INSTRUCTION =
  "You are the AI engine for ZEESHAN NEWS AI. Process news accurately, neutrally, and concisely. Never invent facts. Do not present unverified claims as facts. Preserve source context and clearly distinguish facts from uncertainty.";

export function isAIConfigured() {
  return Boolean(
    AI_API_KEY &&
    AI_MODEL
  );
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

  if (
    !prompt ||
    !String(prompt).trim()
  ) {
    throw new Error(
      "AI prompt is required"
    );
  }

  const modelName =
    String(AI_MODEL).trim();

  const endpoint =
    `${GEMINI_API_BASE}/models/${encodeURIComponent(
      modelName
    )}:generateContent`;

  const response = await fetch(
    endpoint,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
        "x-goog-api-key":
          AI_API_KEY,
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                SYSTEM_INSTRUCTION,
            },
          ],
        },

        contents: [
          {
            role: "user",

            parts: [
              {
                text:
                  String(prompt),
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.2,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Gemini AI request failed: ${response.status} ${errorText}`
    );
  }

  const data =
    await response.json();

  const content =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();

  if (!content) {
    throw new Error(
      "Gemini AI returned an empty response"
    );
  }

  return content;
}

export function getAIProviderStatus() {
  return {
    enabled: true,
    provider: "Google Gemini",
    configured: isAIConfigured(),
    model: AI_MODEL || null,
    apiKeyConfigured:
      Boolean(AI_API_KEY),
  };
}