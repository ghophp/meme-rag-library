import { Hono } from "hono";
import { searchMemes, SIMILARITY_THRESHOLD } from "../db";
import { getEmbedding, expandQuery } from "../openai";

const search = new Hono();

function formatVector(v: number[]): string {
  const preview = v.slice(0, 5).map((n) => n.toFixed(6)).join(", ");
  return `[${preview}, ...] (${v.length} dimensions)`;
}

search.get("/search", async (c) => {
  const query = c.req.query("q");
  if (!query) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

  console.log("\n========== SEARCH ==========");
  console.log(`Original query: "${query}"`);

  // Step 1: Expand the query into a meme-like description (HyDE)
  const expandedQuery = await expandQuery(query);
  console.log(`Expanded query: "${expandedQuery}"`);

  // Step 2: Embed original query + expanded description together
  const combinedQuery = `${query}\n\n${expandedQuery}`;
  console.log(`Combined query: "${combinedQuery}"`);
  const queryEmbedding = await getEmbedding(combinedQuery);
  console.log(`Query embedding: ${formatVector(queryEmbedding)}`);
  console.log(`Similarity threshold: ${SIMILARITY_THRESHOLD}`);

  // Step 3: Search with threshold
  const results = await searchMemes(queryEmbedding);

  console.log(`Results found: ${results.length}`);
  for (const r of results) {
    console.log(`  - [${(Number(r.similarity) * 100).toFixed(1)}% match] ${r.original_name}`);
  }
  console.log("============================\n");

  return c.json(results);
});

export default search;
