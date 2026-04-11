// ---------------------------------------------------------------------------
// QStash wrapper — publish translation jobs to Upstash QStash
// Signature verification uses Receiver for incoming webhook requests
// ---------------------------------------------------------------------------
import { Client, Receiver } from "@upstash/qstash";

let _qstashClient: Client | null = null;
export function getQstashClient(): Client {
  if (!_qstashClient) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) throw new Error("QSTASH_TOKEN is not configured");
    _qstashClient = new Client({ token });
  }
  return _qstashClient;
}

let _qstashReceiver: Receiver | null = null;
export function getQstashReceiver(): Receiver {
  if (!_qstashReceiver) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentKey || !nextKey) {
      throw new Error("QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY not configured");
    }
    _qstashReceiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    });
  }
  return _qstashReceiver;
}

export interface TranslationJobPayload {
  postId: string;
  sourceLanguage: string;
  targetLanguage: string;
  payloadId: string;
}

/**
 * Publishes a translation job to QStash for async processing.
 * The worker endpoint must be publicly accessible at QSTASH_WORKER_URL.
 *
 * Uses deduplicationId to prevent duplicate jobs for the same payload row.
 */
export async function publishTranslationJob(body: TranslationJobPayload): Promise<string | null> {
  const workerUrl = process.env.QSTASH_WORKER_URL;
  if (!workerUrl) {
    throw new Error("QSTASH_WORKER_URL is not configured");
  }

  try {
    const client = getQstashClient();
    const result = await client.publishJSON({
      url: workerUrl,
      body,
      retries: 2,
      // Native dedupe — if the same payloadId is published twice within
      // the QStash dedupe window, the second one is discarded.
      deduplicationId: `translate:${body.payloadId}`,
    });
    return (result as { messageId?: string })?.messageId || null;
  } catch (err) {
    console.error("[QStash] Failed to publish translation job:", err);
    throw err;
  }
}

/**
 * Verifies an incoming QStash webhook request signature.
 * Throws if the signature is invalid or missing.
 */
export async function verifyQstashSignature(
  signature: string | null,
  bodyText: string
): Promise<void> {
  if (!signature) {
    throw new Error("Missing Upstash-Signature header");
  }
  const receiver = getQstashReceiver();
  const valid = await receiver.verify({ signature, body: bodyText });
  if (!valid) {
    throw new Error("Invalid QStash signature");
  }
}
