import { modelRequestHeaders } from "../../src/scene/modelRequest";

describe("model request headers", () => {
  it("sends the session only to the same-origin asset route", () => {
    expect(modelRequestHeaders("/api/object/asset?jobId=abc.def", "session-token")).toEqual({
      Authorization: "Bearer session-token",
    });
    expect(modelRequestHeaders("https://assets.meshy.ai/model.glb", "session-token")).toEqual({});
    expect(modelRequestHeaders("data:model/gltf-binary;base64,AAAA", "session-token")).toEqual({});
    expect(modelRequestHeaders("/api/object/asset?jobId=abc.def", null)).toEqual({});
  });
});
