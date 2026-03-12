import { Hono } from "hono";
import { searchMemes, keywordSearchMemes, SIMILARITY_THRESHOLD, type Meme } from "../db";
import { getEmbedding, expandQuery } from "../openai";

const search = new Hono();

search.get("/search", async (c) => {
  const query = c.req.query("q");
  if (!query) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

  console.log("\n========== SEARCH ==========");
  console.log(`Original query: "${query}"`);

  // Run all searches in parallel: raw vector, expanded vector, keyword
  const [rawEmbedding, expandedQuery, keywordResults] = await Promise.all([
    getEmbedding(query),
    expandQuery(query),
    keywordSearchMemes(query),
  ]);
  console.log(`Expanded query: "${expandedQuery}"`);
  console.log(`Keyword matches: ${keywordResults.length}`);

  const expandedEmbedding = await getEmbedding(expandedQuery);

  const [rawResults, expandedResults] = await Promise.all([
    searchMemes(rawEmbedding),
    searchMemes(expandedEmbedding),
  ]);

  // Merge: keep best similarity per meme, keyword matches get boosted
  const bestById = new Map<number, Meme>();
  const keywordIds = new Set(keywordResults.map((r) => r.id));

  for (const r of [...rawResults, ...expandedResults, ...keywordResults]) {
    const existing = bestById.get(r.id);
    if (!existing || Number(r.similarity) > Number(existing.similarity)) {
      bestById.set(r.id, r);
    }
  }

  const results = [...bestById.values()].sort(
    (a, b) => Number(b.similarity) - Number(a.similarity)
  );

  console.log(`Results found: ${results.length} (raw: ${rawResults.length}, expanded: ${expandedResults.length}, keyword: ${keywordResults.length})`);
  for (const r of results) {
    const kw = keywordIds.has(r.id) ? " [KW]" : "";
    console.log(`  - [${(Number(r.similarity) * 100).toFixed(1)}% match]${kw} ${r.original_name}`);
  }
  console.log("============================\n");

  return c.json(results);
});

export default search;
