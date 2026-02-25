import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlbumSummary, GalleryImage } from "../types/gallery";
import { filterImagesByPath } from "../utils/albums";
import {
  getSourceState,
  loadReadingStore,
  recordViewedImage,
  resolveRestorePath,
  saveReadingStore,
  type SourceReadingState,
  type ViewScope
} from "../utils/readingHistory";

const DEFAULT_SAVE_DEBOUNCE_MS = 250;

type RecordViewInput = {
  image: GalleryImage;
  index: number;
  scope: ViewScope;
};

type UseReadingHistoryInput = {
  sourceKey: string;
  images: GalleryImage[];
  albums: AlbumSummary[];
  debounceMs?: number;
};

type UseReadingHistoryResult = {
  sourceState: SourceReadingState;
  recentAlbumPath: string | null;
  albumProgressByPath: Record<string, number>;
  recordView: (input: RecordViewInput) => void;
};

export const useReadingHistory = ({
  sourceKey,
  images,
  albums,
  debounceMs = DEFAULT_SAVE_DEBOUNCE_MS
}: UseReadingHistoryInput): UseReadingHistoryResult => {
  const [store, setStore] = useState(() => loadReadingStore());
  const timerRef = useRef<number | null>(null);
  const pendingStoreRef = useRef(store);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    saveReadingStore(pendingStoreRef.current);
  }, []);

  const scheduleSave = useCallback(
    (nextStore: typeof store) => {
      pendingStoreRef.current = nextStore;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, debounceMs);
    },
    [debounceMs, flush]
  );

  useEffect(() => {
    pendingStoreRef.current = store;
  }, [store]);

  useEffect(() => flush, [flush]);

  const recordView = useCallback(
    ({ image, index, scope }: RecordViewInput) => {
      setStore((current) => {
        const next = recordViewedImage({
          store: current,
          sourceKey,
          image,
          index,
          scope
        });
        if (next === current) return current;
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, sourceKey]
  );

  const sourceState = useMemo(() => getSourceState(store, sourceKey), [sourceKey, store]);
  const recentAlbumPath = sourceState.albumMode.recentAlbumPath;

  const albumProgressByPath = useMemo(
    () =>
      albums.reduce<Record<string, number>>((current, album) => {
        const pointer = sourceState.albumMode.albums[album.path];
        if (!pointer || album.imageCount <= 0) {
          current[album.path] = 0;
          return current;
        }

        const albumImages = filterImagesByPath(images, album.path);
        const restorePath = resolveRestorePath({
          images: albumImages,
          relativePath: pointer.relativePath,
          index: pointer.index
        });
        if (!restorePath) {
          current[album.path] = 0;
          return current;
        }

        const restoreIndex = albumImages.findIndex(
          (image) => image.relativePath === restorePath
        );
        current[album.path] =
          restoreIndex >= 0
            ? Math.min(Math.max((restoreIndex + 1) / album.imageCount, 0), 1)
            : 0;
        return current;
      }, {}),
    [albums, images, sourceState.albumMode.albums]
  );

  return {
    sourceState,
    recentAlbumPath,
    albumProgressByPath,
    recordView
  };
};
