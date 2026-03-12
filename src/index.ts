import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mkdir } from "node:fs/promises";

import memeRoutes from "./routes/memes";
import searchRoutes from "./routes/search";

await mkdir("./uploads", { recursive: true });

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// API routes
app.route("/api", memeRoutes);
app.route("/api", searchRoutes);

// Serve uploaded images
app.use("/uploads/*", serveStatic({ root: "./" }));

// Serve frontend
app.use("/*", serveStatic({ root: "./public" }));

console.log(`Meme RAG Library running on http://localhost:${process.env.PORT || 3000}`);

export default {
  port: parseInt(process.env.PORT || "3000"),
  fetch: app.fetch,
};
