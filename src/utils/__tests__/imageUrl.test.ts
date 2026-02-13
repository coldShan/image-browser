import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createManagedObjectUrl,
  createUrlRegistry,
  releaseAllObjectUrls,
  revokeManagedObjectUrl
} from "../imageUrl";

describe("imageUrl registry", () => {
  beforeEach(() => {
    let seq = 0;
    const createObjectURL = vi.fn(() => `blob:test-${seq++}`);
    const revokeObjectURL = vi.fn();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL
    });
  });

  it("creates and tracks object urls", () => {
    const registry = createUrlRegistry();
    const url = createManagedObjectUrl(new Blob(["x"]), registry);

    expect(url).toBe("blob:test-0");
    expect(registry.has(url)).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("revokes one managed url", () => {
    const registry = createUrlRegistry();
    const url = createManagedObjectUrl(new Blob(["x"]), registry);
    revokeManagedObjectUrl(url, registry);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(registry.size).toBe(0);
  });

  it("releases all managed urls", () => {
    const registry = createUrlRegistry();
    createManagedObjectUrl(new Blob(["a"]), registry);
    createManagedObjectUrl(new Blob(["b"]), registry);
    releaseAllObjectUrls(registry);

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(registry.size).toBe(0);
  });
});
