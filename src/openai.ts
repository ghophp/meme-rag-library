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

  const prompt = `You are a meme encyclopedia with deep knowledge of internet culture. Your job is to identify this meme and produce search terms that will help people find it.

Output ONLY a comma-separated list of 10-15 search terms/phrases. Include:
- The meme's well-known name (e.g. "Confused Travolta", "Roll Safe Think About It")
- The person's real name and character name if applicable
- Associated catchphrases or caption templates
- The emotion/reaction it expresses
- The physical gesture or action shown
- Common situations people use it for

Be confident — you know these memes. Output nothing except the comma-separated terms.${isAnimated ? `\n\nThis is an animated GIF. I'm showing you ${frames.length} frames in sequence — pay attention to the motion.` : ""}`;

  const imageContent: OpenAI.ChatCompletionContentPart[] = [
    { type: "text", text: prompt },
  ];

  if (isAnimated) {
    for (const frame of frames) {
      const base64 = frame.toString("base64");
      imageContent.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64}`, detail: "auto" },
      });
    }
  } else {
    const base64 = imageBuffer.toString("base64");
    imageContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64}`, detail: "auto" },
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: imageContent }],
    max_tokens: 200,
  });

  return response.choices[0].message.content!;
}

export async function expandQuery(query: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content:
          `Given a meme search query, output 8-10 comma-separated synonyms, related emotions, gestures, and situations. Do NOT include specific meme names, character names, or actor names — only generic descriptive terms. Output ONLY the comma-separated terms, nothing else.`,
      },
      {
        role: "user",
        content: query,
      },
    ],
    max_tokens: 200,
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
