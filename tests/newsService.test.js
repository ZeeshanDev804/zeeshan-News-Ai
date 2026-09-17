import assert from "node:assert/strict";
import test from "node:test";

import {
  getLatestNews,
  getNewsCount,
  searchNews,
} from "../src/lib/newsService.js";

// =============================
// MOCK DATABASE
// =============================

function createMockDb() {
  const calls = [];

  const db = {
    calls,

    async query(sql, params = []) {
      calls.push({
        sql,
        params,
      });

      if (sql.includes("COUNT(*)")) {
        return {
          rows: [
            {
              total: "5",
            },
          ],
        };
      }

      if (sql.includes("ILIKE")) {
        return {
          rows: [
            {
              id: 1,
              title: "Test News Article",
              link: "https://example.com/test",
              content: "Test news content",
              source: "Test Source",
              published_at: new Date(),
            },
          ],
        };
      }

      return {
        rows: [
          {
            id: 1,
            title: "Latest Test News",
            link: "https://example.com/latest",
            content: "Latest news content",
            source: "Test Source",
            published_at: new Date(),
          },
        ],
      };
    },
  };

  return db;
}

// =============================
// TEST 1 — LATEST NEWS
// =============================

test("getLatestNews returns news articles", async () => {
  const db = createMockDb();

  const articles = await getLatestNews(db, 10);

  assert.equal(Array.isArray(articles), true);
  assert.equal(articles.length, 1);
  assert.equal(
    articles[0].title,
    "Latest Test News"
  );
});

// =============================
// TEST 2 — NEWS COUNT
// =============================

test("getNewsCount returns total news count", async () => {
  const db = createMockDb();

  const total = await getNewsCount(db);

  assert.equal(total, 5);
});

// =============================
// TEST 3 — NEWS SEARCH
// =============================

test("searchNews returns matching articles", async () => {
  const db = createMockDb();

  const articles = await searchNews(
    db,
    "technology",
    10
  );

  assert.equal(Array.isArray(articles), true);
  assert.equal(articles.length, 1);
  assert.equal(
    articles[0].title,
    "Test News Article"
  );
});

// =============================
// TEST 4 — EMPTY SEARCH
// =============================

test("searchNews returns empty array for empty query", async () => {
  const db = createMockDb();

  const articles = await searchNews(
    db,
    "",
    10
  );

  assert.deepEqual(articles, []);
});
