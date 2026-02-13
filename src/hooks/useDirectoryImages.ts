import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectedImage, GalleryImage } from "../types/gallery";
import {
  collectImagesFromDirectory,
  getDirectoryPicker,
  shouldUseStaticPreview
} from "../utils/fileSystem";
import {
  createManagedObjectUrl,
  createUrlRegistry,
  releaseAllObjectUrls,
  type UrlRegistry
} from "../utils/imageUrl";

export type UseDirectoryImagesResult = {
  images: GalleryImage[];
  loading: boolean;
  error: string | null;
  pickDirectory: () => Promise<void>;
  clearImages: () => void;
};

const toGalleryImage = (
  image: CollectedImage,
  url: string,
  previewUrl: string,
  index: number
): GalleryImage => ({
  id: `${image.relativePath}:${image.lastModified}:${image.size}:${index}`,
  name: image.name,
  relativePath: image.relativePath,
  lastModified: image.lastModified,
  size: image.size,
  width: image.width,
  height: image.height,
  url,
  previewUrl
});

const createStaticPreviewUrl = async (
  file: File,
  registry: UrlRegistry
): Promise<string | null> => {
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

    return blob ? createManagedObjectUrl(blob, registry) : null;
  } catch {
    return null;
  }
};

export const useDirectoryImages = (): UseDirectoryImagesResult => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registryRef = useRef(createUrlRegistry());

  const clearImages = useCallback(() => {
    releaseAllObjectUrls(registryRef.current);
    setImages([]);
    setError(null);
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

      const directory = await picker();
      const collected = await collectImagesFromDirectory(directory);
      const nextRegistry = createUrlRegistry();
      const nextImages = await Promise.all(
        collected.map(async (item, index) => {
          const url = createManagedObjectUrl(item.file, nextRegistry);
          const previewUrl =
            shouldUseStaticPreview(item.name)
              ? await createStaticPreviewUrl(item.file, nextRegistry)
              : null;

          return toGalleryImage(item, url, previewUrl ?? url, index);
        })
      );

      releaseAllObjectUrls(registryRef.current);
      registryRef.current = nextRegistry;
      setImages(nextImages);

      if (!nextImages.length) {
        setError("No image files found in this folder.");
      }
    } catch (error_) {
      const errorObject = error_ as DOMException | Error;
      if (errorObject instanceof DOMException && errorObject.name === "AbortError") return;
      setError(errorObject.message || "Failed to read folder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(
    () => () => {
      releaseAllObjectUrls(registryRef.current);
    },
    []
  );

  return { images, loading, error, pickDirectory, clearImages };
};
