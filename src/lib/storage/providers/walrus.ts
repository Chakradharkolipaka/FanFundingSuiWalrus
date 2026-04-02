
import type { StorageUploadInput, StorageUploadResult } from "@/lib/storage/types";

// Runtime validation for env variables
const publisherUrl = process.env.WALRUS_PUBLISHER_URL;
if (!publisherUrl || !/^https?:\/\/.+\/.+/.test(publisherUrl)) {
  throw new Error(
    "WALRUS_PUBLISHER_URL must be a full upload endpoint, e.g. https://publisher.walrus-testnet.walrus.space/v1/store"
  );
}
const gatewayBase = process.env.WALRUS_GATEWAY_BASE_URL;
if (!gatewayBase || !/^https?:\/\/.+\/.+/.test(gatewayBase)) {
  throw new Error(
    "WALRUS_GATEWAY_BASE_URL must include a path component, e.g. https://aggregator.walrus-testnet.walrus.space/v1"
  );
}

/**
 * Uploads a file to Walrus storage and returns StorageUploadResult shape.
 */
export async function uploadWithWalrus(input: StorageUploadInput): Promise<StorageUploadResult> {
  // Convert File to Buffer
  const fileBuffer = Buffer.from(await input.file.arrayBuffer());
  const contentType = input.file.type || "application/octet-stream";
  const epochs = 5;
  // Upload image
  const url = `${publisherUrl}?epochs=${epochs}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileBuffer.length),
    },
    body: fileBuffer as any,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Walrus ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text);
  const blobId: string =
    data?.newlyCreated?.blobObject?.blobId ||
    data?.newlyCreated?.blob_object?.blob_id ||
    data?.alreadyCertified?.blobId ||
    data?.alreadyCertified?.blob_id;
  if (!blobId) {
    throw new Error("No blobId in response: " + JSON.stringify(data));
  }
  const imageUri = `${gatewayBase}/${blobId}`;
  // Compose metadata
  const metadata = {
    name: input.name,
    description: input.description,
    image: imageUri,
    attributes: [],
  };
  const metadataBuffer = Buffer.from(JSON.stringify(metadata));
  const metaRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(metadataBuffer.length),
    },
    body: metadataBuffer as any,
  });
  const metaText = await metaRes.text();
  if (!metaRes.ok) {
    throw new Error(`Walrus metadata upload failed (${metaRes.status}): ${metaText.slice(0, 300)}`);
  }
  const metaData = JSON.parse(metaText);
  const metaBlobId: string =
    metaData?.newlyCreated?.blobObject?.blobId ||
    metaData?.newlyCreated?.blob_object?.blob_id ||
    metaData?.alreadyCertified?.blobId ||
    metaData?.alreadyCertified?.blob_id;
  if (!metaBlobId) {
    throw new Error("No blobId in metadata response: " + JSON.stringify(metaData));
  }
  const metadataUri = `${gatewayBase}/${metaBlobId}`;
  return {
    provider: "walrus",
    imageUri,
    metadataUri,
  };
}
