import { Html, RoundedBox } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  CatmullRomCurve3,
  type InstancedMesh,
  type Material,
  Matrix4,
  TubeGeometry,
  Vector3,
} from "three";
import type { LampMaterials } from "./materials";
import { AnimatedPart } from "./motion";

interface AssemblyProps {
  exploded: boolean;
  reducedMotion: boolean;
  selectedId: string | null;
  onSelect: (componentId: string) => void;
  materials: LampMaterials;
}

function PartLabel({ visible, children }: { visible: boolean; children: string }) {
  if (!visible) return null;
  return (
    <Html center distanceFactor={7} position={[0, 0.65, 0]} className="scene-label">
      <span>{children}</span>
    </Html>
  );
}

function selectable(onSelect: (id: string) => void, id: string) {
  return (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(id);
  };
}

export function HeadAssembly(props: AssemblyProps) {
  const { exploded, reducedMotion, selectedId, onSelect, materials } = props;
  const selected = (id: string, fallback: Material) =>
    selectedId === id ? materials.selected : fallback;

  return (
    <>
      <AnimatedPart
        componentId="shell.top"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.06}
      >
        <RoundedBox
          args={[4.2, 0.42, 2.45]}
          radius={0.36}
          smoothness={5}
          onClick={selectable(onSelect, "shell.top")}
        >
          <primitive attach="material" object={selected("shell.top", materials.shell)} />
        </RoundedBox>
        <mesh position={[0, -0.18, 0]} scale={[1.92, 0.1, 1.02]}>
          <sphereGeometry args={[1, 48, 20]} />
          <primitive attach="material" object={materials.base} />
        </mesh>
        <PartLabel visible={selectedId === "shell.top"}>Upper shell</PartLabel>
      </AnimatedPart>
      <AnimatedPart
        componentId="solar.panel"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.33}
      >
        <RoundedBox
          args={[3.48, 0.09, 1.72]}
          radius={0.22}
          smoothness={5}
          onClick={selectable(onSelect, "solar.panel")}
        >
          <primitive attach="material" object={selected("solar.panel", materials.glass)} />
        </RoundedBox>
        {[-1.05, -0.35, 0.35, 1.05].map((x) => (
          <mesh key={x} position={[x, 0.051, 0]}>
            <boxGeometry args={[0.018, 0.008, 1.45]} />
            <primitive attach="material" object={materials.darkMetal} />
          </mesh>
        ))}
        <PartLabel visible={selectedId === "solar.panel"}>Solar panel</PartLabel>
      </AnimatedPart>
      <AnimatedPart
        componentId="light.diffuser"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.25}
      >
        <RoundedBox
          args={[3.82, 0.21, 2.08]}
          radius={0.28}
          smoothness={5}
          onClick={selectable(onSelect, "light.diffuser")}
        >
          <primitive attach="material" object={selected("light.diffuser", materials.diffuser)} />
        </RoundedBox>
        <PartLabel visible={selectedId === "light.diffuser"}>Diffuser</PartLabel>
      </AnimatedPart>
      <AnimatedPart
        componentId="led.array"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.18}
      >
        <RoundedBox
          args={[3.28, 0.1, 1.56]}
          radius={0.18}
          smoothness={4}
          onClick={selectable(onSelect, "led.array")}
        >
          <primitive attach="material" object={selected("led.array", materials.pcb)} />
        </RoundedBox>
        {Array.from({ length: 12 }, (_, index) => {
          const column = index % 4;
          const row = Math.floor(index / 4);
          return (
            <mesh
              key={`${column}-${row}`}
              position={[-1.2 + column * 0.8, -0.07, -0.5 + row * 0.5]}
            >
              <boxGeometry args={[0.32, 0.07, 0.18]} />
              <primitive attach="material" object={materials.led} />
            </mesh>
          );
        })}
        <PartLabel visible={selectedId === "led.array"}>LED array</PartLabel>
      </AnimatedPart>
    </>
  );
}

export function HingeAssembly(props: AssemblyProps) {
  const { exploded, reducedMotion, selectedId, onSelect, materials } = props;
  const curve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, -1.15, 0.08),
        new Vector3(0.14, -0.2, 0.05),
        new Vector3(0.06, 0.82, 0),
        new Vector3(-0.2, 1.35, 0),
      ]),
    [],
  );
  const wireGeometry = useMemo(() => new TubeGeometry(curve, 30, 0.035, 7, false), [curve]);

  return (
    <>
      <AnimatedPart componentId="hinge.arm" exploded={exploded} reducedMotion={reducedMotion}>
        <RoundedBox
          args={[0.46, 2.8, 0.52]}
          radius={0.17}
          smoothness={4}
          onClick={selectable(onSelect, "hinge.arm")}
        >
          <primitive
            attach="material"
            object={selectedId === "hinge.arm" ? materials.selected : materials.shell}
          />
        </RoundedBox>
        {[-1.42, 1.42].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.62, 32]} />
            <primitive attach="material" object={materials.darkMetal} />
          </mesh>
        ))}
        <PartLabel visible={selectedId === "hinge.arm"}>Hinge arm</PartLabel>
      </AnimatedPart>
      <AnimatedPart
        componentId="wire.harness"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.33}
      >
        <group onClick={selectable(onSelect, "wire.harness")}>
          <mesh geometry={wireGeometry} position={[-0.08, 0, 0]}>
            <primitive
              attach="material"
              object={selectedId === "wire.harness" ? materials.selected : materials.wireRed}
            />
          </mesh>
          <mesh geometry={wireGeometry} position={[0.08, 0, 0]}>
            <primitive
              attach="material"
              object={selectedId === "wire.harness" ? materials.selected : materials.wireBlack}
            />
          </mesh>
        </group>
        <PartLabel visible={selectedId === "wire.harness"}>Wire harness</PartLabel>
      </AnimatedPart>
    </>
  );
}

