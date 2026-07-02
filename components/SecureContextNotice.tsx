"use client";

import { useEffect, useState } from "react";

export function SecureContextNotice() {
  const [isInsecure, setIsInsecure] = useState(false);

  useEffect(() => {
    setIsInsecure(!window.isSecureContext);
  }, []);

  if (!isInsecure) {
    return null;
  }

  return (
    <div className="mb-4 rounded-[22px] border border-warning/30 bg-warning/12 p-4 text-sm leading-6 text-warning">
      <strong className="text-text">HTTPS requis sur iPhone.</strong> GPS, caméra et orientation
      sont bloqués en HTTP.
      {"Ouvre l'app via une URL https ou un tunnel HTTPS pour tester sur mobile."}
    </div>
  );
}
