import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Vector3 } from "three";
import { getComponent } from "../domain/repairGraph";

export function CameraRig({
  focusedComponentId,
  reducedMotion,
}: {
  focusedComponentId: string | null;
  reducedMotion: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const active = useRef(true);
  const component = focusedComponentId ? getComponent(focusedComponentId) : null;
  const target = useMemo(
    () => new Vector3(...(component?.focus.center ?? [0, 1.7, 0])),
    [component],
  );
  const radius = component?.focus.radius ?? 2.4;
  const destination = useMemo(
    () => target.clone().add(new Vector3(radius * 2.5, radius * 1.55, radius * 3.15)),
    [radius, target],
  );

  useEffect(() => {
    active.current = true;
    if (reducedMotion) camera.position.copy(destination);
    camera.lookAt(target);
    invalidate();
  }, [camera, destination, invalidate, reducedMotion, target]);

  useFrame((_, delta) => {
    if (!active.current || reducedMotion) return;
    camera.position.x = MathUtils.damp(camera.position.x, destination.x, 7.5, delta);
    camera.position.y = MathUtils.damp(camera.position.y, destination.y, 7.5, delta);
    camera.position.z = MathUtils.damp(camera.position.z, destination.z, 7.5, delta);
    camera.lookAt(target);
    if (camera.position.distanceTo(destination) > 0.01) invalidate();
    else active.current = false;
  });

  return (
    <OrbitControls
      makeDefault
      target={target.toArray()}
      enablePan={false}
      minDistance={3.8}
      maxDistance={13}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.72}
      minAzimuthAngle={-Math.PI * 0.65}
      maxAzimuthAngle={Math.PI * 0.65}
      dampingFactor={0.08}
      enableDamping
    />
  );
}
