import { createHash } from "node:crypto";
import type { CompressedImage, ImageMediaType } from "../../src/generation/contracts";
import { ApiError } from "./errors";

export const MAX_IMAGE_BYTES = 3_000_000;
const MAX_DIMENSION = 16_384;
const MAX_PIXELS = 40_000_000;
const STRICT_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface ValidatedImage {
  bytes: Buffer;
  mediaType: ImageMediaType;
  width: number;
  height: number;
  sha256: string;
  dataUrl: string;
}

function detectMediaType(bytes: Buffer): ImageMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 30 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function pngDimensions(bytes: Buffer): [number, number] | null {
  if (bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    return null;
  }
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function jpegDimensions(bytes: Buffer): [number, number] | null {
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) {
      offset += 1;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > bytes.length) {
      break;
    }
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }
    if (startOfFrame.has(marker) && segmentLength >= 7) {
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Buffer): [number, number] | null {
  const format = bytes.subarray(12, 16).toString("ascii");
  if (format === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes.readUIntLE(24, 3);
    const height = 1 + bytes.readUIntLE(27, 3);
    return [width, height];
  }
  if (format === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return [width, height];
  }
  if (
    format === "VP8 " &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
  return null;
}

function dimensions(bytes: Buffer, mediaType: ImageMediaType): [number, number] | null {
  if (mediaType === "image/png") {
    return pngDimensions(bytes);
  }
  if (mediaType === "image/jpeg") {
    return jpegDimensions(bytes);
  }
  return webpDimensions(bytes);
}

export function validateImage(
  input: CompressedImage,
  maximumBytes = MAX_IMAGE_BYTES,
): ValidatedImage {
  const estimatedBytes = Math.floor((input.base64.length * 3) / 4);
  if (estimatedBytes > maximumBytes + 2) {
    throw new ApiError(
      413,
      "IMAGE_TOO_LARGE",
      "The image is too large. Compress it to less than 3 MB and try again.",
      true,
    );
  }
  if (input.base64.length % 4 !== 0 || !STRICT_BASE64.test(input.base64)) {
    throw new ApiError(400, "INVALID_IMAGE", "The image data is not valid base64.");
  }
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.byteLength > maximumBytes) {
    throw new ApiError(
      413,
      "IMAGE_TOO_LARGE",
      "The image is too large. Compress it to less than 3 MB and try again.",
      true,
    );
  }
  const detectedMediaType = detectMediaType(bytes);
  if (!detectedMediaType) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Only JPEG, PNG, and WebP images are supported.",
    );
  }
  if (detectedMediaType !== input.mediaType) {
    throw new ApiError(400, "MIME_MISMATCH", "The image content does not match its media type.");
  }
  const size = dimensions(bytes, detectedMediaType);
  if (!size) {
    throw new ApiError(400, "INVALID_IMAGE", "The image header or dimensions are invalid.");
  }
  const [width, height] = size;
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION ||
    width * height > MAX_PIXELS
  ) {
    throw new ApiError(400, "INVALID_IMAGE", "The image dimensions are not supported.");
  }
  return {
    bytes,
    mediaType: detectedMediaType,
    width,
    height,
    sha256: createHash("sha256").update(bytes).digest("base64url"),
    dataUrl: `data:${detectedMediaType};base64,${input.base64}`,
  };
}
