import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CollectedImageMeta, GalleryImage } from "../types/gallery";
import {
  canPersistDirectoryHandle,
  clearPersistedDirectoryHandle,
  collectImagesFromDirectory,
  getDirectoryPicker,
  loadPersistedDirectoryHandle,
  openImageFilePicker,
  persistDirectoryHandle,
  queryDirectoryPermission,
  requestDirectoryPermission
} from "../utils/fileSystem";
import { createResourceManager } from "../utils/resourceManager";

export type UseDirectoryImagesResult = {
  images: GalleryImage[];
  loading: boolean;
  error: string | null;
  pickDirectory: () => Promise<void>;
  restoreLastDirectory: () => Promise<void>;
  canRestoreLastDirectory: boolean;
  restoreLastDirectoryName: string | null;
  refreshCurrentDirectory: () => Promise<void>;
  canRefreshCurrentDirectory: boolean;
  clearImages: () => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
  syncLightboxWindow: (
    index: number,
    targetImages?: GalleryImage[]
  ) => Promise<Record<string, string>>;
  releaseAllLightboxUrls: () => void;
};

const toGalleryImage = (image: CollectedImageMeta, index: number): GalleryImage => ({
  ...image,
  id: `${image.relativePath}:${index}`
});

export const useDirectoryImages = (): UseDirectoryImagesResult => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<{
    handle: FileSystemDirectoryHandle;
    name: string;
  } | null>(null);
  const managerRef = useRef(createResourceManager());
  const currentDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);
  const restoreSupport = useMemo(canPersistDirectoryHandle, []);

  const imageMap = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images]
  );

  const clearImages = useCallback(() => {
    managerRef.current.releaseAll();
    if (currentDirectoryRef.current && restoreSupport) {
      setRestoreCandidate({
        handle: currentDirectoryRef.current,
        name: currentDirectoryRef.current.name
      });
    }
    currentDirectoryRef.current = null;
    setImages([]);
    setError(null);
  }, [restoreSupport]);

  const ensurePreviewUrl = useCallback(
    async (id: string): Promise<string | null> => {
      const image = imageMap.get(id);
      if (!image) return null;
      return managerRef.current.ensurePreviewUrl(image);
    },
    [imageMap]
  );

  const releasePreviewUrl = useCallback((id: string) => {
    managerRef.current.releasePreviewUrl(id);
  }, []);

  const syncLightboxWindow = useCallback(
    async (
      index: number,
      targetImages: GalleryImage[] = images
    ): Promise<Record<string, string>> =>
      managerRef.current.syncLightboxWindow(targetImages, index),
    [images]
  );

  const releaseAllLightboxUrls = useCallback(() => {
    managerRef.current.releaseAllLightbox();
  }, []);

  const applyCollectedImages = useCallback((collected: CollectedImageMeta[]) => {
    const nextImages = collected.map((item, index) => toGalleryImage(item, index));
    managerRef.current.releaseAll();
    setImages(nextImages);

    if (!nextImages.length) {
      setError("No image files found in this folder.");
      return;
    }
    setError(null);
  }, []);

  const applyDirectoryHandle = useCallback(
    async (
      directory: FileSystemDirectoryHandle,
      options: { persist?: boolean } = {}
    ) => {
      currentDirectoryRef.current = directory;
      setRestoreCandidate(null);
      if (options.persist && restoreSupport) {
        try {
          await persistDirectoryHandle(directory);
        } catch {
          // Best effort only; scanning should still continue.
        }
      }
      applyCollectedImages(await collectImagesFromDirectory(directory));
    },
    [applyCollectedImages, restoreSupport]
  );

  const handleDirectoryAccessError = useCallback(
    (error_: unknown) => {
      const errorObject = error_ as DOMException | Error;
      if (errorObject instanceof DOMException && errorObject.name === "AbortError") return;
      if (
        errorObject instanceof DOMException &&
        errorObject.name === "NoModificationAllowedError"
      ) {
        setError("目录当前不可访问（可能只读或被系统占用），请重新选择其他目录。");
        return;
      }
      setError(errorObject.message || "Failed to read folder.");
    },
    []
  );

  const pickDirectory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const picker = getDirectoryPicker();
      if (picker) {
        const directory = await picker({ mode: "read" });
        await applyDirectoryHandle(directory, { persist: true });
      } else {
        currentDirectoryRef.current = null;
        applyCollectedImages(await openImageFilePicker());
      }
    } catch (error_) {
      handleDirectoryAccessError(error_);
    } finally {
      setLoading(false);
    }
  }, [applyCollectedImages, applyDirectoryHandle, handleDirectoryAccessError]);

  const restoreLastDirectory = useCallback(async () => {
    if (!restoreCandidate) return;

    try {
      setLoading(true);
      setError(null);
      const permission = await requestDirectoryPermission(restoreCandidate.handle);
      if (permission !== "granted") {
        setError("需要目录访问权限后才能恢复上次目录。");
        return;
      }
      await applyDirectoryHandle(restoreCandidate.handle, { persist: true });
    } catch (error_) {
      handleDirectoryAccessError(error_);
    } finally {
      setLoading(false);
    }
  }, [applyDirectoryHandle, handleDirectoryAccessError, restoreCandidate]);

  const refreshCurrentDirectory = useCallback(async () => {
    if (!currentDirectoryRef.current) return;

    try {
      setLoading(true);
      setError(null);
      applyCollectedImages(await collectImagesFromDirectory(currentDirectoryRef.current));
    } catch (error_) {
      handleDirectoryAccessError(error_);
    } finally {
      setLoading(false);
    }
  }, [applyCollectedImages, handleDirectoryAccessError]);

  useEffect(() => {
    if (!restoreSupport) return;

    let cancelled = false;

    void (async () => {
      try {
        const handle = await loadPersistedDirectoryHandle();
        if (!handle || cancelled) return;

        const permission = await queryDirectoryPermission(handle);
        if (cancelled) return;

        if (permission === "granted") {
          setLoading(true);
          setError(null);
          try {
            await applyDirectoryHandle(handle);
          } catch (error_) {
            handleDirectoryAccessError(error_);
          } finally {
            if (!cancelled) setLoading(false);
          }
          return;
        }

        setRestoreCandidate({ handle, name: handle.name });
      } catch {
        await clearPersistedDirectoryHandle().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyDirectoryHandle, handleDirectoryAccessError, restoreSupport]);

  useEffect(
    () => () => {
      managerRef.current.releaseAll();
    },
    []
  );

  return {
    images,
    loading,
    error,
    pickDirectory,
    restoreLastDirectory,
    canRestoreLastDirectory: restoreCandidate !== null,
    restoreLastDirectoryName: restoreCandidate?.name ?? null,
    refreshCurrentDirectory,
    canRefreshCurrentDirectory: currentDirectoryRef.current !== null,
    clearImages,
    ensurePreviewUrl,
    releasePreviewUrl,
    syncLightboxWindow,
    releaseAllLightboxUrls
  };
};
