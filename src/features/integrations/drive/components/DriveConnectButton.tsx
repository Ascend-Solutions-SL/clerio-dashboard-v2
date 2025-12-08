"use client";

import { useCallback, useEffect, useState } from "react";

interface DriveConnectButtonProps {
  redirectPath?: string;
  className?: string;
}

type DriveConnectionState = "checking" | "connected" | "disconnected";

export function DriveConnectButton({
  redirectPath = "/integraciones",
  className,
}: DriveConnectButtonProps) {
  const [status, setStatus] = useState<DriveConnectionState>("checking");
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/drive/status", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudo recuperar el estado de Drive");
        }

        const payload = (await response.json()) as { connected: boolean };

        if (!isMounted) return;

        setStatus(payload.connected ? "connected" : "disconnected");
      } catch (error) {
        console.error("[drive] status error", error);
        if (!isMounted) return;
        setStatus("disconnected");
      }
    };

    void fetchStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClick = useCallback(() => {
    if (status !== "disconnected") {
      return;
    }

    setIsRedirecting(true);
    const url = new URL("/api/drive/oauth/start", window.location.origin);
    url.searchParams.set("redirect", redirectPath);
    window.location.href = url.toString();
  }, [redirectPath, status]);

  const isConnected = status === "connected";
  const isLoading = status === "checking" || isRedirecting;

  const baseClasses =
    "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold transition border";

  const connectedClasses =
    "bg-emerald-500 text-white border-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.35)] cursor-default";

  const disconnectedClasses =
    "border-gray-200 bg-gray-100 text-gray-700 hover:border-blue-300 hover:text-blue-600";

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || isConnected}
      className={`${baseClasses} ${isConnected ? connectedClasses : disconnectedClasses} ${
        (isLoading && !isConnected) || isRedirecting ? "cursor-wait opacity-70" : ""
      } ${className ?? ""}`}
    >
      {isConnected ? "Conectado" : isLoading ? "Conectando…" : "Conectar"}
    </button>
  );
}

export default DriveConnectButton;
