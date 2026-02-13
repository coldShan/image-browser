import { describe, expect, it } from "vitest";
import type { GalleryImage } from "../../types/gallery";
import { BLANK_IMAGE, toLightboxSlides } from "../lightbox";

const makeImage = (id: string, withDimensions: boolean): GalleryImage => ({
  id,
  name: `${id}.jpg`,
  relativePath: `${id}.jpg`,
  lastModified: 0,
  size: 0,
  sourceType: "other",
  ...(withDimensions ? { width: 1200, height: 800 } : {}),
  fileHandle: {
    kind: "file",
    name: `${id}.jpg`,
    getFile: async () => new File(["x"], `${id}.jpg`, { type: "image/jpeg" })
  } as unknown as FileSystemFileHandle
});

describe("toLightboxSlides", () => {
  it("does not include width/height for unknown dimensions", () => {
    const images = [makeImage("a", false)];
    const slides = toLightboxSlides(images, { a: "blob:a" });

    expect(Object.prototype.hasOwnProperty.call(slides[0], "width")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(slides[0], "height")).toBe(false);
    expect(slides[0].src).toBe("blob:a");
    expect(slides[0].alt).toBe("a.jpg");
  });

  it("falls back to blank source when lightbox url is missing", () => {
    const images = [makeImage("b", true)];
    const slides = toLightboxSlides(images, {});

    expect(slides[0].src).toBe(BLANK_IMAGE);
  });
});
