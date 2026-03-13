import { Hono } from "hono";
import { searchMemes, keywordSearchMemes, debugTopMemes, SIMILARITY_THRESHOLD, type Meme } from "../db";
import { getEmbedding, expandQuery } from "../openai";

const search = new Hono();

search.get("/search", async (c) => {
  const query = c.req.query("q");
  if (!query) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

  const useHyde = c.req.query("hyde") === "1";
  const useKeyword = c.req.query("keyword") === "1";

  console.log("\n========== SEARCH ==========");
  console.log(`Original query: "${query}"`);
  console.log(`Options: hyde=${useHyde}, keyword=${useKeyword}`);

  // Always embed the raw query
  const rawEmbedding = await getEmbedding(query);

  // Debug: show closest matches regardless of threshold
  const debugResults = await debugTopMemes(rawEmbedding, 5);
  console.log("Closest matches (no threshold):");
  for (const r of debugResults) {
    console.log(`  - [${(Number(r.similarity) * 100).toFixed(1)}%] ${r.original_name}`);
  }

  const rawResults = await searchMemes(rawEmbedding);

  const bestById = new Map<number, Meme>();
  for (const r of rawResults) {
    bestById.set(r.id, r);
  }

  // Optional: HyDE expansion
  if (useHyde) {
    const expanded = await expandQuery(query);
    console.log(`Expanded query: "${expanded}"`);
    const expandedEmbedding = await getEmbedding(expanded);
    const expandedResults = await searchMemes(expandedEmbedding);
    for (const r of expandedResults) {
      const existing = bestById.get(r.id);
      if (!existing || Number(r.similarity) > Number(existing.similarity)) {
        bestById.set(r.id, r);
      }
    }
  }

  // Optional: Keyword search
  if (useKeyword) {
    const keywordResults = await keywordSearchMemes(query);
    console.log(`Keyword matches: ${keywordResults.length}`);
    for (const r of keywordResults) {
      const existing = bestById.get(r.id);
      if (!existing || Number(r.similarity) > Number(existing.similarity)) {
        bestById.set(r.id, r);
      }
    }
  }

  const results = [...bestById.values()].sort(
    (a, b) => Number(b.similarity) - Number(a.similarity)
  );

  console.log(`Similarity threshold: ${SIMILARITY_THRESHOLD}`);
  console.log(`Results found: ${results.length}`);
  for (const r of results) {
    console.log(`  - [${(Number(r.similarity) * 100).toFixed(1)}% match] ${r.original_name}`);
  }
  console.log("============================\n");

  return c.json(results);
});

export default search;
