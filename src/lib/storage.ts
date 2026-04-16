/**
 * Storage helper — uploads to Cloudflare R2 (the production backend).
 *
 * The project previously supported Vercel Blob as a fallback, but R2 is now
 * the single source of truth for persistent media. In dev, when R2 env vars
 * are missing, callers are expected to handle local-disk fallback themselves.
 */
import type { S3Client as S3ClientType } from "@aws-sdk/client-s3";

/** Returns true when all four R2 env vars are present. */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT &&
    process.env.R2_BUCKET_NAME
  );
}

let cachedClient: S3ClientType | null = null;

/** Lazy-load the S3 client so cold starts don't pull aws-sdk on routes that
 * never upload. */
export async function getR2Client(): Promise<S3ClientType | null> {
  if (!isR2Configured()) return null;
  if (cachedClient) return cachedClient;
  const { S3Client } = await import("@aws-sdk/client-s3");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return cachedClient;
}

/**
 * Upload a buffer to R2 and return its public URL, or `null` if R2 isn't
 * configured (e.g. local dev). Callers should fall back to disk in that case.
 */
export async function uploadBufferToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
  cacheControl: string = "public, max-age=31536000, immutable"
): Promise<string | null> {
  const s3 = await getR2Client();
  if (!s3) return null;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL is not configured");
  }
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return `${publicUrl}/${key}`;
}

/**
 * Delete an object from R2 by its public URL. No-op if R2 isn't configured
 * or URL doesn't belong to R2. Errors are swallowed (best-effort cleanup).
 */
export async function deleteFromR2(publicUrl: string): Promise<void> {
  const r2PublicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!r2PublicBase || !publicUrl.startsWith(r2PublicBase)) return;
  const s3 = await getR2Client();
  if (!s3) return;
  const key = publicUrl.slice(r2PublicBase.length + 1); // strip base + "/"
  try {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    }));
  } catch {
    // best-effort — don't break the caller
  }
}
