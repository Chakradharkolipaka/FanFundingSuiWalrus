import { NextResponse } from "next/server";
import { getStorageProviderName, uploadWithProvider } from "@/lib/storage/providers";
import { StorageProviderError } from "@/lib/storage/http";

export const runtime = "nodejs";

const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const DEFAULT_MAX_UPLOAD_MB = 10;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 20;

const memoryRateLimit = new Map<string, { count: number; resetAt: number }>();

function getTraceId() {
  return `stor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getClientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function checkRateLimit(req: Request): { limited: boolean; remaining: number } {
  const maxReq = Number(process.env.STORAGE_RATE_LIMIT_MAX || DEFAULT_MAX_REQUESTS);
  const windowMs = Number(process.env.STORAGE_RATE_LIMIT_WINDOW_MS || DEFAULT_WINDOW_MS);
  const key = getClientIp(req);
  const now = Date.now();

  const existing = memoryRateLimit.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: maxReq - 1 };
  }

  existing.count += 1;
  memoryRateLimit.set(key, existing);

  if (existing.count > maxReq) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: Math.max(0, maxReq - existing.count) };
}

function isAuthRequired() {
  return String(process.env.STORAGE_REQUIRE_AUTH || "false").toLowerCase() === "true";
}

function isAuthAllowed(req: Request) {
  if (!isAuthRequired()) return true;
  const expected = process.env.STORAGE_AUTH_TOKEN;
  if (!expected) return false;
  const actual = req.headers.get("x-storage-auth");
  return actual === expected;
}

export async function POST(req: Request) {
  const traceId = getTraceId();
  const startedAt = Date.now();
  const provider = getStorageProviderName(process.env);

  try {
    if (!isAuthAllowed(req)) {
      return NextResponse.json({ error: "Unauthorized", traceId }, { status: 401 });
    }

    const rl = checkRateLimit(req);
    if (rl.limited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please retry shortly.", traceId },
        { status: 429 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file", traceId }, { status: 400 });
    }
    if (!name || !description) {
      return NextResponse.json({ error: "Missing name/description", traceId }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}`, traceId },
        { status: 400 }
      );
    }

    const maxBytes = Number(process.env.STORAGE_MAX_UPLOAD_MB || DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File exceeds max size (${maxBytes / (1024 * 1024)} MB)`, traceId },
        { status: 400 }
      );
    }

    const result = await uploadWithProvider(provider, {
      file,
      name,
      description,
      traceId,
    });

    const durationMs = Date.now() - startedAt;
    console.info(
      `[storage.upload] traceId=${traceId} provider=${result.provider} status=success durationMs=${durationMs}`
    );

    return NextResponse.json({
      provider: result.provider,
      imageUri: result.imageUri,
      metadataUri: result.metadataUri,
    });
  } catch (e: any) {
    const durationMs = Date.now() - startedAt;
    const status = e instanceof StorageProviderError ? Math.min(599, Math.max(400, e.statusCode)) : 500;
    const message = e instanceof Error ? e.message : "Storage upload failed";

    console.error(
      `[storage.upload] traceId=${traceId} provider=${provider} status=error http=${status} durationMs=${durationMs} message=${message}`
    );

    return NextResponse.json({ error: message, traceId }, { status });
  }
}
