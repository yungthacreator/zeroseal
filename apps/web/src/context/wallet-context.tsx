"use client";

import {
  WatchWalletChanges,
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type WalletState =
  | "idle"
  | "connecting"
  | "connected"
  | "unavailable"
  | "error";

type WalletNetwork = {
  network: string;
  networkPassphrase: string;
  networkUrl: string | null;
  sorobanRpcUrl: string | null;
};

type WalletContextValue = {
  address: string | null;
  network: WalletNetwork | null;
  status: WalletState;
  error: string | null;
  connect: () => Promise<void>;
  clearSession: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const AUTO_RESTORE_KEY = "zeroseal:wallet-auto-restore";

function walletErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The wallet request could not be completed.";
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<WalletNetwork | null>(null);
  const [status, setStatus] = useState<WalletState>("idle");
  const [error, setError] = useState<string | null>(null);

  const restoringRef = useRef(false);

  const refreshNetwork = useCallback(async () => {
    const details = await getNetworkDetails();

    if (details.error) {
      throw new Error(details.error.message);
    }

    setNetwork({
      network: details.network,
      networkPassphrase: details.networkPassphrase,
      networkUrl: details.networkUrl ?? null,
      sorobanRpcUrl: details.sorobanRpcUrl ?? null,
    });
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);

    try {
      const connection = await isConnected();

      if (connection.error || !connection.isConnected) {
        setStatus("unavailable");
        setError(
          connection.error?.message ??
            "Freighter is not installed or is unavailable.",
        );
        return;
      }

      const permission = await isAllowed();

      if (permission.error) {
        throw new Error(permission.error.message);
      }

      let connectedAddress: string | undefined;

      if (!permission.isAllowed) {
        const access = await requestAccess();

        if (access.error) {
          throw new Error(access.error.message);
        }

        connectedAddress = access.address;
      } else {
        const current = await getAddress();

        if (current.error) {
          throw new Error(current.error.message);
        }

        connectedAddress = current.address;
      }

      if (!connectedAddress) {
        throw new Error("Freighter returned no active account.");
      }

      await refreshNetwork();

      setAddress(connectedAddress);
      setStatus("connected");

      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTO_RESTORE_KEY, "enabled");
      }
    } catch (caught) {
      setAddress(null);
      setNetwork(null);
      setStatus("error");
      setError(walletErrorMessage(caught));
    }
  }, [refreshNetwork]);

  const restoreSession = useCallback(async (): Promise<boolean> => {
    if (restoringRef.current) {
      return false;
    }

    restoringRef.current = true;

    try {
      const connection = await isConnected();

      if (connection.error || !connection.isConnected) {
        return false;
      }

      const permission = await isAllowed();

      if (permission.error || !permission.isAllowed) {
        return false;
      }

      const current = await getAddress();

      if (current.error || !current.address) {
        return false;
      }

      await refreshNetwork();

      setAddress(current.address);
      setError(null);
      setStatus("connected");

      return true;
    } catch {
      // Firefox may still be injecting the Freighter bridge.
      // Silent failure keeps manual connection available.
      return false;
    } finally {
      restoringRef.current = false;
    }
  }, [refreshNetwork]);

  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTO_RESTORE_KEY, "disabled");
    }

    setAddress(null);
    setNetwork(null);
    setStatus("idle");
    setError(null);
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      address ||
      status !== "idle" ||
      window.localStorage.getItem(AUTO_RESTORE_KEY) !== "enabled"
    ) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let attempt = 0;

    const delays = [700, 1600, 3000];

    const runRestore = async () => {
      if (cancelled) {
        return;
      }

      const restored = await restoreSession();

      if (restored || cancelled) {
        return;
      }

      attempt += 1;

      if (attempt < delays.length) {
        timer = window.setTimeout(() => {
          void runRestore();
        }, delays[attempt]);
      }
    };

    timer = window.setTimeout(() => {
      void runRestore();
    }, delays[0]);

    return () => {
      cancelled = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [address, status, restoreSession]);

  useEffect(() => {
    if (status !== "connected") {
      return;
    }

    const watcher = new WatchWalletChanges(3000);

    const result = watcher.watch(
      ({
        address: nextAddress,
        network: nextNetwork,
        networkPassphrase,
        error: watchError,
      }) => {
        if (watchError) {
          setError(watchError.message);
          return;
        }

        if (!nextAddress) {
          return;
        }

        setAddress(nextAddress);

        setNetwork((current) => ({
          network: nextNetwork,
          networkPassphrase,
          networkUrl: current?.networkUrl ?? null,
          sorobanRpcUrl: current?.sorobanRpcUrl ?? null,
        }));
      },
    );

    const watcherError = result.error?.message;

    if (watcherError) {
      queueMicrotask(() => {
        setError(watcherError);
      });
    }

    return () => watcher.stop();
  }, [status]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      network,
      status,
      error,
      connect,
      clearSession,
    }),
    [address, network, status, error, connect, clearSession],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider");
  }

  return context;
}
