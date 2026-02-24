import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
  });

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
    expect(
      screen.getByRole("progressbar", { name: "画集 album-a 阅读进度" })
    ).toHaveAttribute("aria-valuenow", "0");
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

  it("keeps cover cache when grid unmounts", () => {
    const releasePreviewUrl = vi.fn();
    const { unmount } = render(
      <AlbumGrid
        albums={albums}
        onOpenAlbum={() => {}}
        ensurePreviewUrl={async () => null}
        releasePreviewUrl={releasePreviewUrl}
      />
    );

    unmount();
    expect(releasePreviewUrl).not.toHaveBeenCalled();
  });

  it("shows progress and recent badge", () => {
    render(
      <AlbumGrid
        albums={albums}
        onOpenAlbum={() => {}}
        ensurePreviewUrl={async () => null}
        releasePreviewUrl={() => {}}
        progressByAlbumPath={{ "album-a": 0.5 }}
        recentAlbumPath="album-a"
      />
    );

    expect(
      screen.getByRole("progressbar", { name: "画集 album-a 阅读进度" })
    ).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("最近阅读")).toBeInTheDocument();
  });

  it("restores album card scroll position when token changes", async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(
      <AlbumGrid
        albums={albums}
        onOpenAlbum={() => {}}
        ensurePreviewUrl={async () => null}
        releasePreviewUrl={() => {}}
        restoreAlbumPath="album-a"
        restoreToken={1}
      />
    );

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
  });
});
