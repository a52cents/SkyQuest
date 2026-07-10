declare module "magvar" {
  /** WMM2025 declination in degrees, positive east. Altitude is in kilometers. */
  export function calculateMagVar(
    julianDays: number,
    latitude: number,
    longitude: number,
    altitude?: number,
  ): number;
}
