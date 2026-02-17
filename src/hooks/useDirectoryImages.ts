import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CollectedImageMeta, GalleryImage } from "../types/gallery";
import {
  collectImagesFromDirectory,
  getDirectoryPicker,
  openImageFilePicker
} from "../utils/fileSystem";
import { createResourceManager } from "../utils/resourceManager";

export type UseDirectoryImagesResult = {
  images: GalleryImage[];
  loading: boolean;
  error: string | null;
  pickDirectory: () => Promise<void>;
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
  const managerRef = useRef(createResourceManager());
  const currentDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);

  const imageMap = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images]
  );

  const clearImages = useCallback(() => {
    managerRef.current.releaseAll();
    currentDirectoryRef.current = null;
    setImages([]);
    setError(null);
  }, []);

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

  const pickDirectory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const picker = getDirectoryPicker();
      if (picker) {
        const directory = await picker({ mode: "read" });
        currentDirectoryRef.current = directory;
        applyCollectedImages(await collectImagesFromDirectory(directory));
      } else {
        currentDirectoryRef.current = null;
        applyCollectedImages(await openImageFilePicker());
      }
    } catch (error_) {
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
    } finally {
      setLoading(false);
    }
  }, [applyCollectedImages]);

  const refreshCurrentDirectory = useCallback(async () => {
    if (!currentDirectoryRef.current) return;

    try {
      setLoading(true);
      setError(null);
      applyCollectedImages(await collectImagesFromDirectory(currentDirectoryRef.current));
    } catch (error_) {
      const errorObject = error_ as DOMException | Error;
      if (
        errorObject instanceof DOMException &&
        errorObject.name === "NoModificationAllowedError"
      ) {
        setError("目录当前不可访问（可能只读或被系统占用），请重新选择其他目录。");
        return;
      }
      setError(errorObject.message || "Failed to read folder.");
    } finally {
      setLoading(false);
    }
  }, [applyCollectedImages]);

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
    refreshCurrentDirectory,
    canRefreshCurrentDirectory: currentDirectoryRef.current !== null,
    clearImages,
    ensurePreviewUrl,
    releasePreviewUrl,
    syncLightboxWindow,
    releaseAllLightboxUrls
  };
};
