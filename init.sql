CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memes (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    description TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memes_embedding_idx
    ON memes USING hnsw (embedding vector_cosine_ops);
