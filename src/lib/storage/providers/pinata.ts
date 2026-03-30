import { fetchWithRetry, safeResponseText, StorageProviderError } from "@/lib/storage/http";
import type { StorageUploadInput, StorageUploadResult } from "@/lib/storage/types";

export async function uploadWithPinata(input: StorageUploadInput): Promise<StorageUploadResult> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new StorageProviderError("PINATA_JWT is not configured", 500);
  }

  const fileForm = new FormData();
  fileForm.append("file", input.file);
  fileForm.append("pinataMetadata", JSON.stringify({ name: input.file.name }));
  fileForm.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const fileRes = await fetchWithRetry("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: fileForm,
  });

  if (!fileRes.ok) {
    throw new StorageProviderError(
      `Pinata file upload failed (${fileRes.status}): ${await safeResponseText(fileRes)}`,
      fileRes.status,
      fileRes.status === 429 || fileRes.status >= 500
    );
  }

  const fileJson = (await fileRes.json()) as { IpfsHash?: string };
  if (!fileJson?.IpfsHash) {
    throw new StorageProviderError("Pinata file upload missing IpfsHash", 502);
  }

  const imageUri = `https://gateway.pinata.cloud/ipfs/${fileJson.IpfsHash}`;

  const metadata = {
    name: input.name,
    description: input.description,
    image: imageUri,
    attributes: [],
  };

  const metaRes = await fetchWithRetry("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${input.name}-metadata` },
    }),
  });

  if (!metaRes.ok) {
    throw new StorageProviderError(
      `Pinata metadata upload failed (${metaRes.status}): ${await safeResponseText(metaRes)}`,
      metaRes.status,
      metaRes.status === 429 || metaRes.status >= 500
    );
  }

  const metaJson = (await metaRes.json()) as { IpfsHash?: string };
  if (!metaJson?.IpfsHash) {
    throw new StorageProviderError("Pinata metadata upload missing IpfsHash", 502);
  }

  return {
    provider: "pinata",
    imageUri,
    metadataUri: `https://gateway.pinata.cloud/ipfs/${metaJson.IpfsHash}`,
  };
}
