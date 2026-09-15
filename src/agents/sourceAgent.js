const sources = [];

export function addSource({
  name,
  url,
  region = "GLOBAL",
  category = "World"
}) {
  if (!name || !url) {
    throw new Error("Source name and URL are required.");
  }

  const source = {
    id: `source_${Date.now()}`,
    name: name.trim(),
    url: url.trim(),
    region,
    category,
    status: "ACTIVE",
    reliability: "PENDING",
    createdAt: new Date().toISOString()
  };

  sources.push(source);

  return source;
}

export function getSources() {
  return [...sources];
}

export function updateSourceReliability(
  sourceId,
  reliability
) {
  const source = sources.find(
    (item) => item.id === sourceId
  );

  if (!source) {
    throw new Error("Source not found.");
  }

  source.reliability = reliability;
  source.updatedAt = new Date().toISOString();

  return source;
}

export function disableSource(sourceId) {
  const source = sources.find(
    (item) => item.id === sourceId
  );

  if (!source) {
    throw new Error("Source not found.");
  }

  source.status = "DISABLED";

  return source;
}
