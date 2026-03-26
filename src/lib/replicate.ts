import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

/**
 * Run LaMa inpainting to remove text from an image
 * @param imageBuffer - Original image as Buffer
 * @param maskBuffer - Mask (white = areas to inpaint) as Buffer
 * @param mimeType - Image MIME type
 * @param maxRetries - Number of retry attempts
 * @returns URL of the inpainted clean image
 */
export async function runLamaInpainting(
  imageBuffer: Buffer,
  maskBuffer: Buffer,
  mimeType: string,
  maxRetries: number = 2
): Promise<string> {
  const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  const base64Mask = `data:image/png;base64,${maskBuffer.toString('base64')}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[LaMa] Inpainting attempt ${attempt}/${maxRetries}...`);

      const output = await Promise.race([
        replicate.run(
          "yama-biko/lama-cleaner:e00dfedaa508a8a2d1d0ab9143df0bcf1480088cb39cf019eeb6f17eaf41dc2f",
          {
            input: {
              image: base64Image,
              mask: base64Mask,
              resolution: 768,
            },
          }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("LaMa timeout after 60s")), 60000)
        ),
      ]);

      console.log(`[LaMa] Inpainting succeeded on attempt ${attempt}`);
      return output as unknown as string;
    } catch (error) {
      console.error(`[LaMa] Attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        throw new Error(`LaMa inpainting failed after ${maxRetries} attempts: ${error}`);
      }
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error("LaMa inpainting failed unexpectedly");
}
