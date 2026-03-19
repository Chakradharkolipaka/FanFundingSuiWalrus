export type ZkLoginProof = {
  proofPoints: any;
  issBase64Details: any;
  headerBase64: string;
};

export type ProverOutput = {
  zkProof: ZkLoginProof;
  addressSeed: string;
};

export type ProverInput = {
  jwt: string;
  ephemeralPublicKey: string;
  randomness: string;
  maxEpoch: number;
};

export interface ZkLoginProverProvider {
  name: "docker" | "enoki";
  prove(input: ProverInput): Promise<ProverOutput>;
}
