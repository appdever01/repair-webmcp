export type QualityTier = "high" | "standard" | "safe";

export function getQualityTier(): QualityTier {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "safe";
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (deviceMemory >= 8 && cores >= 8) return "high";
  if (deviceMemory >= 4 && cores >= 4) return "standard";
  return "safe";
}

export function getDpr(tier: QualityTier) {
  if (typeof window === "undefined") return 1;
  const cap = tier === "high" ? 1.75 : tier === "standard" ? 1.25 : 1;
  return Math.min(window.devicePixelRatio || 1, cap);
}

export function supportsWebGL() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
