import { BaseAssembly, HeadAssembly, HingeAssembly } from "./LampAssemblies";
import { useLampMaterials } from "./materials";

export function AureliaLamp({
  exploded,
  restored,
  reducedMotion,
  selectedId,
  onSelect,
}: {
  exploded: boolean;
  restored: boolean;
  reducedMotion: boolean;
  selectedId: string | null;
  onSelect: (componentId: string) => void;
}) {
  const materials = useLampMaterials(restored);
  const props = { exploded, reducedMotion, selectedId, onSelect, materials };

  return (
    <group rotation={[0, -0.35, 0]} position={[0, -0.35, 0]} dispose={null}>
      <HeadAssembly {...props} />
      <HingeAssembly {...props} />
      <BaseAssembly {...props} />
      {restored && (
        <pointLight position={[0, 2.4, 0]} color="#ffd99a" intensity={18} distance={6} decay={2} />
      )}
    </group>
  );
}
