import type { CollectedImageMeta, GallerySourceType } from "../types/gallery";

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

const SOURCE_TYPE_BY_EXTENSION: Partial<Record<string, GallerySourceType>> = {
  gif: "gif",
  webp: "webp"
};

type PickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: (
      options?: DirectoryPickerOptionsLike
    ) => Promise<FileSystemDirectoryHandle>;
  };

type DirectoryPickerOptionsLike = {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle | string;
};

type WalkState = {
  handle: FileSystemDirectoryHandle;
  path: string;
};

const SKIPPABLE_DIRECTORY_ERROR_NAMES = new Set([
  "NoModificationAllowedError",
  "NotAllowedError",
  "NotReadableError",
  "SecurityError",
  "NotFoundError"
]);

const isSkippableDirectoryError = (error: unknown): boolean =>
  error instanceof DOMException && SKIPPABLE_DIRECTORY_ERROR_NAMES.has(error.name);

export const isSupportedImageFileName = (name: string): boolean => {
  const extension = name.split(".").pop()?.toLowerCase();
  return Boolean(extension && IMAGE_EXTENSIONS.has(extension));
};

export const getSourceType = (name: string): GallerySourceType => {
  const extension = name.split(".").pop()?.toLowerCase();
  if (!extension) return "other";
  return SOURCE_TYPE_BY_EXTENSION[extension] ?? "other";
};

export const hasDirectoryPicker = (): boolean =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

export const getDirectoryPicker = ():
  | ((options?: DirectoryPickerOptionsLike) => Promise<FileSystemDirectoryHandle>)
  | null => {
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
  images: CollectedImageMeta[]
): CollectedImageMeta[] =>
  [...images].sort(
    (a, b) =>
      byNameAsc(a, b) ||
      a.relativePath.localeCompare(b.relativePath, undefined, {
        numeric: true,
        sensitivity: "base"
      })
  );

export const collectImagesFromDirectory = async (
  root: FileSystemDirectoryHandle
): Promise<CollectedImageMeta[]> => {
  const stack: WalkState[] = [{ handle: root, path: "" }];
  const collected: CollectedImageMeta[] = [];

  while (stack.length) {
    const current = stack.pop()!;
    try {
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

        const fileHandle = entry as FileSystemFileHandle;
        const relativePath = current.path ? `${current.path}/${name}` : name;

        collected.push({
          name,
          relativePath,
          lastModified: 0,
          size: 0,
          sourceType: getSourceType(name),
          fileHandle
        });
      }
    } catch (error) {
      if (isSkippableDirectoryError(error)) continue;
      throw error;
    }
  }

  return sortCollectedImages(collected);
};
