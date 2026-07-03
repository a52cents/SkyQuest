"use client";

import { useEffect, useState } from "react";
import { AppCard } from "@/components/AppCard";

export function SecureContextNotice() {
  const [isInsecure, setIsInsecure] = useState(false);

  useEffect(() => {
    setIsInsecure(!window.isSecureContext);
  }, []);

  if (!isInsecure) {
    return null;
  }

  return (
    <AppCard
      variant="subtle"
      padding="sm"
      className="mb-4 border-warning/30 bg-warning/12 text-sm leading-6 text-warning"
    >
      <strong className="text-text">HTTPS requis sur iPhone.</strong> GPS, caméra et orientation
      sont bloqués en HTTP.
      {" Ouvre l'app via une URL https ou un tunnel HTTPS pour tester sur mobile."}
    </AppCard>
  );
}
