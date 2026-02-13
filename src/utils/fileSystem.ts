import type { CollectedImage } from "../types/gallery";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "avif",
  "heic",
  "heif"
]);

const STATIC_PREVIEW_EXTENSIONS = new Set(["gif", "webp"]);

type PickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };

type WalkState = {
  handle: FileSystemDirectoryHandle;
  path: string;
};

type Size = {
  width: number;
  height: number;
};

const DEFAULT_SIZE: Size = { width: 4, height: 3 };

export const isSupportedImageFileName = (name: string): boolean => {
  const extension = name.split(".").pop()?.toLowerCase();
  return Boolean(extension && IMAGE_EXTENSIONS.has(extension));
};

export const shouldUseStaticPreview = (name: string): boolean => {
  const extension = name.split(".").pop()?.toLowerCase();
  return Boolean(extension && STATIC_PREVIEW_EXTENSIONS.has(extension));
};

export const hasDirectoryPicker = (): boolean =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

export const getDirectoryPicker = (): (() => Promise<FileSystemDirectoryHandle>) | null => {
  if (typeof window === "undefined") return null;
  const picker = (window as PickerWindow).showDirectoryPicker;
  return typeof picker === "function" ? picker.bind(window) : null;
};

const byNameAsc = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base"
  });

export const sortCollectedImages = (
  images: CollectedImage[]
): CollectedImage[] =>
  [...images].sort(
    (a, b) =>
      byNameAsc(a, b) ||
      a.relativePath.localeCompare(b.relativePath, undefined, {
        numeric: true,
        sensitivity: "base"
      })
  );

const readImageSize = async (file: File): Promise<Size> => {
  if (typeof createImageBitmap !== "function") return DEFAULT_SIZE;

  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return DEFAULT_SIZE;
  }
};

export const collectImagesFromDirectory = async (
  root: FileSystemDirectoryHandle
): Promise<CollectedImage[]> => {
  const stack: WalkState[] = [{ handle: root, path: "" }];
  const collected: CollectedImage[] = [];

  while (stack.length) {
    const current = stack.pop()!;

    for await (const entry of current.handle.values()) {
      const name = entry.name;
      if (entry.kind === "directory") {
        const nextPath = current.path ? `${current.path}/${name}` : name;
        stack.push({
          handle: entry as FileSystemDirectoryHandle,
          path: nextPath
        });
        continue;
      }

      if (entry.kind !== "file" || !isSupportedImageFileName(name)) continue;

      const file = await (entry as FileSystemFileHandle).getFile();
      const relativePath = current.path ? `${current.path}/${name}` : name;
      const { width, height } = await readImageSize(file);

      collected.push({
        name,
        relativePath,
        lastModified: file.lastModified,
        size: file.size,
        width,
        height,
        file
      });
    }
  }

  return sortCollectedImages(collected);
};
