"use client";

import { AppButton } from "@/components/AppButton";

export function OfflineRetryButton() {
  return (
    <AppButton fullWidth onClick={() => window.location.reload()}>
      Réessayer
    </AppButton>
  );
}
