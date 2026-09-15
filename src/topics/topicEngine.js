function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function createSlug(name) {
  return cleanText(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createTopicPage({
  name,
  type = "PERSON",
  category,
  description = ""
}) {
  const cleanName = cleanText(name);

  if (!cleanName) {
    throw new Error("Topic name is required.");
  }

  const slug = createSlug(cleanName);

  return {
    id: `topic_${Date.now()}`,
    name: cleanName,
    type,
    category: cleanText(category),
    description: cleanText(description),
    slug,
    path: `/topics/${slug}`,
    seo: {
      title: `${cleanName} — Latest News & Updates`,
      description: cleanText(
        description ||
          `Latest verified news, updates and useful coverage about ${cleanName}.`
      )
    },
    contentPolicy: {
      originalContentRequired: true,
      verifiedSourcesRequired: true,
      copyrightedMediaNotAllowed: true,
      fakeClaimsNotAllowed: true
    },
    status: "ACTIVE",
    createdAt: new Date().toISOString()
  };
}
