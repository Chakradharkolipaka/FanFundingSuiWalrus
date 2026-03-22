import type { SuiClient } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { getZkLoginSignature } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export type ZkLoginProof = {
  proofPoints: any;
  issBase64Details: any;
  headerBase64: string;
};

export type ZkLoginSignerSession = {
  address: string;
  jwt: string;
  maxEpoch: number;
  addressSeed: string;
  zkProof: ZkLoginProof;
  ephemeralSecretKey: string;
};

export class ZkLoginSigner {
  constructor(
    private client: SuiClient,
    private session: ZkLoginSignerSession
  ) {}

  getAddress() {
    return this.session.address;
  }

  async signAndExecuteTransaction(tx: Transaction): Promise<{ digest: string }> {
    // Ensure sender is set (required for correct intent + signature verification).
    tx.setSenderIfNotSet?.(this.session.address);
    // For SDK versions where Transaction doesn't have setSenderIfNotSet.
    if (!(tx as any).sender) {
      tx.setSender(this.session.address);
    }

    // Build BCS bytes for signing.
    const txBytes = await tx.build({ client: this.client });

    // The ephemeral secret key is stored as a base64 string by `Ed25519Keypair#getSecretKey()`.
    // `fromSecretKey` expects raw bytes, not the base64 string.
    const secretBytes = Buffer.from(this.session.ephemeralSecretKey, "base64");
    const keypair = Ed25519Keypair.fromSecretKey(secretBytes);
    const { signature: userSignature } = await keypair.signTransaction(txBytes);

    const zkSig = getZkLoginSignature({
      inputs: {
        ...this.session.zkProof,
        addressSeed: this.session.addressSeed,
      },
      maxEpoch: this.session.maxEpoch,
      userSignature,
    });

    const res = await this.client.executeTransactionBlock({
      transactionBlock: txBytes,
      signature: zkSig,
      options: { showEffects: true },
    });

    return { digest: res.digest };
  }
}
