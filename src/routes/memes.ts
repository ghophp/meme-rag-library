import { Hono } from "hono";
import { extname } from "path";
import { getAllMemes, insertMeme, deleteMeme } from "../db";
import { describeImage, getEmbedding } from "../openai";

const memes = new Hono();

memes.get("/memes", async (c) => {
  const rows = await getAllMemes();
  return c.json(rows);
});

memes.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["image"];

  if (!file || typeof file === "string") {
    return c.json({ error: "No image file provided" }, 400);
  }

  if (!file.type.startsWith("image/")) {
    return c.json({ error: "File must be an image" }, 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: "File too large (max 10MB)" }, 400);
  }

  const ext = extname(file.name) || ".png";
  const filename = `${crypto.randomUUID()}${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await Bun.write(`./uploads/${filename}`, buffer);

    console.log("\n========== UPLOAD ==========");
    console.log(`File: ${file.name}`);

    const description = await describeImage(buffer, file.type);
    console.log(`Description: "${description}"`);

    const embedding = await getEmbedding(description);
    const preview = embedding.slice(0, 5).map((n) => n.toFixed(6)).join(", ");
    console.log(`Embedding: [${preview}, ...] (${embedding.length} dimensions)`);
    console.log("============================\n");

    const meme = await insertMeme(filename, file.name, description, embedding);

    return c.json(meme, 201);
  } catch (err) {
    // Clean up file if it was saved
    try {
      const f = Bun.file(`./uploads/${filename}`);
      if (await f.exists()) {
        const { unlink } = await import("node:fs/promises");
        await unlink(`./uploads/${filename}`);
      }
    } catch {}

    console.error("Upload failed:", err);
    return c.json({ error: "Failed to process image" }, 500);
  }
});

memes.delete("/memes/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  await deleteMeme(id);
  return c.json({ ok: true });
});

export default memes;
