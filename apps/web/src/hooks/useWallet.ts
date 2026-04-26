import { useCallback, useMemo, useState } from "react";
import {
  connectBrowserWallet,
  disconnectBrowserWallet,
  getBrowserWallet,
} from "../lib/wallet";

export type WalletState = {
  address: string | null;
  isInstalled: boolean;
  isConnecting: boolean;
  error: string | null;
};

export function useWallet() {
  const [address, setAddress] = useState<string | null>(
    () => getBrowserWallet()?.publicKey?.toString() ?? null
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      setAddress(await connectBrowserWallet());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Wallet connection failed."
      );
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectBrowserWallet();
    setAddress(null);
  }, []);

  const state: WalletState = useMemo(
    () => ({
      address,
      isInstalled: Boolean(getBrowserWallet()),
      isConnecting,
      error,
    }),
    [address, error, isConnecting]
  );

  return { ...state, browserWallet: getBrowserWallet(), connect, disconnect };
}
