import { fetchNews } from "../src/lib/rssFetcher.js";

async function runTest() {
  console.log("🧪 RSS TEST STARTED");

  try {
    const news = await fetchNews();

    console.log(`📊 News items received: ${news.length}`);

    if (!Array.isArray(news)) {
      throw new Error("RSS result is not an array");
    }

    if (news.length === 0) {
      throw new Error("No news was fetched");
    }

    const first = news[0];

    if (!first.title) {
      throw new Error("News title is missing");
    }

    if (!first.link) {
      throw new Error("News link is missing");
    }

    if (!first.source) {
      throw new Error("News source is missing");
    }

    console.log("✅ RSS TEST PASSED");
    console.log(`📰 First headline: ${first.title}`);
    console.log(`🔗 Link: ${first.link}`);
    console.log(`📡 Source: ${first.source}`);
  } catch (error) {
    console.error("❌ RSS TEST FAILED");
    console.error(error.message);

    process.exitCode = 1;
  }
}

runTest();
