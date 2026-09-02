import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";

const MAX_EXPLODED_PARTS = 48;

class DisjointSet {
  private readonly parents: number[];

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    let root = index;
    while (this.parents[root] !== root) {
      root = this.parents[root] ?? root;
    }
    while (this.parents[index] !== index) {
      const parent = this.parents[index];
      if (parent === undefined) break;
      this.parents[index] = root;
      index = parent;
    }
    return root;
  }

  join(left: number, right: number) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parents[rightRoot] = leftRoot;
  }
}

export interface GeometryComponent {
  center: Vector3;
  geometry: BufferGeometry;
  triangleCount: number;
}

export interface ExplodablePart {
  basePosition: Vector3;
  node: Object3D;
  offset: Vector3;
}

export interface PreparedExplodableScene {
  dispose: () => void;
  partCount: number;
  parts: ExplodablePart[];
  scene: Object3D;
}

function getVertexIndex(geometry: BufferGeometry, offset: number) {
  return geometry.getIndex()?.getX(offset) ?? offset;
}

function vertexKey(geometry: BufferGeometry, index: number) {
  const position = geometry.getAttribute("position");
  return `${position.getX(index)}|${position.getY(index)}|${position.getZ(index)}`;
}

function componentCenter(geometry: BufferGeometry, indices: number[]) {
  const position = geometry.getAttribute("position");
  const minimum = new Vector3(Infinity, Infinity, Infinity);
  const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  const visited = new Set<number>();
  for (const index of indices) {
    if (visited.has(index)) continue;
    visited.add(index);
    const vertex = new Vector3(position.getX(index), position.getY(index), position.getZ(index));
    minimum.min(vertex);
    maximum.max(vertex);
  }
  return minimum.add(maximum).multiplyScalar(0.5);
}

export function splitGeometryComponents(geometry: BufferGeometry): GeometryComponent[] {
  const position = geometry.getAttribute("position");
  if (!position || position.count < 3) return [];
  const elementCount = geometry.getIndex()?.count ?? position.count;
  const triangleCount = Math.floor(elementCount / 3);
  if (triangleCount === 0) return [];

  const sets = new DisjointSet(position.count);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const first = getVertexIndex(geometry, offset);
    const second = getVertexIndex(geometry, offset + 1);
    const third = getVertexIndex(geometry, offset + 2);
    sets.join(first, second);
    sets.join(second, third);
  }

  const firstVertexByPosition = new Map<string, number>();
  for (let index = 0; index < position.count; index += 1) {
    const key = vertexKey(geometry, index);
    const first = firstVertexByPosition.get(key);
    if (first === undefined) firstVertexByPosition.set(key, index);
    else sets.join(first, index);
  }

  const indicesByComponent = new Map<number, number[]>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const indices = [
      getVertexIndex(geometry, offset),
      getVertexIndex(geometry, offset + 1),
      getVertexIndex(geometry, offset + 2),
    ];
    const root = sets.find(indices[0] ?? 0);
    const component = indicesByComponent.get(root) ?? [];
    component.push(...indices);
    indicesByComponent.set(root, component);
  }

  if (indicesByComponent.size < 2 || indicesByComponent.size > MAX_EXPLODED_PARTS) return [];

  return [...indicesByComponent.values()]
    .sort((left, right) => right.length - left.length)
    .map((indices) => {
      const componentGeometry = geometry.clone();
      let largestIndex = 0;
      for (const index of indices) largestIndex = Math.max(largestIndex, index);
      const IndexArray = largestIndex > 65_535 ? Uint32Array : Uint16Array;
      componentGeometry.setIndex(new BufferAttribute(new IndexArray(indices), 1));
      componentGeometry.clearGroups();
      componentGeometry.setDrawRange(0, indices.length);
      return {
        center: componentCenter(geometry, indices),
        geometry: componentGeometry,
        triangleCount: indices.length / 3,
      };
    });
}

function geometryCenter(geometry: BufferGeometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3();
}

function localOffset(node: Object3D, worldOffset: Vector3) {
  const parent = node.parent;
  if (!parent) return worldOffset;
  const rotation = parent.getWorldQuaternion(new Quaternion()).invert();
  const scale = parent.getWorldScale(new Vector3());
  worldOffset.applyQuaternion(rotation);
  worldOffset.set(
    worldOffset.x / (scale.x || 1),
    worldOffset.y / (scale.y || 1),
    worldOffset.z / (scale.z || 1),
  );
  return worldOffset;
}

export function prepareExplodableScene(scene: Object3D): PreparedExplodableScene {
  const sceneBounds = new Box3().setFromObject(scene);
  const sceneCenter = sceneBounds.getCenter(new Vector3());
  const sceneSize = sceneBounds.getSize(new Vector3());
  const span = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) || 1;
  const disposable = new Set<BufferGeometry>();
  const candidates: Array<{
    center: Vector3;
    node: Object3D;
    triangleCount: number;
  }> = [];
  const meshes: Mesh[] = [];
  scene.traverse((node) => {
    if (node instanceof Mesh) meshes.push(node);
  });

  for (const mesh of meshes) {
    const components = Array.isArray(mesh.material) ? [] : splitGeometryComponents(mesh.geometry);
    if (components.length > 1) {
      const emptyGeometry = new BufferGeometry();
      disposable.add(emptyGeometry);
      mesh.geometry = emptyGeometry;
      components.forEach((component, index) => {
        const part = new Mesh(component.geometry, mesh.material);
        part.name = `${mesh.name || "mesh"}-part-${index + 1}`;
        part.castShadow = mesh.castShadow;
        part.receiveShadow = mesh.receiveShadow;
        part.renderOrder = mesh.renderOrder;
        mesh.add(part);
        disposable.add(component.geometry);
        candidates.push({
          center: component.center,
          node: part,
          triangleCount: component.triangleCount,
        });
      });
    } else {
      candidates.push({
        center: geometryCenter(mesh.geometry),
        node: mesh,
        triangleCount: Math.floor(
          (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute("position")?.count ?? 0) /
            3,
        ),
      });
    }
  }

  scene.updateMatrixWorld(true);
  const anchor = candidates.reduce<(typeof candidates)[number] | null>((largest, candidate) => {
    if (!largest || candidate.triangleCount > largest.triangleCount) return candidate;
    return largest;
  }, null);
  const parts = candidates.map((candidate, index) => {
    const basePosition = candidate.node.position.clone();
    if (candidate === anchor || candidates.length < 2) {
      return { basePosition, node: candidate.node, offset: new Vector3() };
    }
    const center = candidate.center.clone().applyMatrix4(candidate.node.matrixWorld);
    const direction = center.sub(sceneCenter);
    if (direction.lengthSq() < span * span * 0.0004) {
      const angle = index * 2.399963229728653;
      direction.set(Math.cos(angle), ((index % 3) - 1) * 0.4, Math.sin(angle));
    }
    const offset = localOffset(candidate.node, direction.normalize().multiplyScalar(span * 0.38));
    return { basePosition, node: candidate.node, offset };
  });

  return {
    dispose: () => {
      for (const geometry of disposable) geometry.dispose();
    },
    partCount: parts.length,
    parts,
    scene,
  };
}
