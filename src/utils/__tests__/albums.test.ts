import { describe, expect, it } from "vitest";
import type { GalleryImage } from "../../types/gallery";
import { buildAlbums, filterImagesByPath, isUnderPath } from "../albums";

const makeImage = (id: string, relativePath: string): GalleryImage => ({
  id,
  name: relativePath.split("/").pop() ?? relativePath,
  relativePath,
  lastModified: 0,
  size: 0,
  sourceType: "other",
  fileHandle: {
    kind: "file",
    name: relativePath
  } as unknown as FileSystemFileHandle
});

describe("buildAlbums", () => {
  it("creates albums from only first-level directories", () => {
    const albums = buildAlbums([
      makeImage("1", "root.jpg"),
      makeImage("2", "album-b/cover.jpg"),
      makeImage("3", "album-a/page-2.jpg"),
      makeImage("4", "album-a/page-1.jpg"),
      makeImage("5", "album-a/sub/page-3.jpg")
    ]);

    expect(albums.map((item) => item.path)).toEqual(["album-a", "album-b"]);
  });

  it("uses first image by natural relative-path ordering as cover", () => {
    const [album] = buildAlbums([
      makeImage("1", "album-a/page-10.jpg"),
      makeImage("2", "album-a/page-2.jpg"),
      makeImage("3", "album-a/page-1.jpg")
    ]);

    expect(album).toMatchObject({
      path: "album-a",
      title: "album-a",
      coverImageId: "3",
      coverRelativePath: "album-a/page-1.jpg",
      imageCount: 3
    });
  });
});

describe("isUnderPath", () => {
  it("matches descendants under a directory path", () => {
    expect(isUnderPath("album-a/page-1.jpg", "album-a")).toBe(true);
    expect(isUnderPath("album-a/sub/page-2.jpg", "album-a")).toBe(true);
    expect(isUnderPath("album-b/page-1.jpg", "album-a")).toBe(false);
  });
});

describe("filterImagesByPath", () => {
  it("returns all images when path is empty", () => {
    const images = [makeImage("1", "root.jpg"), makeImage("2", "album-a/a.jpg")];
    expect(filterImagesByPath(images, "")).toEqual(images);
  });

  it("returns images under path recursively", () => {
    const images = [
      makeImage("1", "root.jpg"),
      makeImage("2", "album-a/page-1.jpg"),
      makeImage("3", "album-a/sub/page-2.jpg"),
      makeImage("4", "album-b/page-1.jpg")
    ];

    expect(filterImagesByPath(images, "album-a").map((item) => item.relativePath)).toEqual([
      "album-a/page-1.jpg",
      "album-a/sub/page-2.jpg"
    ]);
  });
});
