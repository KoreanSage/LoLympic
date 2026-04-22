/**
 * Diagnose and fix R2 bucket CORS.
 *
 * Usage: npx tsx scripts/check-r2-cors.ts [--fix]
 *
 * Without --fix: prints the current CORS configuration.
 * With --fix:    applies the CORS rules the app needs for canvas image loads
 *                (crossOrigin="anonymous") and verifies by fetching the
 *                configured rules back.
 */

import {
  S3Client,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const required = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const bucket = process.env.R2_BUCKET_NAME!;
const publicUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const desiredRules = [
  {
    AllowedOrigins: ["*"],
    AllowedMethods: ["GET", "HEAD"],
    AllowedHeaders: ["*"],
    ExposeHeaders: ["Content-Length", "Content-Type"],
    MaxAgeSeconds: 86400,
  },
];

async function getCurrentCors() {
  try {
    const res = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    return res.CORSRules ?? [];
  } catch (err: unknown) {
    const e = err as { name?: string; Code?: string; message?: string };
    if (e.name === "NoSuchCORSConfiguration" || e.Code === "NoSuchCORSConfiguration") {
      return null;
    }
    throw err;
  }
}

async function putCors() {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: desiredRules },
    })
  );
}

async function pickSampleKey(): Promise<string | null> {
  const res = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: "uploads/", MaxKeys: 1 })
  );
  return res.Contents?.[0]?.Key ?? null;
}

async function verifyPublicCors(key: string) {
  const url = `${publicUrl}/${key}`;
  const origin = "https://mimzy.gg";
  const res = await fetch(url, { method: "HEAD", headers: { Origin: origin } });
  const acao = res.headers.get("access-control-allow-origin");
  return { url, status: res.status, acao };
}

async function main() {
  const fix = process.argv.includes("--fix");

  console.log(`Bucket: ${bucket}`);
  console.log(`Public URL: ${publicUrl}`);
  console.log("");

  console.log("Current CORS config:");
  const current = await getCurrentCors();
  if (current === null) {
    console.log("  (none)");
  } else {
    console.log(JSON.stringify(current, null, 2));
  }
  console.log("");

  if (fix) {
    console.log("Applying CORS...");
    await putCors();
    const after = await getCurrentCors();
    console.log("After put:");
    console.log(JSON.stringify(after, null, 2));
    console.log("");
  }

  console.log("Verifying public URL returns Access-Control-Allow-Origin...");
  const sample = await pickSampleKey();
  if (!sample) {
    console.log("  No uploads/* objects in bucket to test.");
    return;
  }
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: sample }));
  } catch (err) {
    console.log(`  Could not HEAD ${sample} via S3 API:`, err);
    return;
  }
  const v = await verifyPublicCors(sample);
  console.log(`  URL:    ${v.url}`);
  console.log(`  Status: ${v.status}`);
  console.log(`  ACAO:   ${v.acao ?? "(missing!)"}`);

  if (!v.acao) {
    console.log("");
    console.log("ACAO header is missing. Next steps:");
    console.log("  - If you haven't yet, re-run with --fix.");
    console.log("  - If --fix already ran, Cloudflare may take ~30s to propagate.");
    console.log("  - Confirm the bucket's public r2.dev access is enabled in the Cloudflare dashboard.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Script failed:");
  console.error(err);
  process.exit(1);
});
