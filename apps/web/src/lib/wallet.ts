export type BrowserWallet = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(options?: {
    onlyIfTrusted?: boolean;
  }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage?: (
    message: Uint8Array,
    display?: "utf8" | "hex"
  ) => Promise<{ signature: Uint8Array }>;
  signTransaction?: <T = any>(transaction: T) => Promise<T>;
  signAllTransactions?: <T = any>(transactions: T[]) => Promise<T[]>;
};

declare global {
  interface Window {
    solana?: BrowserWallet;
  }
}

export function getBrowserWallet(): BrowserWallet | null {
  return window.solana ?? null;
}

export async function connectBrowserWallet(): Promise<string> {
  const wallet = getBrowserWallet();
  if (!wallet) {
    throw new Error("No browser wallet was found.");
  }

  const result = await wallet.connect();
  return result.publicKey.toString();
}

export async function disconnectBrowserWallet(): Promise<void> {
  await getBrowserWallet()?.disconnect();
}
