import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GalleryImage } from "../../types/gallery";
import { createResourceManager } from "../resourceManager";

const createImage = (
  id: string,
  name = `${id}.jpg`,
  contents = id
): GalleryImage => {
  const file = new File([contents], name, { type: "image/jpeg" });
  const getFile = vi.fn(async () => file);

  return {
    id,
    name,
    relativePath: name,
    lastModified: 0,
    size: file.size,
    sourceType: "other",
    width: 4,
    height: 3,
    fileHandle: {
      kind: "file",
      name,
      getFile
    } as unknown as FileSystemFileHandle
  };
};

describe("resourceManager", () => {
  beforeEach(() => {
    let seq = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => `blob:url-${seq++}`)
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
  });

  it("reuses preview url from cache without duplicate reads", async () => {
    const manager = createResourceManager({ previewCacheLimitBytes: 200 });
    const image = createImage("a");

    const first = await manager.ensurePreviewUrl(image);
    const second = await manager.ensurePreviewUrl(image);

    expect(first).toBe(second);
    expect(image.fileHandle.getFile).toHaveBeenCalledTimes(1);
  });

  it("evicts old preview urls when byte limit is exceeded", async () => {
    const manager = createResourceManager({ previewCacheLimitBytes: 5 });
    const first = createImage("first", "first.jpg", "1234");
    const second = createImage("second", "second.jpg", "56");

    await manager.ensurePreviewUrl(first);
    await manager.ensurePreviewUrl(second);

    expect(manager.getPreviewUrl(first.id)).toBeUndefined();
    expect(manager.getPreviewUrl(second.id)).toBeDefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("keeps only nearby lightbox urls around current index", async () => {
    const manager = createResourceManager({
      previewCacheLimitBytes: 200,
      lightboxPreloadDistance: 1,
      lightboxReleaseDistance: 2
    });
    const images = [createImage("0"), createImage("1"), createImage("2"), createImage("3")];

    await manager.syncLightboxWindow(images, 1);
    expect(Object.keys(manager.getLightboxSnapshot()).sort()).toEqual(["0", "1", "2"]);

    await manager.syncLightboxWindow(images, 3);
    expect(Object.keys(manager.getLightboxSnapshot()).sort()).toEqual(["1", "2", "3"]);
  });
});
