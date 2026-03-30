import { uploadWithPinata } from "./pinata";
import { uploadWithWalrus } from "./walrus";
import type { StorageProviderName, StorageUploadInput, StorageUploadResult } from "@/lib/storage/types";

export function getStorageProviderName(env: NodeJS.ProcessEnv): StorageProviderName {
  const raw = (env.STORAGE_PROVIDER ?? "walrus").toLowerCase();
  return raw === "pinata" ? "pinata" : "walrus";
}

export async function uploadWithProvider(
  provider: StorageProviderName,
  input: StorageUploadInput
): Promise<StorageUploadResult> {
  if (provider === "pinata") {
    return uploadWithPinata(input);
  }
  return uploadWithWalrus(input);
}
