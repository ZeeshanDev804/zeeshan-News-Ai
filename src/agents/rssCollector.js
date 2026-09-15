export async function collectRSS(feedUrl) {
  if (!feedUrl) {
    throw new Error("Feed URL is required.");
  }

  const response = await fetch(feedUrl);

  if (!response.ok) {
    throw new Error(
      `Feed request failed: ${response.status}`
    );
  }

  const xml = await response.text();

  const items = [
    ...xml.matchAll(
      /<item[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/gi
    )
  ].map((match) => ({
    title: cleanXML(match[1]),
    url: cleanXML(match[2])
  }));

  return {
    feedUrl,
    items,
    count: items.length,
    status: "FEED_COLLECTED"
  };
}

function cleanXML(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .trim();
}
