const AI_API_KEY =
  process.env.AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

const AI_MODEL =
  process.env.AI_MODEL ||
  "gemini-2.5-flash";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

const SYSTEM_INSTRUCTION = `
You are the AI engine for ZEESHAN NEWS AI.

Your job is to process news accurately, neutrally, and concisely.

Rules:
- Never invent facts.
- Never present unverified claims as confirmed facts.
- Preserve the original source context.
- Clearly distinguish facts from uncertainty.
- Do not copy full source articles.
- Create original summaries and analysis.
- Avoid plagiarism.
- Do not create misleading headlines.
- Keep important names, dates, numbers, and locations accurate.
- If information is insufficient, say that it is insufficient.
`.trim();


export function isAIConfigured() {
  return Boolean(
    String(AI_API_KEY).trim() &&
    String(AI_MODEL).trim()
  );
}


export async function generateAIText(prompt) {
  if (!String(AI_API_KEY).trim()) {
    throw new Error(
      "AI_API_KEY is not configured"
    );
  }

  if (!String(AI_MODEL).trim()) {
    throw new Error(
      "AI_MODEL is not configured"
    );
  }

  if (!prompt || !String(prompt).trim()) {
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


  const response =
    await fetch(endpoint, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "x-goog-api-key":
          String(AI_API_KEY).trim(),
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
    });


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
    data
      ?.candidates?.[0]
      ?.content?.parts
      ?.map(
        (part) =>
          part?.text || ""
      )
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

    provider:
      "Google Gemini",

    configured:
      isAIConfigured(),

    model:
      AI_MODEL || null,

    apiKeyConfigured:
      Boolean(
        String(AI_API_KEY).trim()
      ),
  };
}