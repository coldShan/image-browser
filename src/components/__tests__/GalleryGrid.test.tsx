import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GalleryGrid from "../GalleryGrid";
import type { GalleryImage } from "../../types/gallery";

vi.mock("react-photo-album", () => ({
  RowsPhotoAlbum: ({
    onClick
  }: {
    onClick: (payload: { index: number }) => void;
  }) => (
    <button type="button" onClick={() => onClick({ index: 0 })}>
      mock-album
    </button>
  )
}));

const images: GalleryImage[] = [
  {
    id: "1",
    name: "cover.jpg",
    relativePath: "cover.jpg",
    lastModified: 1,
    size: 1,
    url: "blob:cover",
    previewUrl: "blob:cover-preview",
    width: 1200,
    height: 800
  }
];

describe("GalleryGrid", () => {
  it("emits index when image is clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<GalleryGrid images={images} onOpen={onOpen} />);

    await user.click(screen.getByRole("button", { name: "mock-album" }));
    expect(onOpen).toHaveBeenCalledWith(0);
  });
});
