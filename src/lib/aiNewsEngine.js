function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(title = "", content = "") {
  const text = `${title} ${content}`.toLowerCase();

  const categories = {
    sports: [
      "football",
      "cricket",
      "tennis",
      "match",
      "player",
      "team",
      "championship",
    ],
    technology: [
      "ai",
      "artificial intelligence",
      "software",
      "technology",
      "google",
      "apple",
      "microsoft",
      "cyber",
    ],
    business: [
      "business",
      "market",
      "company",
      "economy",
      "stock
