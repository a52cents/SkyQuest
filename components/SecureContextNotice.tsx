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
    <div className="mb-4 rounded-[22px] border border-[#ffd166]/30 bg-[#ffd166]/12 p-4 text-sm leading-6 text-[#ffe3a3]">
      <strong className="text-white">HTTPS requis sur iPhone.</strong> GPS, caméra et orientation sont bloqués en HTTP.
      Ouvre l&apos;app via une URL https ou un tunnel HTTPS pour tester sur mobile.
    </div>
  );
}
