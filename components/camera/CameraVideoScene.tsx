import type { ReactNode, RefObject } from "react";

type CameraVideoSceneProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  isCameraReady: boolean;
  children: ReactNode;
};

export function CameraVideoScene({ videoRef, isCameraReady, children }: CameraVideoSceneProps) {
  return (
    <main className="camera-guide-screen relative h-[100dvh] select-none overflow-hidden bg-[#0a0a0b] text-white">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.30),rgba(0,0,0,0.08)_42%,rgba(0,0,0,0.62))]"
        aria-hidden="true"
      />
      {!isCameraReady ? (
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,color-mix(in_srgb,var(--accent-cyan)_16%,transparent),transparent_20rem),var(--background)]"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </main>
  );
}
