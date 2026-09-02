import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial } from "three";
import { prepareExplodableScene, splitGeometryComponents } from "../../src/scene/explode";

function disconnectedGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 4, 0, 0, 5, 0, 0, 4, 1, 0],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  return geometry;
}

describe("generated model part recovery", () => {
  it("welds duplicate seam vertices before finding disconnected components", () => {
    const components = splitGeometryComponents(disconnectedGeometry());

    expect(components).toHaveLength(2);
    expect(components.map((component) => component.triangleCount)).toEqual([2, 1]);

    for (const component of components) component.geometry.dispose();
  });

  it("keeps the largest component anchored and gives other parts an explode offset", () => {
    const mesh = new Mesh(disconnectedGeometry(), new MeshBasicMaterial());
    const prepared = prepareExplodableScene(mesh);

    expect(prepared.partCount).toBe(2);
    expect(prepared.parts.filter((part) => part.offset.lengthSq() === 0)).toHaveLength(1);
    expect(prepared.parts.filter((part) => part.offset.lengthSq() > 0)).toHaveLength(1);

    prepared.dispose();
    mesh.material.dispose();
  });
});
