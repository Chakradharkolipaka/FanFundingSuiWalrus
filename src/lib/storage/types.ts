export type StorageProviderName = "walrus" | "pinata";

export type StorageUploadInput = {
  file: File;
  name: string;
  description: string;
  traceId?: string;
};

export type StorageUploadResult = {
  provider: StorageProviderName;
  imageUri: string;
  metadataUri: string;
};
