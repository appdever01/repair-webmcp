import {
  Bounds,
  Center,
  ContactShadows,
  OrbitControls,
  PerformanceMonitor,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace, Vector3 } from "three";
import { getDpr, getQualityTier } from "./quality";

export interface SceneCommand {
  id: number;
  type: "rotate-left" | "rotate-right" | "zoom-in" | "zoom-out" | "reset";
}

function GeneratedModel({ modelUrl }: { modelUrl: string }) {
  const gltf = useGLTF(modelUrl);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return (
    <Bounds fit clip observe margin={1.25}>
      <Center>
        <primitive object={scene} />
      </Center>
    </Bounds>
  );
}

function CameraControls({ command }: { command: SceneCommand }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (command.id === 0 || !controls.current) return;
    const target = controls.current.target;
    if (command.type === "reset") {
      camera.position.set(3.8, 2.6, 4.8);
      target.set(0, 0, 0);
    } else if (command.type === "zoom-in" || command.type === "zoom-out") {
      const scale = command.type === "zoom-in" ? 0.82 : 1.2;
      camera.position.sub(target).multiplyScalar(scale).add(target);
    } else {
      const offset = camera.position.clone().sub(target);
      const angle = command.type === "rotate-left" ? -Math.PI / 8 : Math.PI / 8;
      offset.applyAxisAngle(new Vector3(0, 1, 0), angle);
      camera.position.copy(target).add(offset);
    }
    controls.current.update();
    invalidate();
  }, [camera, command, invalidate]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={1.5}
      maxDistance={12}
      minPolarAngle={Math.PI * 0.08}
      maxPolarAngle={Math.PI * 0.88}
      dampingFactor={0.08}
      enableDamping
    />
  );
}

export function RepairScene({ modelUrl, command }: { modelUrl: string; command: SceneCommand }) {
  const tier = getQualityTier();
  const [dpr, setDpr] = useState(() => getDpr(tier));

  return (
    <Canvas
      aria-label="Interactive 3D model of the uploaded object"
      frameloop="demand"
      dpr={dpr}
      shadows={tier === "high"}
      camera={{ fov: 34, near: 0.01, far: 1_000, position: [3.8, 2.6, 4.8] }}
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
      <ambientLight intensity={0.72} color="#cbd4d8" />
      <directionalLight
        position={[-5, 9, 5]}
        intensity={3.2}
        color="#ffe4ba"
        castShadow={tier === "high"}
      />
      <directionalLight position={[6, 4, -2]} intensity={1.4} color="#a9c0eb" />
      <spotLight position={[0, 7, -7]} intensity={8} angle={0.5} penumbra={0.8} color="#e8eee8" />
      <GeneratedModel modelUrl={modelUrl} />
      <ContactShadows
        position={[0, -1.2, 0]}
        opacity={0.28}
        scale={10}
        blur={2.5}
        far={4}
        frames={1}
      />
      <CameraControls command={command} />
    </Canvas>
  );
}
