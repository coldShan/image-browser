import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GalleryGrid from "../GalleryGrid";
import type { GalleryImage } from "../../types/gallery";

const images: GalleryImage[] = [
  {
    id: "1",
    name: "cover.jpg",
    relativePath: "cover.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    width: 1200,
    height: 800,
    fileHandle: {
      kind: "file",
      name: "cover.jpg",
      getFile: async () => new File(["x"], "cover.jpg", { type: "image/jpeg" })
    } as unknown as FileSystemFileHandle
  }
];

describe("GalleryGrid", () => {
  it("emits index when image is clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryGrid
        images={images}
        onOpen={onOpen}
        ensurePreviewUrl={async () => "blob:preview"}
        releasePreviewUrl={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "Open cover.jpg" }));
    expect(onOpen).toHaveBeenCalledWith(0);
  });
});
