import { render } from "@testing-library/react";
import { REPAIR_ICON_NAMES, RepairIcon } from "../../src/design/RepairIcon";

describe("repair icon system", () => {
  it("renders every semantic icon through the private IconJar package", () => {
    const { container } = render(
      REPAIR_ICON_NAMES.map((name) => <RepairIcon key={name} name={name} />),
    );

    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(REPAIR_ICON_NAMES.length);
    for (const icon of icons) {
      expect(icon.getAttribute("width")).toBe("20");
      expect(icon.getAttribute("height")).toBe("20");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("includes dedicated icons for copy, reset, and overflow actions", () => {
    expect(REPAIR_ICON_NAMES).toEqual(expect.arrayContaining(["copy", "reset", "more"]));
  });
});
