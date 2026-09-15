const API_URL =
  "https://api.openai.com/v1/responses";

export async function askAI(prompt) {
  if (!process.env.AI_API_KEY) {
    throw new Error("AI_API_KEY is not configured.");
  }

  if (!prompt) {
    throw new Error("Prompt is required.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        `Bearer ${process.env.AI_API_KEY}`
    },
    body: JSON.stringify({
      model:
        process.env.AI_MODEL || "gpt-5",
      input: prompt
    })
  });

  if (!response.ok) {
    throw new Error(
      `AI request failed: ${response.status}`
    );
  }

  const data = await response.json();

  return {
    id: data.id || null,
    text: data.output_text || "",
    status: "COMPLETED"
  };
}
