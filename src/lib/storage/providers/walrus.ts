import { fetchWithRetry, safeResponseText, StorageProviderError } from "@/lib/storage/http";
import type { StorageUploadInput, StorageUploadResult } from "@/lib/storage/types";

function normalizeWalrusUri(blobIdOrUrl: string): string {
  if (!blobIdOrUrl) {
    throw new StorageProviderError("Walrus response missing blob identifier", 502);
  }
  if (blobIdOrUrl.startsWith("http://") || blobIdOrUrl.startsWith("https://")) {
    return blobIdOrUrl;
  }
  const gateway = process.env.WALRUS_GATEWAY_BASE_URL;
  if (!gateway) {
    throw new StorageProviderError("WALRUS_GATEWAY_BASE_URL is not configured", 500);
  }
  return `${gateway.replace(/\/$/, "")}/${blobIdOrUrl}`;
}

function extractWalrusBlobRef(payload: any): string | null {
  return (
    payload?.url ??
    payload?.blobUrl ??
    payload?.blobID ??
    payload?.blobId ??
    payload?.id ??
    payload?.blob_id ??
    payload?.data?.blobId ??
    payload?.data?.blobID ??
    payload?.newlyCreated?.blobObject?.blobId ??
    payload?.newlyCreated?.blobObject?.blobID ??
    null
  );
}

async function uploadBlob(blob: Blob, filename: string): Promise<string> {
  const publisherUrl = process.env.WALRUS_PUBLISHER_URL;
  if (!publisherUrl) {
    throw new StorageProviderError("WALRUS_PUBLISHER_URL is not configured", 500);
  }

  const apiKey = process.env.WALRUS_API_KEY;
  const form = new FormData();
  form.append("file", blob, filename);

  const res = await fetchWithRetry(
    publisherUrl,
    {
      method: "POST",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      body: form,
    },
    { retries: 3 }
  );

  if (!res.ok) {
    throw new StorageProviderError(
      `Walrus upload failed (${res.status}): ${await safeResponseText(res)}`,
      res.status,
      res.status === 429 || res.status >= 500
    );
  }

  const payload = await res.json().catch(() => ({}));
  const blobRef = extractWalrusBlobRef(payload);
  if (!blobRef) {
    throw new StorageProviderError("Walrus upload succeeded but response had no blob reference", 502);
  }

  return normalizeWalrusUri(blobRef);
}

export async function uploadWithWalrus(input: StorageUploadInput): Promise<StorageUploadResult> {
  const imageUri = await uploadBlob(input.file, input.file.name || "image");

  const metadata = {
    name: input.name,
    description: input.description,
    image: imageUri,
    attributes: [],
  };

  const metadataBlob = new Blob([JSON.stringify(metadata)], {
    type: "application/json",
  });
  const metadataUri = await uploadBlob(metadataBlob, "metadata.json");

  return {
    provider: "walrus",
    imageUri,
    metadataUri,
  };
}
