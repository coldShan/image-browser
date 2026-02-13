import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDirectoryImages } from "../useDirectoryImages";

describe("useDirectoryImages", () => {
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

    expect(result.current.images).toHaveLength(1);
    expect(getFile).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.ensurePreviewUrl(result.current.images[0].id);
    });

    expect(getFile).toHaveBeenCalledTimes(1);
  });
});
