import OpenAI from "openai";
import sharp from "sharp";

const openai = new OpenAI();

const MAX_GIF_FRAMES = 8;

async function extractGifFrames(imageBuffer: Buffer): Promise<Buffer[]> {
  const metadata = await sharp(imageBuffer).metadata();
  const totalFrames = metadata.pages ?? 1;

  if (totalFrames <= 1) return [imageBuffer];

  const frameIndices: number[] = [];
  for (let i = 0; i < Math.min(MAX_GIF_FRAMES, totalFrames); i++) {
    frameIndices.push(Math.round(i * (totalFrames - 1) / (Math.min(MAX_GIF_FRAMES, totalFrames) - 1)));
  }

  const frames: Buffer[] = [];
  for (const page of frameIndices) {
    const frame = await sharp(imageBuffer, { page })
      .png()
      .toBuffer();
    frames.push(frame);
  }
  return frames;
}

export async function describeImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const isGif = mimeType === "image/gif";
  const frames = isGif ? await extractGifFrames(imageBuffer) : [];
  const isAnimated = frames.length > 1;

  const imageContent: OpenAI.ChatCompletionContentPart[] = [];

  if (isAnimated) {
    imageContent.push({
      type: "text",
      text: `Analyze this animated meme GIF. I'm showing you ${frames.length} frames in sequence from the animation. Pay close attention to how the person's hands, body, and expression CHANGE across the frames — the motion tells the story.

Answer these questions in a single paragraph:
- What GESTURE or ACTION is being performed across the frames? Describe the full motion arc precisely — where do the hands start, where do they end, what does the face do?
- What reaction, emotion, or situation does this gesture express?
- If someone wanted to find this meme, what would they search for? Only suggest search terms that PRECISELY match the gesture and emotion shown — do not add tangentially related terms.
- When and why would someone send this meme?

Write a single natural paragraph. Do NOT use bullet points, headers, or numbered lists. Do NOT guess a meme name if you are not confident — just describe its intent.`,
    });
    for (let i = 0; i < frames.length; i++) {
      const base64 = frames[i].toString("base64");
      imageContent.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64}`, detail: "low" },
      });
    }
  } else {
    imageContent.push({
      type: "text",
      text: `Analyze this meme image. Your description must focus on the meme's PURPOSE and MEANING, not just what you see visually.

Answer these questions in a single paragraph:
- If someone wanted to find this meme, what would they search for?
- What reaction, emotion, or situation does this meme express?
- When and why would someone send this meme?
- What are the key visual elements?

Write a single natural paragraph. Do NOT use bullet points, headers, or numbered lists. Do NOT guess a meme name if you are not confident — just describe its intent.`,
    });
    const base64 = imageBuffer.toString("base64");
    imageContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64}`, detail: "low" },
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: imageContent }],
    max_tokens: 500,
  });

  return response.choices[0].message.content!;
}

export async function expandQuery(query: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `You are a meme expert. Given a short search query, describe the GENERAL concept, emotion, and reaction that memes matching this query express. Do NOT describe one specific meme — instead describe what ALL memes of this type have in common: the feeling they convey, the situations they're used in, the types of visual elements they share (expressions, gestures, effects), and the internet culture context. Write a single concise paragraph.`,
      },
      {
        role: "user",
        content: query,
      },
    ],
    max_tokens: 500,
  });

  return response.choices[0].message.content!;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}
