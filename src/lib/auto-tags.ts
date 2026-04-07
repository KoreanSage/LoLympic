import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";

let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

interface AutoTagInput {
  postId: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
}

/**
 * Generate tags for a post using Gemini AI.
 * Analyzes title, body, and optionally the image to produce relevant tags.
 * Updates the post in the database with generated tags.
 */
export async function generateAutoTags({ postId, title, body, imageUrl }: AutoTagInput): Promise<string[]> {
  const ai = getGenAI();

  const parts: any[] = [];

  // System prompt
  parts.push({
    text: `You are a meme tag generator. Given a meme's title, optional description, and optional image, generate 3-5 relevant tags.

Rules:
- Tags must be lowercase, single words or short phrases (max 2 words)
- No hashtags, no special characters
- Tags should describe the humor style, topic, or emotion
- Choose from common meme categories when applicable: funny, relatable, wholesome, cringe, cursed, gaming, animals, sports, politics, food, work, school, relationship, tech, anime, kpop, movie, music, trending
- Also include specific topic tags based on the actual content
- Return ONLY a JSON array of strings, nothing else

Example output: ["funny","relatable","work","monday mood"]`,
  });

  // Content
  let contentText = `Title: ${title}`;
  if (body) contentText += `\nDescription: ${body}`;
  parts.push({ text: contentText });

  // Try to include image for better analysis
  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
        parts.push({
          inlineData: { mimeType, data: base64 },
        });
      }
    } catch {
      // Skip image if fetch fails — still generate tags from text
    }
  }

  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 200,
    },
  });

  const text = result.response.text().trim();

  // Parse JSON array from response
  let tags: string[] = [];
  try {
    // Handle markdown code blocks
    const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      tags = parsed
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.toLowerCase().trim())
        .filter((t) => t.length > 0 && t.length <= 50)
        .slice(0, 5);
    }
  } catch {
    // If JSON parse fails, try comma-separated fallback
    const cleaned = text.replace(/[\[\]"']/g, "");
    tags = cleaned
      .split(",")
      .map((t) => t.toLowerCase().trim())
      .filter((t) => t.length > 0 && t.length <= 50)
      .slice(0, 5);
  }

  if (tags.length === 0) return [];

  // Update the post with generated tags
  await prisma.post.update({
    where: { id: postId },
    data: { tags },
  });

  return tags;
}
