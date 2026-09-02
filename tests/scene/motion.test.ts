import { Group } from "three";
import { getComponent } from "../../src/domain/repairGraph";
import { applyComponentTransform } from "../../src/scene/motion";

describe("reduced-motion component transforms", () => {
  it("applies the final exploded and assembled states without intermediate travel", () => {
    const group = new Group();
    const component = getComponent("battery.pack");
    expect(component).not.toBeNull();
    if (!component) throw new Error("Battery component is missing.");

    expect(applyComponentTransform(group, component.id, true)).toBe(true);
    expect(group.position.toArray()).toEqual(component.exploded.position);
    expect(group.rotation.toArray().slice(0, 3)).toEqual(component.exploded.rotation);
    expect(group.scale.toArray()).toEqual(component.exploded.scale);

    expect(applyComponentTransform(group, component.id, false)).toBe(true);
    expect(group.position.toArray()).toEqual(component.assembled.position);
    expect(group.rotation.toArray().slice(0, 3)).toEqual(component.assembled.rotation);
    expect(group.scale.toArray()).toEqual(component.assembled.scale);
  });

  it("leaves the scene unchanged for an unknown component", () => {
    const group = new Group();
    expect(applyComponentTransform(group, "unknown.component", true)).toBe(false);
    expect(group.position.toArray()).toEqual([0, 0, 0]);
  });
});
