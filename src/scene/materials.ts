import { useEffect, useMemo } from "react";
import { Color, MeshPhysicalMaterial, MeshStandardMaterial } from "three";

export function useLampMaterials(restored: boolean) {
  const materials = useMemo(
    () => ({
      shell: new MeshPhysicalMaterial({
        color: "#e7e3d8",
        roughness: 0.48,
        clearcoat: 0.16,
        clearcoatRoughness: 0.7,
      }),
      base: new MeshStandardMaterial({ color: "#202426", roughness: 0.76, metalness: 0.04 }),
      glass: new MeshPhysicalMaterial({
        color: "#101c25",
        roughness: 0.24,
        metalness: 0.2,
        clearcoat: 0.55,
      }),
      diffuser: new MeshPhysicalMaterial({
        color: "#f2ead5",
        roughness: 0.52,
        emissive: new Color(restored ? "#ffd68a" : "#5b513e"),
        emissiveIntensity: restored ? 2.5 : 0.18,
      }),
      pcb: new MeshStandardMaterial({ color: "#426b56", roughness: 0.72, metalness: 0.04 }),
      battery: new MeshStandardMaterial({ color: "#6882a8", roughness: 0.68 }),
      metal: new MeshStandardMaterial({ color: "#9ca2a3", roughness: 0.34, metalness: 0.74 }),
      darkMetal: new MeshStandardMaterial({ color: "#3b4043", roughness: 0.38, metalness: 0.62 }),
      wireRed: new MeshStandardMaterial({ color: "#b84c43", roughness: 0.58 }),
      wireBlack: new MeshStandardMaterial({ color: "#16191a", roughness: 0.62 }),
      led: new MeshStandardMaterial({
        color: "#f4e7c8",
        emissive: "#ffd98e",
        emissiveIntensity: restored ? 4 : 0.3,
        roughness: 0.5,
      }),
      selected: new MeshStandardMaterial({
        color: "#c8ff4a",
        emissive: "#6f941f",
        emissiveIntensity: 0.45,
        roughness: 0.42,
      }),
    }),
    [restored],
  );

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials],
  );

  return materials;
}

export type LampMaterials = ReturnType<typeof useLampMaterials>;
