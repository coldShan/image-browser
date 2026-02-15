import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AlbumSummary } from "../../types/gallery";
import AlbumGrid from "../AlbumGrid";

const albums: AlbumSummary[] = [
  {
    path: "album-a",
    title: "album-a",
    coverImageId: "img-1",
    coverRelativePath: "album-a/cover.jpg",
    imageCount: 3
  }
];

describe("AlbumGrid", () => {
  it("renders album title and image count", () => {
    render(
      <AlbumGrid
        albums={albums}
        onOpenAlbum={() => {}}
        ensurePreviewUrl={async () => null}
        releasePreviewUrl={() => {}}
      />
    );

    expect(screen.getByText("album-a")).toBeInTheDocument();
    expect(screen.getByText("3 张图片")).toBeInTheDocument();
  });

  it("opens album when card is clicked", async () => {
    const onOpenAlbum = vi.fn();
    const user = userEvent.setup();
    render(
      <AlbumGrid
        albums={albums}
        onOpenAlbum={onOpenAlbum}
        ensurePreviewUrl={async () => null}
        releasePreviewUrl={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "打开画集 album-a" }));
    expect(onOpenAlbum).toHaveBeenCalledWith("album-a");
  });
});
