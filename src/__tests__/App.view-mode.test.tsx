import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GalleryImage } from "../types/gallery";
import App from "../App";
import { useDirectoryImages } from "../hooks/useDirectoryImages";

const images: GalleryImage[] = [
  {
    id: "root-1",
    name: "root-1.jpg",
    relativePath: "root-1.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "root-1.jpg" } as unknown as FileSystemFileHandle
  },
  {
    id: "a-1",
    name: "a-1.jpg",
    relativePath: "album-a/a-1.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "a-1.jpg" } as unknown as FileSystemFileHandle
  },
  {
    id: "a-2",
    name: "a-2.jpg",
    relativePath: "album-a/sub/a-2.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "a-2.jpg" } as unknown as FileSystemFileHandle
  },
  {
    id: "b-1",
    name: "b-1.jpg",
    relativePath: "album-b/b-1.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "b-1.jpg" } as unknown as FileSystemFileHandle
  },
  {
    id: "root-2",
    name: "root-2.jpg",
    relativePath: "root-2.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "root-2.jpg" } as unknown as FileSystemFileHandle
  }
];

vi.mock("../utils/fileSystem", () => ({
  hasDirectoryPicker: () => true
}));

vi.mock("../hooks/useDirectoryImages", () => ({
  useDirectoryImages: vi.fn()
}));

const hookResult = {
  images,
  loading: false,
  error: null,
  pickDirectory: vi.fn(async () => {}),
  clearImages: vi.fn(() => {}),
  ensurePreviewUrl: vi.fn(async () => "blob:preview"),
  releasePreviewUrl: vi.fn(() => {}),
  syncLightboxWindow: vi.fn(async () => ({})),
  releaseAllLightboxUrls: vi.fn(() => {})
};

vi.mock("../components/GalleryGrid", () => ({
  default: ({ images: current }: { images: GalleryImage[] }) => (
    <div data-testid="gallery-grid">
      <p>{`当前列表 ${current.length} 张`}</p>
      <ul>
        {current.map((item) => (
          <li key={item.id}>{item.relativePath}</li>
        ))}
      </ul>
    </div>
  )
}));

vi.mock("../components/AlbumGrid", () => ({
  default: ({
    albums,
    onOpenAlbum
  }: {
    albums: Array<{ path: string; title: string; imageCount: number }>;
    onOpenAlbum: (path: string) => void;
  }) => (
    <div data-testid="album-grid">
      {albums.map((item) => (
        <button
          key={item.path}
          type="button"
          onClick={() => onOpenAlbum(item.path)}
          aria-label={`打开画集 ${item.title}`}
        >
          {`${item.title}(${item.imageCount})`}
        </button>
      ))}
    </div>
  )
}));

vi.mock("../components/ImageLightbox", () => ({
  default: () => null
}));

describe("App view modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDirectoryImages).mockReturnValue(hookResult);
  });

  it("defaults to all mode and can switch to album mode", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("tab", { name: "全图模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("gallery-grid")).toBeInTheDocument();
    expect(screen.getByText("当前列表 5 张")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    expect(screen.getByRole("tab", { name: "画集模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("album-grid")).toBeInTheDocument();
  });

  it("keeps current album path when switching from album detail to all mode", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    await user.click(screen.getByRole("button", { name: "打开画集 album-a" }));

    expect(screen.getByText("当前列表 2 张")).toBeInTheDocument();
    expect(screen.queryByText("root-1.jpg")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "全图模式" }));

    expect(screen.getByText("当前列表 2 张")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回根路径全图" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回根路径全图" }));
    expect(screen.getByText("当前列表 5 张")).toBeInTheDocument();
    expect(screen.getByText("root-1.jpg")).toBeInTheDocument();
  });

  it("keeps selected mode after picking directory", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    expect(screen.getByRole("tab", { name: "画集模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "选择文件夹" }));

    expect(hookResult.pickDirectory).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "画集模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("album-grid")).toBeInTheDocument();
  });
});
