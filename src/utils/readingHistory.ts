import type { GalleryImage } from "../types/gallery";

export const READING_HISTORY_STORAGE_KEY = "image-browser:reading-history:v1";
const MAX_SOURCE_ENTRIES = 30;

type StoreSourceMap = Record<string, SourceReadingState>;

export type LastViewedPointer = {
  relativePath: string;
  index: number;
  viewedAt: number;
};

export type AlbumReadingState = LastViewedPointer;

export type SourceReadingState = {
  lastViewed: LastViewedPointer | null;
  albums: Record<string, AlbumReadingState>;
  recentAlbumPath: string | null;
  updatedAt: number;
};

export type ReadingStore = {
  sources: StoreSourceMap;
};

type RecordViewedImageInput = {
  store: ReadingStore;
  sourceKey: string;
  image: Pick<GalleryImage, "relativePath">;
  index: number;
  viewedAt?: number;
};

type ResolveRestorePathInput = {
  images: Pick<GalleryImage, "relativePath">[];
  relativePath?: string | null;
  index?: number | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toPointer = (value: unknown): LastViewedPointer | null => {
  if (!isRecord(value)) return null;
  const relativePath = value.relativePath;
  const index = value.index;
  const viewedAt = value.viewedAt;
  if (typeof relativePath !== "string" || typeof index !== "number") return null;

  return {
    relativePath,
    index,
    viewedAt: typeof viewedAt === "number" ? viewedAt : 0
  };
};

const normalizeSourceState = (value: unknown): SourceReadingState | null => {
  if (!isRecord(value)) return null;
  const albumsRaw = isRecord(value.albums) ? value.albums : {};
  const albums: Record<string, AlbumReadingState> = {};

  for (const [path, pointer] of Object.entries(albumsRaw)) {
    const parsed = toPointer(pointer);
    if (!parsed) continue;
    albums[path] = parsed;
  }

  const lastViewed = toPointer(value.lastViewed);
  const recentAlbumPath =
    typeof value.recentAlbumPath === "string" ? value.recentAlbumPath : null;
  const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : 0;

  return {
    lastViewed,
    albums,
    recentAlbumPath,
    updatedAt
  };
};

const getEmptySourceState = (): SourceReadingState => ({
  lastViewed: null,
  albums: {},
  recentAlbumPath: null,
  updatedAt: 0
});

const hash = (input: string): string => {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
};

const toAlbumPath = (relativePath: string): string | null => {
  const separatorIndex = relativePath.indexOf("/");
  if (separatorIndex <= 0) return null;
  return relativePath.slice(0, separatorIndex);
};

const pruneSources = (sources: StoreSourceMap): StoreSourceMap => {
  const entries = Object.entries(sources);
  if (entries.length <= MAX_SOURCE_ENTRIES) return sources;

  return Object.fromEntries(
    entries
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SOURCE_ENTRIES)
  );
};

export const loadReadingStore = (): ReadingStore => {
  if (typeof window === "undefined") return { sources: {} };

  try {
    const raw = window.localStorage.getItem(READING_HISTORY_STORAGE_KEY);
    if (!raw) return { sources: {} };
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.sources)) return { sources: {} };

    const sources = Object.entries(parsed.sources).reduce<StoreSourceMap>(
      (current, [key, value]) => {
        const normalized = normalizeSourceState(value);
        if (!normalized) return current;
        current[key] = normalized;
        return current;
      },
      {}
    );

    return { sources };
  } catch {
    return { sources: {} };
  }
};

export const saveReadingStore = (store: ReadingStore): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READING_HISTORY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Silent fail: reading history is best-effort.
  }
};

export const makeSourceKey = (images: Pick<GalleryImage, "relativePath">[]): string => {
  if (!images.length) return "source:empty";
  const normalized = images
    .map((item) => item.relativePath)
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
    )
    .join("\n");

  return `source:${images.length}:${hash(normalized)}`;
};

export const getSourceState = (
  store: ReadingStore,
  sourceKey: string
): SourceReadingState => store.sources[sourceKey] ?? getEmptySourceState();

export const recordViewedImage = ({
  store,
  sourceKey,
  image,
  index,
  viewedAt = Date.now()
}: RecordViewedImageInput): ReadingStore => {
  if (!sourceKey) return store;
  const current = getSourceState(store, sourceKey);
  const albumPath = toAlbumPath(image.relativePath);
  const nextLastViewed: LastViewedPointer = {
    relativePath: image.relativePath,
    index,
    viewedAt
  };
  const nextAlbums = { ...current.albums };

  if (albumPath) {
    nextAlbums[albumPath] = nextLastViewed;
  }

  if (
    current.lastViewed?.relativePath === nextLastViewed.relativePath &&
    current.lastViewed.index === nextLastViewed.index &&
    (!albumPath ||
      (current.albums[albumPath]?.relativePath === nextLastViewed.relativePath &&
        current.albums[albumPath]?.index === nextLastViewed.index))
  ) {
    return store;
  }

  const nextSource: SourceReadingState = {
    lastViewed: nextLastViewed,
    albums: nextAlbums,
    recentAlbumPath: albumPath ?? current.recentAlbumPath,
    updatedAt: viewedAt
  };

  return {
    sources: pruneSources({
      ...store.sources,
      [sourceKey]: nextSource
    })
  };
};

export const resolveRestorePath = ({
  images,
  relativePath,
  index
}: ResolveRestorePathInput): string | null => {
  if (!images.length) return null;
  if (relativePath && images.some((item) => item.relativePath === relativePath)) {
    return relativePath;
  }
  if (typeof index === "number" && index >= 0 && index < images.length) {
    return images[index]?.relativePath ?? null;
  }
  return null;
};
