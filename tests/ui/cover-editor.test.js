import { describe, expect, it } from "vitest";
import { buildSchema } from "../../src/ui/editor.js";

const names = (schema) => schema.flatMap((item) => (item.schema ? names(item.schema) : [item.name]));

describe("editor for a cover", () => {
  it("shows the position fields of the value mode: drag, range, unit, decimals", () => {
    const fields = names(buildSchema({ entity: "cover.living_room" }));
    for (const name of ["drag", "min", "max", "step", "unit", "decimals"]) expect(fields).toContain(name);
    expect(fields).not.toContain("hold_reverse");
  });

  it("offers drag only while the cover is its own bar", () => {
    expect(names(buildSchema({ entity: "cover.a", mode: "value" }))).toContain("drag");
    expect(names(buildSchema({ entity: "cover.a", mode: "value", bar: { entity: "sensor.x" } }))).not.toContain("drag");
  });

  it("keeps the state fields for a cover config with states or a bar attribute and for an explicit mode", () => {
    for (const extra of [{ states: [{ value: "open" }] }, { bar: { attribute: "current_position" } }, { mode: "state" }]) {
      const fields = names(buildSchema({ entity: "cover.living_room", ...extra }));
      expect(fields).toContain("hold_reverse");
      expect(fields).toContain("allow_unavailable_actions");
    }
  });

  it("does not change the fields of other domains", () => {
    expect(names(buildSchema({ entity: "switch.a" }))).toContain("hold_reverse");
    expect(names(buildSchema({ entity: "sensor.a" }))).not.toContain("drag");
  });
});