export function Fasteners(props: AssemblyProps) {
  const { exploded, reducedMotion, selectedId, onSelect, materials } = props;
  const ref = useRef<InstancedMesh>(null);
  const screwIds = ["fastener.base.1", "fastener.base.2", "fastener.base.3", "fastener.base.4"];

  useLayoutEffect(() => {
    const matrix = new Matrix4();
    const offsets = [
      [0, 0, 0],
      [1.9, 0, 0],
      [0, 0, 1.1],
      [1.9, 0, 1.1],
    ] as const;
    offsets.forEach(([x, y, z], index) => {
      matrix.makeTranslation(x, y, z);
      ref.current?.setMatrixAt(index, matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <AnimatedPart
      componentId="fastener.base.1"
      exploded={exploded}
      reducedMotion={reducedMotion}
      delay={0.12}
    >
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, 4]}
        onClick={(event) => {
          event.stopPropagation();
          const id = event.instanceId === undefined ? undefined : screwIds[event.instanceId];
          if (id) onSelect(id);
        }}
      >
        <cylinderGeometry args={[0.11, 0.11, 0.22, 20]} />
        <primitive
          attach="material"
          object={selectedId?.startsWith("fastener.base") ? materials.selected : materials.metal}
        />
      </instancedMesh>
      <PartLabel visible={selectedId?.startsWith("fastener.base") === true}>
        Four base screws
      </PartLabel>
    </AnimatedPart>
  );
}

export function BaseAssembly(props: AssemblyProps) {
  const { exploded, reducedMotion, selectedId, onSelect, materials } = props;
  const selected = (id: string, fallback: Material) =>
    selectedId === id ? materials.selected : fallback;

  return (
    <>
      <AnimatedPart
        componentId="base.cover"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.06}
      >
        <RoundedBox
          args={[4.45, 0.58, 2.85]}
          radius={0.48}
          smoothness={6}
          onClick={selectable(onSelect, "base.cover")}
        >
          <primitive attach="material" object={selected("base.cover", materials.base)} />
        </RoundedBox>
        <mesh position={[0, -0.31, 0]} scale={[1.78, 0.08, 1.08]}>
          <sphereGeometry args={[1, 44, 16]} />
          <primitive attach="material" object={materials.darkMetal} />
        </mesh>
        <PartLabel visible={selectedId === "base.cover"}>Base cover</PartLabel>
      </AnimatedPart>
      <Fasteners {...props} />
      <AnimatedPart
        componentId="battery.pack"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.18}
      >
        <RoundedBox
          args={[1.45, 0.42, 1.15]}
          radius={0.16}
          smoothness={4}
          onClick={selectable(onSelect, "battery.pack")}
        >
          <primitive attach="material" object={selected("battery.pack", materials.battery)} />
        </RoundedBox>
        <mesh position={[0.6, 0, 0]}>
          <boxGeometry args={[0.2, 0.18, 0.4]} />
          <primitive attach="material" object={materials.shell} />
        </mesh>
        <PartLabel visible={selectedId === "battery.pack"}>Battery module</PartLabel>
      </AnimatedPart>
      <AnimatedPart
        componentId="charge.board"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.18}
      >
        <RoundedBox
          args={[1.35, 0.12, 1.08]}
          radius={0.08}
          smoothness={3}
          onClick={selectable(onSelect, "charge.board")}
        >
          <primitive attach="material" object={selected("charge.board", materials.pcb)} />
        </RoundedBox>
        {[-0.42, 0, 0.42].map((x) => (
          <mesh key={x} position={[x, 0.11, 0]}>
            <boxGeometry args={[0.24, 0.13, 0.38]} />
            <primitive attach="material" object={materials.darkMetal} />
          </mesh>
        ))}
        <PartLabel visible={selectedId === "charge.board"}>Charge board</PartLabel>
      </AnimatedPart>
      <AnimatedPart
        componentId="usb.port"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.18}
      >
        <RoundedBox
          args={[0.4, 0.22, 0.54]}
          radius={0.08}
          smoothness={3}
          onClick={selectable(onSelect, "usb.port")}
        >
          <primitive attach="material" object={selected("usb.port", materials.metal)} />
        </RoundedBox>
        <PartLabel visible={selectedId === "usb.port"}>USB-C port</PartLabel>
      </AnimatedPart>
      <AnimatedPart
        componentId="main.switch"
        exploded={exploded}
        reducedMotion={reducedMotion}
        delay={0.18}
      >
        <mesh onClick={selectable(onSelect, "main.switch")}>
          <cylinderGeometry args={[0.22, 0.22, 0.22, 28]} />
          <primitive attach="material" object={selected("main.switch", materials.base)} />
        </mesh>
        <PartLabel visible={selectedId === "main.switch"}>Main switch</PartLabel>
      </AnimatedPart>
    </>
  );
}
