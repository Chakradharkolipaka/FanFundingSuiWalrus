import { Readable } from "stream";
import type { NextApiRequest } from "next";

export interface WalrusUploadResult {
  blobId: string;
  imageUrl: string;
}

/**
 * Reads the raw body from a Next.js API request as a Buffer.
 */
export async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    (req as unknown as Readable).on("data", (chunk: Buffer) => chunks.push(chunk));
    (req as unknown as Readable).on("end", () => resolve(Buffer.concat(chunks)));
    (req as unknown as Readable).on("error", reject);
  });
}
