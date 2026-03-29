import { describe, expect, it } from "vitest";
import type { GalleryImage } from "../../types/gallery";
import {
  buildAlbums,
  filterImagesByPath,
  ROOT_ALBUM_PATH,
  ROOT_ALBUM_TITLE
} from "../albums";

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
  it("creates a current-directory album when root images exist", () => {
    const albums = buildAlbums([
      makeImage("1", "root-b.jpg"),
      makeImage("2", "album-b/cover.jpg"),
      makeImage("3", "root-a.jpg")
    ]);

    expect(albums.map((item) => item.path)).toEqual([ROOT_ALBUM_PATH, "album-b"]);
    expect(albums[0]).toMatchObject({
      path: ROOT_ALBUM_PATH,
      title: ROOT_ALBUM_TITLE,
      coverImageId: "3",
      coverRelativePath: "root-a.jpg",
      imageCount: 2
    });
  });

  it("creates parent and second-level albums side by side", () => {
    const albums = buildAlbums([
      makeImage("1", "album-b/cover.jpg"),
      makeImage("2", "album-a/page-2.jpg"),
      makeImage("3", "album-a/page-1.jpg"),
      makeImage("4", "album-a/sub/page-3.jpg"),
      makeImage("5", "album-a/sub/deeper/page-4.jpg")
    ]);

    expect(albums).toEqual([
      expect.objectContaining({
        path: "album-a",
        imageCount: 2
      }),
      expect.objectContaining({
        path: "album-a/sub",
        imageCount: 2
      }),
      expect.objectContaining({
        path: "album-b",
        imageCount: 1
      })
    ]);
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

describe("filterImagesByPath", () => {
  it("returns all images when path is empty", () => {
    const images = [makeImage("1", "root.jpg"), makeImage("2", "album-a/a.jpg")];
    expect(filterImagesByPath(images, "")).toEqual(images);
  });

  it("returns only root-level images for the current-directory album", () => {
    const images = [
      makeImage("1", "root.jpg"),
      makeImage("2", "album-a/page-1.jpg"),
      makeImage("3", "another-root.png")
    ];

    expect(filterImagesByPath(images, ROOT_ALBUM_PATH).map((item) => item.relativePath)).toEqual([
      "root.jpg",
      "another-root.png"
    ]);
  });

  it("returns only direct images for a first-level album", () => {
    const images = [
      makeImage("1", "root.jpg"),
      makeImage("2", "album-a/page-1.jpg"),
      makeImage("3", "album-a/sub/page-2.jpg"),
      makeImage("4", "album-b/page-1.jpg")
    ];

    expect(filterImagesByPath(images, "album-a").map((item) => item.relativePath)).toEqual([
      "album-a/page-1.jpg"
    ]);
  });

  it("returns second-level album images together with deeper descendants", () => {
    const images = [
      makeImage("1", "root.jpg"),
      makeImage("2", "album-a/page-1.jpg"),
      makeImage("3", "album-a/sub/page-2.jpg"),
      makeImage("4", "album-a/sub/deeper/page-3.jpg"),
      makeImage("5", "album-b/page-1.jpg")
    ];

    expect(filterImagesByPath(images, "album-a/sub").map((item) => item.relativePath)).toEqual([
      "album-a/sub/page-2.jpg",
      "album-a/sub/deeper/page-3.jpg"
    ]);
  });
});
