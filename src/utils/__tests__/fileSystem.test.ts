import { describe, expect, it, vi } from "vitest";
import type { CollectedImageMeta, GallerySourceType } from "../../types/gallery";
import {
  collectImagesFromDirectory,
  getSourceType,
  isSupportedImageFileName,
  sortCollectedImages
} from "../fileSystem";

const makeImage = (name: string): CollectedImageMeta => ({
  name,
  relativePath: name,
  lastModified: 1,
  size: 1,
  sourceType: "other",
  width: 4,
  height: 3,
  fileHandle: { kind: "file", name } as FileSystemFileHandle
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

describe("getSourceType", () => {
  it("classifies source type by extension", () => {
    expect(getSourceType("a.gif")).toBe("gif");
    expect(getSourceType("a.WEBP")).toBe("webp");
    expect(getSourceType("a.jpg")).toBe("other");
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

describe("collectImagesFromDirectory", () => {
  it("collects image metadata without reading file content", async () => {
    const getFile = vi.fn(async () => new File(["image"], "photo.jpg"));
    const fileHandle = {
      kind: "file",
      name: "photo.jpg",
      getFile
    } as unknown as FileSystemFileHandle;

    const root = {
      kind: "directory",
      name: "root",
      async *values() {
        yield fileHandle as unknown as FileSystemHandle;
      }
    } as unknown as FileSystemDirectoryHandle;

    const images = await collectImagesFromDirectory(root);

    expect(getFile).not.toHaveBeenCalled();
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      name: "photo.jpg",
      relativePath: "photo.jpg",
      sourceType: "other" satisfies GallerySourceType
    });
    expect(images[0].fileHandle).toBe(fileHandle);
  });
});
