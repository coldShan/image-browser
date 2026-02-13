import { describe, expect, it } from "vitest";
import type { CollectedImage } from "../../types/gallery";
import {
  isSupportedImageFileName,
  shouldUseStaticPreview,
  sortCollectedImages
} from "../fileSystem";

const makeImage = (name: string): CollectedImage => ({
  name,
  relativePath: name,
  lastModified: 1,
  size: 1,
  width: 4,
  height: 3,
  file: new File(["x"], name, { type: "image/jpeg" })
});

describe("isSupportedImageFileName", () => {
  it("accepts configured image extensions", () => {
    expect(isSupportedImageFileName("a.jpg")).toBe(true);
    expect(isSupportedImageFileName("a.JPEG")).toBe(true);
    expect(isSupportedImageFileName("a.avif")).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    expect(isSupportedImageFileName("a.txt")).toBe(false);
    expect(isSupportedImageFileName("a")).toBe(false);
  });
});

describe("shouldUseStaticPreview", () => {
  it("marks gif and webp as static-preview targets", () => {
    expect(shouldUseStaticPreview("a.gif")).toBe(true);
    expect(shouldUseStaticPreview("a.WEBP")).toBe(true);
    expect(shouldUseStaticPreview("a.jpg")).toBe(false);
  });
});

describe("sortCollectedImages", () => {
  it("sorts names with numeric ordering", () => {
    const result = sortCollectedImages([
      makeImage("img-10.jpg"),
      makeImage("img-2.jpg"),
      makeImage("img-1.jpg")
    ]);

    expect(result.map((item) => item.name)).toEqual([
      "img-1.jpg",
      "img-2.jpg",
      "img-10.jpg"
    ]);
  });
});
