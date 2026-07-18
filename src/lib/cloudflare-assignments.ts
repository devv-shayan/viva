import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const required = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
] as const;

function config() {
  const values = Object.fromEntries(required.map((key) => [key, process.env[key]?.trim()]));
  const missing = required.filter((key) => !values[key]);
  if (missing.length) throw new Error(`Missing Cloudflare configuration: ${missing.join(", ")}`);
  return values as Record<(typeof required)[number], string>;
}

function r2Client(settings: Record<(typeof required)[number], string>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${settings.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: settings.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY },
  });
}

export function createAssignmentKey(fileName: string, id = crypto.randomUUID()) {
  return `assignments/${id}/${fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
}

export async function storeAssignmentFile(input: { body: Uint8Array; contentType: string; key: string }) {
  const settings = config();
  const client = r2Client(settings);
  await client.send(
    new PutObjectCommand({
      Bucket: settings.CLOUDFLARE_R2_BUCKET,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}
export async function createAssignmentUpload(input: { fileName: string; contentType: string }) {
  const settings = config();
  const key = createAssignmentKey(input.fileName);
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${settings.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: settings.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY },
  });
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: settings.CLOUDFLARE_R2_BUCKET, Key: key, ContentType: input.contentType }), { expiresIn: 300 });
  return { key, uploadUrl };
}

export async function queryAssignments<T>(sql: string, params: unknown[] = []) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !databaseId || !token) throw new Error("Missing Cloudflare D1 configuration.");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sql, params }), cache: "no-store" });
  const payload = await response.json() as { success: boolean; result?: Array<{ results?: T[]; error?: string }>; errors?: Array<{ message?: string }> };
  if (!response.ok || !payload.success) throw new Error(payload.errors?.[0]?.message || payload.result?.[0]?.error || "Cloudflare D1 request failed.");
  return payload.result?.[0]?.results ?? [];
}
