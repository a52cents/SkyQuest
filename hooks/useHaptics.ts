"use client";

import { useEffect, useState } from "react";
import { haptic, isHapticsEnabled, isHapticsSupported, setHapticsEnabled } from "@/lib/haptics";

export function useHaptics() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const supported = isHapticsSupported();
    setIsSupported(supported);
    setIsEnabled(isHapticsEnabled());
  }, []);

  function updateEnabled(enabled: boolean) {
    if (!isHapticsSupported()) {
      setIsSupported(false);
      setIsEnabled(false);
      return;
    }

    setHapticsEnabled(enabled);
    setIsEnabled(enabled);
    setIsSupported(true);
  }

  return { haptic, isEnabled, setEnabled: updateEnabled, isSupported };
}
