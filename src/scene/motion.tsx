import { useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useRef } from "react";
import { type Group, MathUtils, type Object3D } from "three";
import { getComponent } from "../domain/repairGraph";

export function applyComponentTransform(node: Object3D, componentId: string, exploded: boolean) {
  const component = getComponent(componentId);
  if (!component) return false;
  const transform = exploded ? component.exploded : component.assembled;
  node.position.set(...transform.position);
  node.rotation.set(...transform.rotation);
  node.scale.set(...transform.scale);
  return true;
}

export function AnimatedPart({
  componentId,
  exploded,
  reducedMotion,
  delay = 0,
  children,
}: {
  componentId: string;
  exploded: boolean;
  reducedMotion: boolean;
  delay?: number;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const component = getComponent(componentId);
  const invalidate = useThree((state) => state.invalidate);
  const delayLeft = useRef(0);

  useEffect(() => {
    delayLeft.current = reducedMotion ? 0 : delay;
    if (reducedMotion && group.current && component) {
      applyComponentTransform(group.current, componentId, exploded);
    }
    invalidate();
  }, [component, componentId, delay, exploded, invalidate, reducedMotion]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node || !component || reducedMotion) return;
    if (delayLeft.current > 0) {
      delayLeft.current -= delta;
      invalidate();
      return;
    }
    const target = exploded ? component.exploded : component.assembled;
    node.position.x = MathUtils.damp(node.position.x, target.position[0], 8, delta);
    node.position.y = MathUtils.damp(node.position.y, target.position[1], 8, delta);
    node.position.z = MathUtils.damp(node.position.z, target.position[2], 8, delta);
    node.rotation.x = MathUtils.damp(node.rotation.x, target.rotation[0], 8, delta);
    node.rotation.y = MathUtils.damp(node.rotation.y, target.rotation[1], 8, delta);
    node.rotation.z = MathUtils.damp(node.rotation.z, target.rotation[2], 8, delta);
    if (
      node.position.distanceTo({
        x: target.position[0],
        y: target.position[1],
        z: target.position[2],
      }) > 0.002
    )
      invalidate();
  });

  if (!component) return null;
  return (
    <group
      ref={group}
      position={component.assembled.position}
      rotation={component.assembled.rotation}
      scale={component.assembled.scale}
      userData={{ componentId }}
    >
      {children}
    </group>
  );
}
