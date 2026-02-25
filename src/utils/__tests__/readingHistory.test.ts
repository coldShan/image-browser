import { beforeEach, describe, expect, it } from "vitest";
import type { GalleryImage } from "../../types/gallery";
import {
  getSourceState,
  loadReadingStore,
  makeSourceKey,
  recordViewedImage,
  resolveRestorePath,
  saveReadingStore,
  type ReadingStore
} from "../readingHistory";

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

describe("readingHistory", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads empty store when localStorage data is broken", () => {
    window.localStorage.setItem("image-browser:reading-history:v1", "{broken");

    const store = loadReadingStore();
    expect(store.sources).toEqual({});
  });

  it("stores and reads last viewed item and album state", () => {
    const images = [
      makeImage("1", "album-a/1.jpg"),
      makeImage("2", "album-a/2.jpg"),
      makeImage("3", "root.jpg")
    ];
    const sourceKey = makeSourceKey(images);
    const storedFromAllMode = recordViewedImage({
      store: loadReadingStore(),
      sourceKey,
      image: images[1],
      index: 1,
      scope: "all"
    });
    const next = recordViewedImage({
      store: storedFromAllMode,
      sourceKey,
      image: images[0],
      index: 0,
      scope: "album"
    });

    saveReadingStore(next);
    const loaded = loadReadingStore();
    const state = getSourceState(loaded, sourceKey);

    expect(state.allMode.lastViewed?.relativePath).toBe("album-a/2.jpg");
    expect(state.allMode.lastViewed?.index).toBe(1);
    expect(state.albumMode.recentAlbumPath).toBe("album-a");
    expect(state.albumMode.albums["album-a"]?.relativePath).toBe("album-a/1.jpg");
  });

  it("keeps only latest 30 source entries", () => {
    let store: ReadingStore = loadReadingStore();

    for (let index = 0; index < 31; index += 1) {
      const image = makeImage(String(index), `album-${index}/1.jpg`);
      store = recordViewedImage({
        store,
        sourceKey: `source-${index}`,
        image,
        index: 0,
        scope: "all",
        viewedAt: index + 1
      });
    }

    expect(Object.keys(store.sources)).toHaveLength(30);
    expect(store.sources["source-0"]).toBeUndefined();
    expect(store.sources["source-30"]).toBeDefined();
  });

  it("resolves restore path by relative path first, then falls back to index", () => {
    const images = [
      makeImage("1", "album-a/1.jpg"),
      makeImage("2", "album-a/2.jpg"),
      makeImage("3", "album-a/3.jpg")
    ];

    expect(
      resolveRestorePath({
        images,
        relativePath: "album-a/2.jpg",
        index: 0
      })
    ).toBe("album-a/2.jpg");

    expect(
      resolveRestorePath({
        images,
        relativePath: "album-a/missing.jpg",
        index: 2
      })
    ).toBe("album-a/3.jpg");

    expect(
      resolveRestorePath({
        images,
        relativePath: "album-a/missing.jpg",
        index: 10
      })
    ).toBeNull();
  });

  it("does not sync progress between all and album scopes", () => {
    const sourceKey = "source-a";
    const image = makeImage("1", "album-a/1.jpg");
    let store = loadReadingStore();

    store = recordViewedImage({
      store,
      sourceKey,
      image,
      index: 0,
      scope: "all"
    });
    let state = getSourceState(store, sourceKey);
    expect(state.albumMode.albums["album-a"]).toBeUndefined();

    store = recordViewedImage({
      store,
      sourceKey,
      image: makeImage("2", "album-a/2.jpg"),
      index: 1,
      scope: "album"
    });
    state = getSourceState(store, sourceKey);
    expect(state.allMode.lastViewed?.relativePath).toBe("album-a/1.jpg");
    expect(state.albumMode.albums["album-a"]?.relativePath).toBe("album-a/2.jpg");
  });
});
