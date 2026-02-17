import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GalleryImage } from "../../types/gallery";
import AlbumDetailModal from "../AlbumDetailModal";

vi.mock("../GalleryGrid", () => ({
  default: ({ images, onOpen }: { images: GalleryImage[]; onOpen: (index: number) => void }) => (
    <div data-testid="album-detail-grid">
      <button type="button" onClick={() => onOpen(0)}>
        打开第一张
      </button>
      <p>{`详情图数 ${images.length}`}</p>
    </div>
  )
}));

const images: GalleryImage[] = [
  {
    id: "1",
    name: "a.jpg",
    relativePath: "album-a/a.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "a.jpg" } as unknown as FileSystemFileHandle
  }
];

describe("AlbumDetailModal", () => {
  it("renders title and count when open", async () => {
    render(
      <AlbumDetailModal
        open
        albumPath="album-a"
        images={images}
        onClose={() => {}}
        onOpenImage={() => {}}
        ensurePreviewUrl={async () => null}
        releasePreviewUrl={() => {}}
      />
    );

    expect(await screen.findByRole("dialog", { name: "album-a" })).toBeInTheDocument();
    expect(screen.getByText("album-a")).toBeInTheDocument();
    expect(screen.getByText("1 张图片")).toBeInTheDocument();
  });

  it("triggers close and open callbacks", async () => {
    const onClose = vi.fn();
    const onOpenImage = vi.fn();
    const user = userEvent.setup();
    render(
      <AlbumDetailModal
        open
        albumPath="album-a"
        images={images}
        onClose={onClose}
        onOpenImage={onOpenImage}
        ensurePreviewUrl={async () => null}
        releasePreviewUrl={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "打开第一张" }));
    expect(onOpenImage).toHaveBeenCalledWith(0);

    await user.click(screen.getByRole("button", { name: "关闭画集详情" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("routes wheel from header area to modal body scroll", async () => {
    render(
      <AlbumDetailModal
        open
        albumPath="album-a"
        images={images}
        onClose={() => {}}
        onOpenImage={() => {}}
        ensurePreviewUrl={async () => null}
        releasePreviewUrl={() => {}}
      />
    );

    const body = document.querySelector(".album-detail-body") as HTMLDivElement;
    const headerTitle = await screen.findByRole("heading", { name: "album-a" });
    const header = headerTitle.closest(".album-detail-header") as HTMLElement;

    Object.defineProperty(body, "scrollHeight", { configurable: true, value: 1200 });
    Object.defineProperty(body, "clientHeight", { configurable: true, value: 400 });
    body.scrollTop = 120;

    fireEvent.wheel(header, { deltaY: 240 });
    expect(body.scrollTop).toBe(360);
  });
});
