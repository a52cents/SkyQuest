type CameraFallbackProps = {
  cameraError: string | null;
  zoomError: string | null;
  orientationError?: string | null;
};

export function CameraFallback({ cameraError, zoomError, orientationError }: CameraFallbackProps) {
  if (!cameraError && !zoomError && !orientationError) return null;

  return (
    <div className="mb-3 grid gap-2">
      {orientationError ? (
        <p className="rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
          {orientationError}
        </p>
      ) : null}
      {cameraError ? (
        <p className="rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
          {cameraError}
        </p>
      ) : null}
      {zoomError ? (
        <p className="rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
          {zoomError}
        </p>
      ) : null}
    </div>
  );
}
