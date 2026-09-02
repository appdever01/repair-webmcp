import { MAX_IMAGE_BYTES, validateImage } from "../../api/_lib/image";
import { jpegImage, pngImage, webpImage } from "./fixtures";

describe("generation image validation", () => {
  it.each([
    [pngImage(), "image/png", 64, 48],
    [jpegImage(), "image/jpeg", 64, 48],
    [webpImage(), "image/webp", 64, 48],
  ] as const)("accepts validated image headers", (input, mediaType, width, height) => {
    expect(validateImage(input)).toMatchObject({ mediaType, width, height });
  });

  it("rejects MIME spoofing", () => {
    const image = pngImage();
    expect(() => validateImage({ ...image, mediaType: "image/jpeg" })).toThrow(
      expect.objectContaining({ code: "MIME_MISMATCH" }),
    );
  });

  it("returns a useful error for oversized decoded input", () => {
    const image = pngImage(64, 48, MAX_IMAGE_BYTES);
    expect(() => validateImage(image)).toThrow(
      expect.objectContaining({ status: 413, code: "IMAGE_TOO_LARGE" }),
    );
  });

  it("rejects invalid base64 and unreasonable dimensions", () => {
    expect(() => validateImage({ mediaType: "image/png", base64: "%%%%" })).toThrow(
      expect.objectContaining({ code: "INVALID_IMAGE" }),
    );
    expect(() => validateImage(pngImage(16_385, 1))).toThrow(
      expect.objectContaining({ code: "INVALID_IMAGE" }),
    );
  });
});
