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

type FileInputLike = HTMLInputElement & {
  webkitdirectory?: boolean;
};

type WalkState = {
  handle: FileSystemDirectoryHandle;
  path: string;
};

type PersistedDirectoryRecord = {
  key: string;
  handle: FileSystemDirectoryHandle;
};

const DIRECTORY_HANDLE_DB_NAME = "image-browser:directory-handles:v1";
const DIRECTORY_HANDLE_STORE_NAME = "handles";
const LAST_DIRECTORY_KEY = "last-directory";

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

export const canPersistDirectoryHandle = (): boolean =>
  hasDirectoryPicker() && typeof indexedDB !== "undefined";

export const hasImagePicker = (): boolean =>
  hasDirectoryPicker() || typeof document !== "undefined";

export const getDirectoryPicker = ():
  | ((options?: DirectoryPickerOptionsLike) => Promise<FileSystemDirectoryHandle>)
  | null => {
  if (typeof window === "undefined") return null;
  const picker = (window as PickerWindow).showDirectoryPicker;
  return typeof picker === "function" ? picker.bind(window) : null;
};

const openDirectoryHandleStore = async (): Promise<IDBDatabase | null> => {
  if (!canPersistDirectoryHandle()) return null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_HANDLE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(DIRECTORY_HANDLE_STORE_NAME)) return;
      database.createObjectStore(DIRECTORY_HANDLE_STORE_NAME, { keyPath: "key" });
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open directory handle store."));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

const runDirectoryHandleStoreRequest = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> => {
  const database = await openDirectoryHandleStore();
  if (!database) return undefined;

  try {
    return await new Promise((resolve, reject) => {
      const request = action(
        database.transaction(DIRECTORY_HANDLE_STORE_NAME, mode).objectStore(
          DIRECTORY_HANDLE_STORE_NAME
        )
      );

      request.onerror = () => {
        reject(request.error ?? new Error("Directory handle store request failed."));
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  } finally {
    database.close?.();
  }
};

const isPersistedDirectoryRecord = (
  value: unknown
): value is PersistedDirectoryRecord =>
  typeof value === "object" &&
  value !== null &&
  "handle" in value &&
  (value as PersistedDirectoryRecord).handle?.kind === "directory";

export const loadPersistedDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const record = await runDirectoryHandleStoreRequest(
    "readonly",
    (store) => store.get(LAST_DIRECTORY_KEY)
  );
  return isPersistedDirectoryRecord(record) ? record.handle : null;
};

export const persistDirectoryHandle = async (
  handle: FileSystemDirectoryHandle
): Promise<void> => {
  await runDirectoryHandleStoreRequest("readwrite", (store) =>
    store.put({ key: LAST_DIRECTORY_KEY, handle })
  );
};

export const clearPersistedDirectoryHandle = async (): Promise<void> => {
  await runDirectoryHandleStoreRequest("readwrite", (store) =>
    store.delete(LAST_DIRECTORY_KEY)
  );
};

export const queryDirectoryPermission = async (
  handle: FileSystemHandle,
  mode: "read" | "readwrite" = "read"
): Promise<FileSystemPermissionState> => {
  const queryPermission = handle.queryPermission;
  if (typeof queryPermission !== "function") return "prompt";
  return queryPermission.call(handle, { mode });
};

export const requestDirectoryPermission = async (
  handle: FileSystemHandle,
  mode: "read" | "readwrite" = "read"
): Promise<FileSystemPermissionState> => {
  const requestPermission = handle.requestPermission;
  if (typeof requestPermission !== "function") {
    return queryDirectoryPermission(handle, mode);
  }
  return requestPermission.call(handle, { mode });
};

const toVirtualFileHandle = (file: File): FileSystemFileHandle =>
  ({
    kind: "file",
    name: file.name,
    getFile: async () => file
  }) as unknown as FileSystemFileHandle;

const toRelativePath = (file: File): string => {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relativePath && relativePath.length > 0 ? relativePath : file.name;
};

export const collectImagesFromFiles = (files: Iterable<File>): CollectedImageMeta[] =>
  sortCollectedImages(
    Array.from(files)
      .filter((file) => isSupportedImageFileName(file.name))
      .map((file) => ({
        name: file.name,
        relativePath: toRelativePath(file),
        lastModified: file.lastModified,
        size: file.size,
        sourceType: getSourceType(file.name),
        fileHandle: toVirtualFileHandle(file)
      }))
  );

export const openImageFilePicker = (): Promise<CollectedImageMeta[]> => {
  if (typeof document === "undefined") return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    const input = document.createElement("input") as FileInputLike;
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";
    input.webkitdirectory = true;
    input.style.position = "fixed";
    input.style.left = "-9999px";

    const container = document.body ?? document.documentElement;
    container.appendChild(input);

    let settled = false;
    let focusTimer: number | null = null;

    const finish = (task: () => void) => {
      if (settled) return;
      settled = true;
      if (focusTimer !== null) window.clearTimeout(focusTimer);
      window.removeEventListener("focus", onWindowFocus);
      input.remove();
      task();
    };

    const onChange = () => {
      const files = Array.from(input.files ?? []);
      finish(() => resolve(collectImagesFromFiles(files)));
    };

    const onCancel = () => {
      finish(() =>
        reject(new DOMException("The user aborted a request.", "AbortError"))
      );
    };

    const onWindowFocus = () => {
      focusTimer = window.setTimeout(() => {
        if (settled) return;
        const files = Array.from(input.files ?? []);
        if (files.length) {
          finish(() => resolve(collectImagesFromFiles(files)));
          return;
        }
        onCancel();
      }, 300);
    };

    input.addEventListener("change", onChange, { once: true });
    input.addEventListener("cancel", onCancel as EventListener, { once: true });
    window.addEventListener("focus", onWindowFocus, { once: true });
    input.click();
  });
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
