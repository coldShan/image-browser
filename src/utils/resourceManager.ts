import type { GalleryImage } from "../types/gallery";

type CacheEntry = {
  url: string;
  usedAt: number;
};

type CacheStore = Map<string, CacheEntry>;

type ManagerOptions = {
  previewCacheLimit?: number;
  lightboxPreloadDistance?: number;
  lightboxReleaseDistance?: number;
};

const DEFAULT_OPTIONS = {
  previewCacheLimit: 200,
  lightboxPreloadDistance: 1,
  lightboxReleaseDistance: 2
} satisfies Required<ManagerOptions>;

const markUsed = (entry: CacheEntry): CacheEntry => ({
  ...entry,
  usedAt: Date.now()
});

const oldestId = (cache: CacheStore): string | null => {
  let oldestKey: string | null = null;
  let oldestTime = Number.POSITIVE_INFINITY;

  for (const [id, entry] of cache) {
    if (entry.usedAt < oldestTime) {
      oldestKey = id;
      oldestTime = entry.usedAt;
    }
  }

  return oldestKey;
};

const revokeFromCache = (cache: CacheStore, id: string): void => {
  const entry = cache.get(id);
  if (!entry) return;
  URL.revokeObjectURL(entry.url);
  cache.delete(id);
};

const createStaticPreviewFromFile = async (file: File): Promise<string | null> => {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width || 1;
    canvas.height = bitmap.height || 1;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
};

export const createResourceManager = (options: ManagerOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const previewCache: CacheStore = new Map();
  const lightboxCache: CacheStore = new Map();
  const previewPending = new Map<string, Promise<string>>();
  const lightboxPending = new Map<string, Promise<string>>();

  const withCache = async (
    id: string,
    cache: CacheStore,
    pending: Map<string, Promise<string>>,
    producer: () => Promise<string>
  ): Promise<string> => {
    const cached = cache.get(id);
    if (cached) {
      cache.set(id, markUsed(cached));
      return cached.url;
    }

    const inflight = pending.get(id);
    if (inflight) return inflight;

    const task = producer().then((url) => {
      cache.set(id, { url, usedAt: Date.now() });
      pending.delete(id);
      return url;
    });

    pending.set(id, task);
    return task;
  };

  const enforcePreviewLimit = (): void => {
    while (previewCache.size > config.previewCacheLimit) {
      const id = oldestId(previewCache);
      if (!id) break;
      revokeFromCache(previewCache, id);
    }
  };

  const ensureFile = (image: GalleryImage): Promise<File> => image.fileHandle.getFile();

  const ensurePreviewUrl = async (image: GalleryImage): Promise<string> => {
    const url = await withCache(
      image.id,
      previewCache,
      previewPending,
      async (): Promise<string> => {
        const file = await ensureFile(image);
        if (image.sourceType === "gif" || image.sourceType === "webp") {
          const staticUrl = await createStaticPreviewFromFile(file);
          if (staticUrl) return staticUrl;
        }
        return URL.createObjectURL(file);
      }
    );

    enforcePreviewLimit();
    return url;
  };

  const ensureLightboxUrl = async (image: GalleryImage): Promise<string> =>
    withCache(image.id, lightboxCache, lightboxPending, async () => {
      const file = await ensureFile(image);
      return URL.createObjectURL(file);
    });

  const getPreviewUrl = (id: string): string | undefined => previewCache.get(id)?.url;

  const getLightboxUrl = (id: string): string | undefined => lightboxCache.get(id)?.url;

  const getLightboxSnapshot = (): Record<string, string> =>
    Object.fromEntries(Array.from(lightboxCache, ([id, entry]) => [id, entry.url]));

  const releasePreviewUrl = (id: string): void => revokeFromCache(previewCache, id);

  const releaseLightboxUrl = (id: string): void => revokeFromCache(lightboxCache, id);

  const releaseAllLightbox = (): void => {
    for (const [id] of lightboxCache) revokeFromCache(lightboxCache, id);
  };

  const releaseAll = (): void => {
    for (const [id] of previewCache) revokeFromCache(previewCache, id);
    releaseAllLightbox();
  };

  const syncLightboxWindow = async (
    images: GalleryImage[],
    currentIndex: number
  ): Promise<Record<string, string>> => {
    if (!images.length) return {};
    const lower = Math.max(0, currentIndex - config.lightboxPreloadDistance);
    const upper = Math.min(images.length - 1, currentIndex + config.lightboxPreloadDistance);

    await Promise.all(
      images.slice(lower, upper + 1).map((image) => ensureLightboxUrl(image))
    );

    for (let index = 0; index < images.length; index++) {
      if (Math.abs(index - currentIndex) <= config.lightboxReleaseDistance) continue;
      releaseLightboxUrl(images[index].id);
    }

    return getLightboxSnapshot();
  };

  return {
    ensurePreviewUrl,
    releasePreviewUrl,
    getPreviewUrl,
    ensureLightboxUrl,
    releaseLightboxUrl,
    getLightboxUrl,
    syncLightboxWindow,
    getLightboxSnapshot,
    releaseAllLightbox,
    releaseAll
  };
};

export type ResourceManager = ReturnType<typeof createResourceManager>;
