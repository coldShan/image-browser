import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDirectoryImages } from "../useDirectoryImages";

describe("useDirectoryImages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:preview")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
  });

  it("scans metadata first and reads file only when preview is requested", async () => {
    const getFile = vi.fn(async () => new File(["x"], "photo.jpg", { type: "image/jpeg" }));
    const fileHandle = {
      kind: "file",
      name: "photo.jpg",
      getFile
    } as unknown as FileSystemFileHandle;
    const directory = {
      kind: "directory",
      name: "root",
      async *values() {
        yield fileHandle as unknown as FileSystemHandle;
      }
    } as unknown as FileSystemDirectoryHandle;
    const picker = vi.fn(async () => directory);

    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      writable: true,
      value: picker
    });

    const { result } = renderHook(() => useDirectoryImages());

    await act(async () => {
      await result.current.pickDirectory();
    });

    expect(picker).toHaveBeenCalledWith({ mode: "read" });
    expect(result.current.images).toHaveLength(1);
    expect(getFile).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.ensurePreviewUrl(result.current.images[0].id);
    });

    expect(getFile).toHaveBeenCalledTimes(1);
  });

  it("falls back to file picker when directory picker is unavailable", async () => {
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      writable: true,
      value: undefined
    });

    const selected = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(selected, "webkitRelativePath", {
      configurable: true,
      value: "album/photo.jpg"
    });

    const input = document.createElement("input");
    Object.defineProperty(input, "files", {
      configurable: true,
      get: () => [selected] as unknown as FileList
    });
    const click = vi.spyOn(input, "click").mockImplementation(() => {
      input.dispatchEvent(new Event("change"));
    });

    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi.spyOn(document, "createElement");
    createElement.mockImplementation(
      ((tagName: string): HTMLElement => {
        if (tagName === "input") return input;
        return originalCreateElement(tagName);
      }) as typeof document.createElement
    );

    const { result } = renderHook(() => useDirectoryImages());

    await act(async () => {
      await result.current.pickDirectory();
    });

    expect(click).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0]).toMatchObject({
      name: "photo.jpg",
      relativePath: "album/photo.jpg"
    });
    expect(result.current.canRefreshCurrentDirectory).toBe(false);
  });

  it("refreshes by rescanning the current directory handle", async () => {
    let scanCount = 0;
    const first = {
      kind: "file",
      name: "photo-1.jpg",
      getFile: vi.fn(async () => new File(["x"], "photo-1.jpg", { type: "image/jpeg" }))
    } as unknown as FileSystemFileHandle;
    const second = {
      kind: "file",
      name: "photo-2.jpg",
      getFile: vi.fn(async () => new File(["x"], "photo-2.jpg", { type: "image/jpeg" }))
    } as unknown as FileSystemFileHandle;
    const directory = {
      kind: "directory",
      name: "root",
      async *values() {
        scanCount += 1;
        yield (scanCount === 1 ? first : second) as unknown as FileSystemHandle;
      }
    } as unknown as FileSystemDirectoryHandle;
    const picker = vi.fn(async () => directory);

    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      writable: true,
      value: picker
    });

    const { result } = renderHook(() => useDirectoryImages());

    await act(async () => {
      await result.current.pickDirectory();
    });

    expect(result.current.images[0].name).toBe("photo-1.jpg");
    expect(result.current.canRefreshCurrentDirectory).toBe(true);
    expect(picker).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refreshCurrentDirectory();
    });

    expect(result.current.images[0].name).toBe("photo-2.jpg");
    expect(picker).toHaveBeenCalledTimes(1);
  });
});
