import type { CompressedImage, ImageMediaType } from "../generation/contracts";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_SOURCE_IMAGE_BYTES = 24_000_000;
export const MAX_COMPRESSED_IMAGE_BYTES = 2_900_000;
export const MAX_COMPRESSED_IMAGE_DIMENSION = 2_048;

export interface PreparedImage {
  blob: Blob;
  image: CompressedImage;
  width: number;
  height: number;
}

function imageExtension(type: ImageMediaType): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function remoteImageName(url: URL, type: ImageMediaType): string {
  const candidate =
    url.pathname
      .split("/")
      .at(-1)
      ?.replace(/[^a-zA-Z0-9._-]/g, "-") ?? "";
  if (/\.(?:jpe?g|png|webp)$/i.test(candidate)) return candidate.slice(0, 120);
  return `remote-repair-image.${imageExtension(type)}`;
}

export async function loadImageFile(
  value: string,
  preferredName: string | undefined,
  signal: AbortSignal,
): Promise<File> {
  const pageUrl = typeof window === "undefined" ? "https://repair.invalid/" : window.location.href;
  const pageOrigin = new URL(pageUrl).origin;
  const requestedUrl = new URL(value, pageUrl);
  const sameOrigin = requestedUrl.origin === pageOrigin;
  if (
    (!sameOrigin && requestedUrl.protocol !== "https:") ||
    requestedUrl.username ||
    requestedUrl.password
  ) {
    throw new Error("Use a public HTTPS image URL without embedded credentials.");
  }
  signal.throwIfAborted();
  const response = await fetch(requestedUrl.href, {
    signal,
    mode: "cors",
    credentials: sameOrigin ? "same-origin" : "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("The image URL could not be loaded.");
  const responseUrl = new URL(response.url || requestedUrl.href, pageUrl);
  if (responseUrl.origin !== pageOrigin && responseUrl.protocol !== "https:") {
    throw new Error("The image URL redirected to an insecure location.");
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 24 MB.");
  }
  const type = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!isAcceptedImageType(type))
    throw new Error("The URL must return a JPEG, PNG, or WebP image.");
  const blob = await response.blob();
  signal.throwIfAborted();
  const file = new File([blob], preferredName ?? remoteImageName(responseUrl, type), { type });
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  return file;
}

function isAcceptedImageType(type: string): type is ImageMediaType {
  return ACCEPTED_IMAGE_TYPES.some((accepted) => accepted === type);
}

export function validateImageFile(file: File): string | null {
  if (!isAcceptedImageType(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size === 0) return "The selected image is empty.";
  if (file.size > MAX_SOURCE_IMAGE_BYTES) return "Choose an image smaller than 24 MB.";
  return null;
}

function abortError(): DOMException {
  return new DOMException("The image preparation was cancelled.", "AbortError");
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not prepare this image."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function blobBase64(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => {
      reader.abort();
      reject(abortError());
    };
    signal.addEventListener("abort", abort, { once: true });
    reader.addEventListener(
      "load",
      () => {
        signal.removeEventListener("abort", abort);
        const value = typeof reader.result === "string" ? reader.result : "";
        const separator = value.indexOf(",");
        if (separator < 0) reject(new Error("The browser could not read this image."));
        else resolve(value.slice(separator + 1));
      },
      { once: true },
    );
    reader.addEventListener(
      "error",
      () => {
        signal.removeEventListener("abort", abort);
        reject(new Error("The browser could not read this image."));
      },
      { once: true },
    );
    reader.readAsDataURL(blob);
  });
}

interface DrawableImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

async function loadDrawableImage(file: File, signal: AbortSignal): Promise<DrawableImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = sourceUrl;
    await new Promise<void>((resolve, reject) => {
      const abort = () => reject(abortError());
      signal.addEventListener("abort", abort, { once: true });
      image.decode().then(
        () => {
          signal.removeEventListener("abort", abort);
          resolve();
        },
        (error: unknown) => {
          signal.removeEventListener("abort", abort);
          reject(error);
        },
      );
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => {
        image.src = "";
        URL.revokeObjectURL(sourceUrl);
      },
    };
  } catch (error) {
    image.src = "";
    URL.revokeObjectURL(sourceUrl);
    throw error;
  }
}

export async function prepareImage(file: File, signal: AbortSignal): Promise<PreparedImage> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  signal.throwIfAborted();
  const drawable = await loadDrawableImage(file, signal);
  try {
    signal.throwIfAborted();
    const scale = Math.min(
      1,
      MAX_COMPRESSED_IMAGE_DIMENSION / Math.max(drawable.width, drawable.height),
    );
    let width = Math.max(1, Math.round(drawable.width * scale));
    let height = Math.max(1, Math.round(drawable.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot prepare images for upload.");
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      signal.throwIfAborted();
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#f4f2ec";
      context.fillRect(0, 0, width, height);
      context.drawImage(drawable.source, 0, 0, width, height);
      blob = await canvasBlob(canvas, Math.max(0.56, 0.9 - attempt * 0.06));
      if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break;
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
    if (!blob || blob.size > MAX_COMPRESSED_IMAGE_BYTES) {
      throw new Error("The image could not be reduced below 3 MB. Try a smaller photo.");
    }
    const base64 = await blobBase64(blob, signal);
    canvas.width = 1;
    canvas.height = 1;
    return {
      blob,
      image: { mediaType: "image/jpeg", base64 },
      width,
      height,
    };
  } finally {
    drawable.release();
  }
}
