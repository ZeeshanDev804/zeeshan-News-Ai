export function getAIStatus() {
  return {
    provider: process.env.AI_PROVIDER || "OPENAI",
    configured: Boolean(process.env.AI_API_KEY),
    status: process.env.AI_API_KEY
      ? "READY"
      : "NOT_CONFIGURED"
  };
}

export function createAIRequest(task, prompt) {
  if (!task || !prompt) {
    throw new Error("Task and prompt are required.");
  }

  return {
    id: `ai_${Date.now()}`,
    task,
    prompt,
    status: "QUEUED",
    createdAt: new Date().toISOString()
  };
}
