import { ContactShadows, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { selectStage } from "../domain/selectors";
import { useRepairStore } from "../domain/useRepairStore";
import { AureliaLamp } from "./AureliaLamp";
import { CameraRig } from "./camera";
import { getDpr, getQualityTier } from "./quality";

export function RepairScene({ reducedMotion }: { reducedMotion: boolean }) {
  const stage = useRepairStore(selectStage);
  const selectedId = useRepairStore((state) => state.focusedComponentId);
  const focusComponent = useRepairStore((state) => state.focusComponent);
  const tier = getQualityTier();
  const [dpr, setDpr] = useState(() => getDpr(tier));
  const exploded = !["intake", "restored"].includes(stage);
  const restored = stage === "restored";

  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      dpr={dpr}
      shadows={tier === "high"}
      camera={{ fov: 34, near: 0.1, far: 100, position: [7, 5, 9] }}
      gl={{ alpha: true, antialias: tier !== "safe", powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <PerformanceMonitor
        flipflops={2}
        onDecline={() => setDpr((value) => Math.max(1, value - 0.25))}
        onIncline={() => setDpr((value) => Math.min(getDpr(tier), value + 0.15))}
      />
      <ambientLight intensity={0.55} color="#b8c6cf" />
      <directionalLight
        position={[-5, 9, 5]}
        intensity={4.2}
        color="#ffe4ba"
        castShadow={tier === "high"}
      />
      <directionalLight position={[6, 4, -2]} intensity={1.7} color="#91aeea" />
      <spotLight position={[0, 6, -7]} intensity={14} angle={0.45} penumbra={0.8} color="#e8eee8" />
      <AureliaLamp
        exploded={exploded}
        restored={restored}
        reducedMotion={reducedMotion}
        selectedId={selectedId}
        onSelect={(componentId) => focusComponent(componentId, { actor: "human", origin: "ui" })}
      />
      <ContactShadows
        position={[0, -0.8, 0]}
        opacity={0.32}
        scale={10}
        blur={2.5}
        far={4}
        frames={1}
      />
      <CameraRig focusedComponentId={selectedId} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
