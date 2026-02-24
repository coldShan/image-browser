import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import GalleryGrid from "../GalleryGrid";
import type { GalleryImage } from "../../types/gallery";

vi.mock("react-photo-album", () => ({
  RowsPhotoAlbum: ({
    photos,
    onClick,
    render
  }: {
    photos: Array<{ width: number; height: number }>;
    onClick: (payload: { index: number }) => void;
    render?: {
      button?: (props: Record<string, unknown>, context: Record<string, unknown>) => JSX.Element;
      extras?: (props: Record<string, unknown>, context: Record<string, unknown>) => JSX.Element;
    };
  }) => (
    <div>
      {render?.button ? (
        render.button(
          {
            type: "button",
            className: "mock-album",
            onClick: () => onClick({ index: 0 }),
            "aria-label": "mock-album"
          },
          {
            photo: photos[0],
            index: 0,
            width: photos[0]?.width ?? 1,
            height: photos[0]?.height ?? 1
          }
        )
      ) : (
        <button type="button" onClick={() => onClick({ index: 0 })}>
          mock-album
        </button>
      )}
      {render?.extras?.(
        {},
        {
          photo: photos[0],
          index: 0,
          width: photos[0]?.width ?? 1,
          height: photos[0]?.height ?? 1
        }
      )}
    </div>
  )
}));

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
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
  });

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

    await user.click(screen.getByRole("button", { name: "mock-album" }));
    expect(onOpen).toHaveBeenCalledWith(0);
  });

  it("shows last viewed marker for the matching image", () => {
    render(
      <GalleryGrid
        images={images}
        onOpen={() => {}}
        ensurePreviewUrl={async () => "blob:preview"}
        releasePreviewUrl={() => {}}
        lastViewedRelativePath="cover.jpg"
      />
    );

    expect(screen.getByText("上次看到这里")).toBeInTheDocument();
  });

  it("restores scroll to the saved image path", async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(
      <GalleryGrid
        images={images}
        onOpen={() => {}}
        ensurePreviewUrl={async () => "blob:preview"}
        releasePreviewUrl={() => {}}
        restoreRelativePath="cover.jpg"
        restoreToken={1}
      />
    );

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
  });
});
