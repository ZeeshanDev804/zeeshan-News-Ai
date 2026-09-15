import { researchWithAI } from "./aiResearchAgent.js";

export async function researchSafeItem(screenedItem) {
  if (!screenedItem) {
    throw new Error("Screened item is required.");
  }

  if (screenedItem.status !== "CLEARED") {
    return {
      status: "BLOCKED",
      reason: "Item requires safety review."
    };
  }

  return researchWithAI({
    topic: screenedItem.item.title,
    region: "GLOBAL"
  });
}
