"use client";

import {
  WatchWalletChanges,
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";
import { StrKey } from "@stellar/stellar-sdk";
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
  | "detecting"
  | "requesting_access"
  | "connected"
  | "unavailable"
  | "wrong_network"
  | "rejected"
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
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

function walletErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const message = error.message;
    const normalized = message.toLowerCase();

    if (
      normalized.includes("reject") ||
      normalized.includes("declin") ||
      normalized.includes("cancel") ||
      normalized.includes("denied")
    ) {
      return "Wallet connection was cancelled.";
    }

    return message;
  }

  return "The wallet request could not be completed.";
}

function isRejectedError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  const normalized = message.toLowerCase();
  return (
    normalized.includes("reject") ||
    normalized.includes("declin") ||
    normalized.includes("cancel") ||
    normalized.includes("denied")
  );
}

function isTestnet(details: WalletNetwork): boolean {
  return (
    details.network?.toUpperCase() === "TESTNET" ||
    details.networkPassphrase === TESTNET_PASSPHRASE
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<WalletNetwork | null>(null);
  const [status, setStatus] = useState<WalletState>("idle");
  const [error, setError] = useState<string | null>(null);

  const restoringRef = useRef(false);
  const connectingRef = useRef(false);

  const refreshNetwork = useCallback(async () => {
    const details = await getNetworkDetails();

    if (details.error) {
      throw new Error(details.error.message);
    }

    const nextNetwork = {
      network: details.network,
      networkPassphrase: details.networkPassphrase,
      networkUrl: details.networkUrl ?? null,
      sorobanRpcUrl: details.sorobanRpcUrl ?? null,
    };

    setNetwork(nextNetwork);

    return nextNetwork;
  }, []);

  const connect = useCallback(async () => {
    if (connectingRef.current) {
      return;
    }

    connectingRef.current = true;
    setStatus("detecting");
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

      setStatus("requesting_access");
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

      if (!StrKey.isValidEd25519PublicKey(connectedAddress)) {
        throw new Error("Freighter returned an invalid Stellar public key.");
      }

      const currentNetwork = await refreshNetwork();

      if (!isTestnet(currentNetwork)) {
        setAddress(null);
        setStatus("wrong_network");
        setError("Switch Freighter to Stellar Testnet to continue.");
        return;
      }

      setAddress(connectedAddress);
      setStatus("connected");

      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTO_RESTORE_KEY, "enabled");
      }
    } catch (caught) {
      setAddress(null);
      setNetwork(null);
      setStatus(isRejectedError(caught) ? "rejected" : "error");
      setError(walletErrorMessage(caught));
    } finally {
      connectingRef.current = false;
    }
  }, [refreshNetwork]);

  const restoreSession = useCallback(
    async (): Promise<boolean> => {
      if (restoringRef.current) {
        return false;
      }

      restoringRef.current = true;

      try {
        /*
         * Automatic restoration must stay silent.
         * isAllowed and getAddress do not request new permission.
         * requestAccess remains exclusive to the manual Connect action.
         */
        const permission = await isAllowed();

        if (permission.error || !permission.isAllowed) {
          return false;
        }

        const current = await getAddress();

        if (current.error || !current.address) {
          return false;
        }

        if (!StrKey.isValidEd25519PublicKey(current.address)) {
          return false;
        }

        const currentNetwork = await refreshNetwork();

        if (!isTestnet(currentNetwork)) {
          setAddress(null);
          setStatus("wrong_network");
          setError("Switch Freighter to Stellar Testnet to continue.");
          return false;
        }

        setAddress(current.address);
        setError(null);
        setStatus("connected");

        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            AUTO_RESTORE_KEY,
            "enabled",
          );
        }

        return true;
      } catch {
        /*
         * Firefox may still be injecting the extension bridge.
         * The restoration effect retries without showing an error.
         */
        return false;
      } finally {
        restoringRef.current = false;
      }
    },
    [refreshNetwork],
  );

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
      status !== "idle"
    ) {
      return;
    }

    /*
     * Explicit disconnect remains persistent.
     * A successful manual connection changes this back to enabled.
     */
    if (
      window.localStorage.getItem(AUTO_RESTORE_KEY) ===
      "disabled"
    ) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let attempts = 0;

    const maximumAttempts = 3;

    const attemptRestore = async () => {
      if (cancelled) {
        return;
      }

      const restored = await restoreSession();

      if (restored || cancelled) {
        return;
      }

      attempts += 1;

      if (attempts < maximumAttempts) {
        const delay = attempts < 3 ? 700 : 1400;

        timer = window.setTimeout(() => {
          void attemptRestore();
        }, delay);
        return;
      }

      await isConnected();
    };

    timer = window.setTimeout(() => {
      void attemptRestore();
    }, 350);

    const retryOnFocus = () => {
      if (!cancelled) {
        void attemptRestore();
      }
    };

    const retryWhenVisible = () => {
      if (
        document.visibilityState === "visible" &&
        !cancelled
      ) {
        void attemptRestore();
      }
    };

    window.addEventListener("focus", retryOnFocus);
    document.addEventListener(
      "visibilitychange",
      retryWhenVisible,
    );

    return () => {
      cancelled = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      window.removeEventListener(
        "focus",
        retryOnFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        retryWhenVisible,
      );
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

        const nextWalletNetwork = {
          network: nextNetwork,
          networkPassphrase,
          networkUrl: null,
          sorobanRpcUrl: null,
        };

        setNetwork((current) => ({
          ...nextWalletNetwork,
          networkUrl: current?.networkUrl ?? null,
          sorobanRpcUrl: current?.sorobanRpcUrl ?? null,
        }));

        if (!isTestnet(nextWalletNetwork)) {
          setAddress(null);
          setStatus("wrong_network");
          setError("Switch Freighter to Stellar Testnet to continue.");
          return;
        }

        setAddress(nextAddress);
        setError(null);
        setStatus("connected");
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
