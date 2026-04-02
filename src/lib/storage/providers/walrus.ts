import type { StorageUploadInput, StorageUploadResult } from "@/lib/storage/types";
import { StorageProviderError } from "@/lib/storage/http";

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

const validatedPublisherUrl = publisherUrl;
const validatedGatewayBase = gatewayBase;
const normalizedGatewayBase = validatedGatewayBase.replace(/\/$/, "");
const gatewayBlobBase = /\/blobs$/i.test(normalizedGatewayBase)
  ? normalizedGatewayBase
  : `${normalizedGatewayBase}/blobs`;

/**
 * Uploads a file to Walrus storage and returns StorageUploadResult shape.
 */
export async function uploadWithWalrus(input: StorageUploadInput): Promise<StorageUploadResult> {
  const epochs = 5;
  const imageBuffer = Buffer.from(await input.file.arrayBuffer());
  const imageMime = input.file.type || "application/octet-stream";

  const candidateEndpoints = (() => {
  const normalized = validatedPublisherUrl.replace(/\/$/, "");
    const set = new Set<string>([normalized]);
    if (/\/v1\/store$/i.test(normalized)) {
      set.add(normalized.replace(/\/v1\/store$/i, "/v1/blobs"));
    }
    if (/\/v1\/blobs$/i.test(normalized)) {
      set.add(normalized.replace(/\/v1\/blobs$/i, "/v1/store"));
    }
    return Array.from(set);
  })();

  async function uploadBinary(buffer: Buffer, mime: string): Promise<string> {
    let lastStatus = 500;
    let lastBody = "";

    for (const endpoint of candidateEndpoints) {
      const url = `${endpoint}?epochs=${epochs}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": mime,
            "Content-Length": String(buffer.length),
            ...(process.env.WALRUS_API_KEY
              ? {
                  Authorization: `Bearer ${process.env.WALRUS_API_KEY}`,
                }
              : {}),
          },
          body: buffer as any,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new StorageProviderError(`Walrus request failed: ${message}`, 502, true);
      }

      const rawText = await res.text();
      if (res.ok) {
        const payload = JSON.parse(rawText || "{}");
        const blobId: string =
          payload?.newlyCreated?.blobObject?.blobId ||
          payload?.newlyCreated?.blob_object?.blob_id ||
          payload?.alreadyCertified?.blobId ||
          payload?.alreadyCertified?.blob_id;

        if (!blobId) {
          throw new StorageProviderError(`No blobId in response: ${rawText.slice(0, 300)}`, 502);
        }

        return blobId;
      }

      lastStatus = res.status;
  lastBody = rawText.slice(0, 300);

      // Only continue to alternate endpoint on 404.
      if (res.status !== 404) {
        break;
      }
    }

    throw new StorageProviderError(
      `Walrus ${lastStatus}: ${lastBody}`,
      lastStatus,
      lastStatus === 429 || lastStatus >= 500
    );
  }

  const imageBlobId = await uploadBinary(imageBuffer, imageMime);
  const imageUri = `${gatewayBlobBase}/${imageBlobId}`;

  const metadata = {
    name: input.name,
    description: input.description,
    image: imageUri,
    attributes: [],
  };
  const metadataBuffer = Buffer.from(JSON.stringify(metadata));
  const metaBlobId = await uploadBinary(metadataBuffer, "application/json");
  const metadataUri = `${gatewayBlobBase}/${metaBlobId}`;

  return {
    provider: "walrus",
    imageUri,
    metadataUri,
  };
}
