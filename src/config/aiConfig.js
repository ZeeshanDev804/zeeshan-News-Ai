export const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || "OPENAI",
  model: process.env.AI_MODEL || "DEFAULT",
  enabled: Boolean(process.env.AI_API_KEY),
  maxTokens: 2000,
  temperature: 0.3
};

export function getAIConfig() {
  return {
    provider: AI_CONFIG.provider,
    model: AI_CONFIG.model,
    enabled: AI_CONFIG.enabled
  };
}
