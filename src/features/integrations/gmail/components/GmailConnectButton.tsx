 "use client";
 
 import { useCallback, useEffect, useState } from "react";
 
 interface GmailConnectButtonProps {
   redirectPath?: string;
   className?: string;
 }
 
 type GmailConnectionState = "checking" | "connected" | "disconnected";
 
 export function GmailConnectButton({
   redirectPath = "/integraciones",
   className,
 }: GmailConnectButtonProps) {
   const [status, setStatus] = useState<GmailConnectionState>("checking");
   const [isRedirecting, setIsRedirecting] = useState(false);
 
   useEffect(() => {
     let isMounted = true;
 
     const fetchStatus = async () => {
       try {
         const response = await fetch("/api/gmail/status", {
           method: "GET",
           credentials: "include",
           cache: "no-store",
         });
 
         if (!response.ok) {
           throw new Error("No se pudo recuperar el estado de Gmail");
         }
 
         const payload = (await response.json()) as { connected: boolean };
 
         if (!isMounted) return;
 
         setStatus(payload.connected ? "connected" : "disconnected");
       } catch (error) {
         console.error("[gmail] status error", error);
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
     const url = new URL("/api/gmail/oauth/start", window.location.origin);
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
 
 export default GmailConnectButton;
