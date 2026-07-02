// components/InstallButton.tsx
"use client";
import { useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallButton() {
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [showIosHint, setShowIosHint] = useState(false);

  if (installed) return null;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(
    navigator.userAgent
  );

  const handleClick = async () => {
    if (canPrompt) {
      await promptInstall();
    } else if (isIos && isSafari) {
      setShowIosHint(true);
    }
  };

  return (
    <>
      <button onClick={handleClick} className="install-btn">
<<<<<<< HEAD
        ⬇ Ajouter à l’écran d’accueil
=======
        {"⬇ Ajouter à l'écran d'accueil"}
>>>>>>> 2db9268be9534983951010fdff8560eb2162c0d6
      </button>

      {showIosHint && (
        <div className="ios-modal" onClick={() => setShowIosHint(false)}>
          <div className="ios-modal-content">
            <p>1. Appuie sur le bouton <strong>Partager</strong> ⬆️</p>
<<<<<<< HEAD
            <p>2. Choisis <strong>« Sur l’écran d’accueil »</strong></p>
=======
            <p>{"2. Choisis « Sur l'écran d'accueil »"}</p>
>>>>>>> 2db9268be9534983951010fdff8560eb2162c0d6
            <p>3. Appuie sur <strong>Ajouter</strong></p>
          </div>
        </div>
      )}
    </>
  );
}
