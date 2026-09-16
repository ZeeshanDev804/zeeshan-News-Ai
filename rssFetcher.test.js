import { fetchAndSaveNews } from "../src/lib/rssFetcher.js";

async function runTest() {
  console.log("🧪 RSS TEST STARTED");

  const fakeDb = {
    query: async () => {
      return {
        rowCount: 1,
      };
    },
  };

  try {
    const result = await fetchAndSaveNews(fakeDb);

    if (!result || result.success !== true) {
      throw new Error("RSS fetch/save failed");
    }

    console.log(`📊 News items saved: ${result.saved}`);

    console.log("✅ RSS TEST PASSED");
    console.log("📰 RSS fetching and database-save logic completed");
  } catch (error) {
    console.error("❌ RSS TEST FAILED");
    console.error(error.message);

    process.exitCode = 1;
  }
}

runTest();