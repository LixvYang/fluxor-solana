export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const PRECISION = 1_000_000_000_000n;

export const DEFAULT_CLUSTER_LABEL =
  import.meta.env.VITE_CLUSTER_LABEL ?? "Devnet";
export const DEFAULT_SOLANA_RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const DEFAULT_PER_RPC_URL =
  import.meta.env.VITE_MAGICBLOCK_PER_RPC_URL ??
  "https://devnet-tee.magicblock.app";
