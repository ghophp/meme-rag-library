import postgres from "postgres";
import { toSql } from "pgvector";

const sql = postgres(process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/memerag");

export { sql };

export interface Meme {
  id: number;
  filename: string;
  original_name: string;
  description: string;
  similarity?: number;
  created_at: string;
}

export async function getAllMemes(): Promise<Meme[]> {
  const rows = await sql`
    SELECT id, filename, original_name, description, created_at
    FROM memes
    ORDER BY created_at DESC
  `;
  return rows as unknown as Meme[];
}

export async function insertMeme(
  filename: string,
  originalName: string,
  description: string,
  embedding: number[]
): Promise<Meme> {
  const vectorStr = toSql(embedding);
  const rows = await sql`
    INSERT INTO memes (filename, original_name, description, embedding)
    VALUES (${filename}, ${originalName}, ${description}, ${vectorStr}::vector)
    RETURNING id, filename, original_name, description, created_at
  `;
  return rows[0] as unknown as Meme;
}

export const SIMILARITY_THRESHOLD = 0.5;

export async function searchMemes(embedding: number[], limit: number = 20): Promise<Meme[]> {
  const vectorStr = toSql(embedding);
  const rows = await sql`
    SELECT id, filename, original_name, description, created_at,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM memes
    WHERE 1 - (embedding <=> ${vectorStr}::vector) >= ${SIMILARITY_THRESHOLD}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;
  return rows as unknown as Meme[];
}

export async function keywordSearchMemes(query: string, limit: number = 20): Promise<Meme[]> {
  const pattern = `%${query}%`;
  const rows = await sql`
    SELECT id, filename, original_name, description, created_at,
           1.0 AS similarity
    FROM memes
    WHERE description ILIKE ${pattern}
    LIMIT ${limit}
  `;
  return rows as unknown as Meme[];
}

export async function debugTopMemes(embedding: number[], limit: number = 5): Promise<Meme[]> {
  const vectorStr = toSql(embedding);
  const rows = await sql`
    SELECT id, filename, original_name, description, created_at,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM memes
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;
  return rows as unknown as Meme[];
}

export async function deleteMeme(id: number): Promise<void> {
  await sql`DELETE FROM memes WHERE id = ${id}`;
}
