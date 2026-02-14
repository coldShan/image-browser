import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CollectedImageMeta, GalleryImage } from "../types/gallery";
import { collectImagesFromDirectory, getDirectoryPicker } from "../utils/fileSystem";
import { createResourceManager } from "../utils/resourceManager";

export type UseDirectoryImagesResult = {
  images: GalleryImage[];
  loading: boolean;
  error: string | null;
  pickDirectory: () => Promise<void>;
  clearImages: () => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
  syncLightboxWindow: (index: number) => Promise<Record<string, string>>;
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

  const imageMap = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images]
  );

  const clearImages = useCallback(() => {
    managerRef.current.releaseAll();
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
    async (index: number): Promise<Record<string, string>> =>
      managerRef.current.syncLightboxWindow(images, index),
    [images]
  );

  const releaseAllLightboxUrls = useCallback(() => {
    managerRef.current.releaseAllLightbox();
  }, []);

  const pickDirectory = useCallback(async () => {
    const picker = getDirectoryPicker();
    if (!picker) {
      setError("当前浏览器不支持目录选择，请使用最新版 Chrome/Edge");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const directory = await picker({ mode: "read" });
      const collected = await collectImagesFromDirectory(directory);
      const nextImages = collected.map((item, index) => toGalleryImage(item, index));

      managerRef.current.releaseAll();
      setImages(nextImages);

      if (!nextImages.length) {
        setError("No image files found in this folder.");
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
  }, []);

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
    clearImages,
    ensurePreviewUrl,
    releasePreviewUrl,
    syncLightboxWindow,
    releaseAllLightboxUrls
  };
};
